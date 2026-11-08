import { dialog, shell, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { createAi } from '../core/ai/ai-service';
import type { AiEngine } from '../core/ai/engine';
import { autoSend } from '../core/apply/auto-send';
import { sendFollowUp } from '../core/apply/follow-up';
import { interviewPrep } from '../core/apply/interview-prep';
import { silentApplications } from '../core/apply/no-reply';
import { trackReplies } from '../core/apply/track-replies';
import { gmailImap, readInbox, type InboxClient } from '../infra/email/inbox';
import { approveDraft, sendByAts, sendByEmail, type ApplyPorts, type AtsOutcome } from '../core/apply/send-application';
import type { FillInput } from '../core/apply/ats-plan';
import { folderFor, jobMarkdown } from '../core/generation/application-folder';
import { analyzePost, type AnalyzedJob } from '../core/generation/analyze-job';
import { draftJobs, type DraftPorts } from '../core/generation/draft-jobs';
import { dedupKey } from '../core/triage';
import { discover } from '../core/jobs/discover';
import { localDay, runSources } from '../core/jobs/run-sources';
import { createScheduler } from '../core/jobs/scheduler';
import type { HttpGet, JobSource } from '../core/jobs/source';
import { createProfileService } from '../core/profile/profile-service';
import { draftReady, followUpDue, newMatch, quotaWarning, replyArrived, sentOnItsOwn, type BotMessage } from '../core/notify/messages';
import { createTelegramBot } from '../core/notify/telegram-bot';
import { jobCard } from '../core/scoring/job-card';
import { scoringPrefix } from '../core/scoring/prefix';
import { scoreJobs } from '../core/scoring/score-jobs';
import { createToolPorts } from '../mcp/db-ports';
import { buildUsage } from '../core/usage/build-usage';
import { quotaLevel } from '../shared/quota';
import { createBotApi } from '../infra/telegram/bot-api';
import { fetchPublicPage, isPlatformUrl } from '../infra/web/fetch-page';
import { CHECKS_KEY, createSettingsService } from '../core/settings/settings-service';
import { checkDraft, profileVersion } from '../shared/draft-check';
import {
  createActivityRepo, createDraftsRepo, createJobsRepo, createSendsRepo, createPollsRepo, createProfileRepo, createSettingsRepo, createSourcesRepo, createQuestionsRepo, transaction,
} from '../infra/db';
import { createGmail, type MailTransport } from '../infra/email/gmail';
import { findJobFolder, writeApplication } from '../infra/fs/application-files';
import { readResumeText } from '../infra/resume/read-resume';
import type { SecretStore } from '../infra/secrets/secret-store';
import type { ApplioApi } from '../shared/api';
import type { ConnectionCheck, Draft, AiEngine as EngineKind, AppStatus, InterviewPrep, Job, QuestionAnswer, Settings } from '../shared/types';
import { AUTONOMY_LEVELS } from '../shared/autonomy';
import { nextStatuses } from '../shared/status';
import { matchesFilter } from '../shared/job-filter';
import { documentNames, letterBody, pageHtml, resumeBody } from '../shared/templates/application-documents';
import { pdfPageCount } from '../infra/pdf/page-count';
import { isSafeExternalUrl } from './security';

/** Expands a leading `~` so stored folder paths work with the OS shell. */
const expandHome = (path: string) => (path.startsWith('~') ? homedir() + path.slice(1) : path);

/** Everything the backend persists to, the job sources it polls, and where status changes go. */
export interface BackendDeps {
  db: DatabaseSync;
  secrets: SecretStore;
  sources: readonly JobSource[];
  httpFor: (source: JobSource) => HttpGet;
  /** Pushes status to the page whenever it changes (scheduler AC-5). */
  onStatus: (status: AppStatus) => void;
  /** Registers or removes Applio as a login item (scheduler AC-6). */
  setLaunchAtLogin: (open: boolean) => void;
  /** Renders one template page to PDF (Electron's printToPDF in the app). */
  printPdf: (html: string) => Promise<Uint8Array>;
  /** SMTP for Gmail; the real one in the app, a recorder in tests. */
  mailTransport?: (auth: { user: string; pass: string }) => MailTransport;
  /** HTTPS for the Telegram Bot API; global fetch in the app. */
  telegramFetch?: (url: string, init: RequestInit) => Promise<Response>;
  /** Opens a platform or career-site form in the operator's own session and fills it; it never submits. */
  fillPlatformForm: (request: { url: string; input: FillInput }) => Promise<{ filled: number; missing: string[] }>;
  /** HTTPS for reading a job page the operator pasted a link to; global fetch in the app. */
  pageFetch?: (url: string, init: RequestInit) => Promise<Response>;
  /** Brings the app window up on a route, e.g. from a Telegram button. */
  showRoute?: (route: string) => void;
  /** IMAP for reply tracking; the real Gmail one in the app, a fake in tests. */
  inbox?: (auth: { user: string; pass: string }) => InboxClient;
  /** Fills and submits an ATS form in Applio's own window (SPEC F5 channel 2). */
  submitAts: (request: { url: string; input: FillInput; visible: boolean }) => Promise<AtsOutcome>;
  /** One engine per Settings choice (SPEC §2). */
  engines: Record<EngineKind, AiEngine>;
}

/** The API, plus the scheduler tick main runs every minute and on wake. */
/**
 * The API, plus what main drives: the scheduler tick (every minute and on wake), and
 * one Telegram long-poll (false, without waiting, when Telegram isn't set up).
 */
export type Backend = ApplioApi & { tick(): Promise<void>; telegramPoll(): Promise<boolean> };

const PAUSED_KEY = 'automationPaused';
/** Gmail sends per day before Applio stops (SPEC F10 default; Gmail itself allows about 500). */
const GMAIL_DAILY_CAP = 100;
/** Statuses a job can be skipped from: anything before it was sent. */
const SKIPPABLE = new Set(['found', 'scored', 'drafted', 'approved']);
/** Statuses the operator can log a manual application from (SPEC F5 manual handoff). */
const MANUAL_APPLY_FROM = new Set(['scored', 'drafted', 'approved']);

/**
 * The backend the IPC layer serves. Profile, sources, settings and secrets are
 * real (SQLite + OS keychain); jobs, drafts and usage still come from the
 * in-memory store until their PRs land. OS integration is real.
 * ponytail: remaining in-memory data resets on restart — replace with SQLite-backed services per feature.
 */
export function createBackend(getWindow: () => BrowserWindow | null, { db, secrets, sources, httpFor, onStatus, setLaunchAtLogin, printPdf, mailTransport, submitAts, fillPlatformForm, inbox = gmailImap, telegramFetch = (url, init) => fetch(url, init), showRoute = () => {}, pageFetch = (url, init) => fetch(url, init), engines }: BackendDeps): Backend {
  const kv = createSettingsRepo(db);
  const questions = createQuestionsRepo(kv);
  /** The operator's answers for one job's next draft, kept so a later re-draft still has them. */
  const answersKey = (jobId: string) => `answers:${jobId}`;
  const jobs = createJobsRepo(db);
  // Dedup rules can change between versions ("Labs" stopped counting in QA 2026-11-07); stored keys follow them.
  const rekeyed = jobs.rekey(dedupKey);
  if (rekeyed.collided) console.warn(`[dedup] ${rekeyed.collided} stored job(s) match another under the current rules; their old keys were kept.`);
  const drafts = createDraftsRepo(db);
  const sends = createSendsRepo(db);
  const activity = createActivityRepo(db);
  const polls = createPollsRepo(db);
  const sourcesRepo = createSourcesRepo(db);
  const settings = createSettingsService({ kv, sources: sourcesRepo, secrets });
  const profile = createProfileService({ store: createProfileRepo(db), kv, newId: randomUUID, now: () => new Date() });
  const isPaused = () => kv.get(PAUSED_KEY) === true;

  // Every AI call goes through this guard: pause, budgets, usage (SPEC F10).
  const ai = createAi({
    engine: () => engines[settings.getSettings().aiEngine],
    budgets: () => {
      const { dailyTokenBudget, monthlyTokenBudget } = settings.getSettings();
      return { daily: dailyTokenBudget, monthly: monthlyTokenBudget };
    },
    tokensSince: (since) => activity.tokensSince(since),
    // Every call moves the sidebar's token meter, so it's pushed at once rather than on the next unrelated change.
    record: (u) => {
      activity.recordUsage(u);
      pushStatus();
    },
    recentCost: (step) => activity.recentCost(step),
    isPaused,
    now: () => new Date(),
    warn: (message) => {
      console.warn('[budget]', message);
      tell(`quota:tokens:${message.includes('monthly') ? 'month' : 'day'}:${localMidnight()}`, quotaWarning(message));
      pushStatus();
    },
  });

  // Telegram (SPEC F9): built from the saved token and chat each time, so a settings change applies at once.
  const telegram = () => {
    const chatId = settings.getSettings().telegramChatId;
    const token = secrets.get('telegramBotToken');
    if (!chatId || !token) return undefined;
    const api = createBotApi(token, telegramFetch);
    const bot = createTelegramBot(api, {
      chatId,
      offset: () => kv.get('telegramOffset') as number | undefined,
      saveOffset: (offset) => kv.set('telegramOffset', offset),
      wasNotified: (key) => kv.get(`notified:${key}`) === true,
      markNotified: (key) => kv.set(`notified:${key}`, true),
      approve: async (jobId) => {
        const job = await approveDraft(jobId, applyPorts, 'you-telegram');
        if (job.status === 'applied') return job.channel === 'email' ? `Sent to ${job.applyTarget}.` : 'Form submitted.';
        // Platform and career-site jobs are never sent from here (MNB-1): the operator finishes them in the app.
        showRoute(`/handoff/${jobId}`);
        return "Approved. This one is applied to by hand, so it's waiting for you in Applio.";
      },
      skip: async (jobId) => {
        skipJob(jobId);
        return 'Skipped.';
      },
      open: (jobId) => showRoute(`/review/${jobId}`),
    });
    return { api, chatId, bot };
  };
  /** Sends a notification if Telegram is set up; its failures are logged, never thrown into the work that triggered it. */
  const tell = (key: string, message: BotMessage) => {
    void telegram()?.bot.notify(key, message).catch((err: unknown) => console.error('[telegram] notify failed', err instanceof Error ? err.message : err));
  };

  /** A note on a job's timeline that leaves its status as it is. */
  const note = (id: string, text: string) => {
    const job = jobs.get(id);
    if (job) jobs.transition(id, { status: job.status, at: new Date().toISOString(), note: text });
  };

  const getJob = (id: string) => {
    const job = jobs.get(id);
    if (!job) throw new Error(`Job ${id} not found`);
    return job;
  };

  // Application files (SPEC F8): the same template the Review preview shows, printed to PDF.
  const outputRoot = () => expandHome(settings.getSettings().outputFolder ?? '~/Applio');
  /** Whose documents these are: name and email from Settings, header details and sections from Profile. */
  const owner = () => {
    const { fullName, gmailAddress } = settings.getSettings();
    const { contact, factGroups } = profile.getProfile();
    return { name: fullName, email: gmailAddress, contact, groups: factGroups };
  };
  /** A proposal stays editable Markdown (SPEC F8); a cover letter is a PDF. */
  const letterName = (draft: Draft) => (draft.kind === 'proposal' ? 'proposal.md' : 'cover-letter.pdf');
  const letterFile = async (job: Job, draft: Draft) =>
    draft.kind === 'proposal' ? draft.coverLetter : printPdf(pageHtml(letterBody(draft, job, owner()), 'Cover letter'));

  /** Prints both documents first, then writes the folder, so a failed print leaves nothing half-written. */
  const saveFiles = async (jobId: string) => {
    const job = getJob(jobId);
    const draft = drafts.get(jobId);
    if (!draft) return;
    const resume = await printPdf(pageHtml(resumeBody(draft, owner()), 'Resume'));
    // The locked layout is one page; say so when a draft runs over rather than cut it silently.
    const pages = pdfPageCount(resume);
    if (pages > 1) note(jobId, `The résumé prints on ${pages} pages. Trim a bullet or two in the draft, or approve as it is.`);
    const files = {
      'resume.pdf': resume,
      [letterName(draft)]: await letterFile(job, draft),
      'job.md': jobMarkdown(job),
    };
    jobs.update(jobId, { folderPath: writeApplication(outputRoot(), folderFor(job, new Date()), files, jobId) });
  };

  /** The job's folder on disk, re-linked by job id if it was renamed or moved under the output folder. */
  const jobFolder = (job: Job): string | undefined => {
    if (job.folderPath && existsSync(expandHome(job.folderPath))) return expandHome(job.folderPath);
    const found = findJobFolder(outputRoot(), job.id);
    if (found) jobs.update(job.id, { folderPath: found });
    return found;
  };

  /**
   * Drafts one job the operator just added or answered, in the background, so
   * their click returns at once; open pages see it in `drafting` until it lands.
   */
  const draftingNow = new Set<string>();
  const draftInBackground = (id: string) => {
    draftingNow.add(id);
    pushStatus();
    void draftJobs([id], { trigger: 'operator' }, draftPorts)
      .catch((err: unknown) => note(id, `Not drafted: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => {
        draftingNow.delete(id);
        pushStatus();
      });
  };

  // Drafting, from a run or from Add job: the same calls, files and autonomy gate either way.
  const draftPorts: DraftPorts = {
    ai: (request) => ai.run(request),
    hasDraft: (id) => drafts.get(id) !== undefined,
    hasQuestions: (id) => questions.get(id) !== undefined,
    answers: (id) => (kv.get(answersKey(id)) as QuestionAnswer[] | undefined) ?? [],
    job: (id) => jobs.get(id),
    autonomy: (sourceId) => sourcesRepo.get(sourceId)?.autonomy ?? 'draft',
    note: (id, text) => note(id, text),
    addTokens: (id, tokens) => jobs.update(id, { tokensUsed: (jobs.get(id)?.tokensUsed ?? 0) + tokens }),
    // The draft stands even if its files fail; the note says why, and Review can retry later.
    onDrafted: async (id) => {
      try {
        await saveFiles(id);
      } catch (err) {
        note(id, `Couldn't save the files: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
      await sendOnItsOwn(id);
    },
  };

  // Add job (SPEC F2 Clip): analyses wait here, by preview id, until the operator adds one.
  const analyses = new Map<string, AnalyzedJob>();
  const PLATFORM_NAMES: [RegExp, string][] = [[/linkedin\./, 'LinkedIn'], [/indeed\./, 'Indeed'], [/jobstreet\./, 'JobStreet'], [/upwork\./, 'Upwork'], [/facebook\./, 'Facebook']];
  /** The first platform link in a pasted post, kept so the handoff can open it and assisted fill can fill it. */
  const platformIn = (text: string) => {
    const url = text.match(/https:\/\/[^\s<>"]+/g)?.find(isPlatformUrl);
    const name = url ? PLATFORM_NAMES.find(([re]) => re.test(url))?.[1] : undefined;
    return url && name ? { name, url } : undefined;
  };

  const runDiscovery = () =>
    discover({
      poll: () => runSources({ sources, isEnabled: (id) => sourcesRepo.get(id)?.enabled ?? false, polls, httpFor, today: () => localDay(new Date()) }),
      existingKeys: () => jobs.dedupKeys(),
      seenKeys: () => jobs.seenKeys(),
      filters: () => {
        const p = profile.getProfile();
        return { preferences: p.preferences, blocklist: settings.getSettings().blocklist, homeLocation: p.contact.location };
      },
      save: (found, details, summary, seen) =>
        transaction(db, () => {
          jobs.markSeen(seen, summary.at);
          for (const { job, dedupKey } of found) jobs.insert(job, { dedupKey, createdAt: summary.at });
          return activity.addRun(summary, details);
        }),
      score: async (jobIds, runId) => {
        const result = await scoreJobs(jobIds, { runId, draftThreshold: settings.getSettings().draftThreshold }, {
          ai: (request) => ai.run(request),
          prefix: () => scoringPrefix(profile.getProfile()),
          cards: (ids) => ids.flatMap((id) => {
            const job = jobs.get(id);
            return job ? [jobCard(job)] : [];
          }),
          factIds: () => new Set(profile.getProfile().facts.map((f) => f.id)),
          // The same save as the MCP tool: score, summaries and the found → scored move, together.
          save: (id, match) => createToolPorts(db, [id], () => new Date()).saveMatch(id, match),
          score: (id) => jobs.get(id)?.score,
          note,
        });
        // Strong matches from Notify-only sources are never drafted, so this message is all the operator gets.
        for (const id of result.toDraft) {
          const job = jobs.get(id);
          if (job && sourcesRepo.get(job.sourceId)?.autonomy === 'notify') tell(`match:${id}`, newMatch(job));
        }
        return result;
      },
      draft: (jobIds, runId) => draftJobs(jobIds, { runId }, draftPorts),
      finishRun: (runId, details, drafted) => activity.updateDetails(runId, details, drafted),
      leftover: () => {
        const threshold = settings.getSettings().draftThreshold;
        return {
          unscored: jobs.list({ statuses: ['found'] }).map((j) => j.id),
          undrafted: jobs.list({ statuses: ['scored'] }).filter((j) => (j.score ?? 0) >= threshold).map((j) => j.id),
        };
      },
      now: () => new Date(),
      newId: randomUUID,
    });

  const scheduler = createScheduler({
    now: () => new Date(),
    intervalHours: () => settings.getSettings().discoveryIntervalHours,
    lastRunAt: () => activity.latestRun()?.at,
    isPaused,
    run: runDiscovery,
    onChange: () => pushStatus(),
    log: console.error,
  });

  // Last readiness check per engine. Checks spawn Claude Code or call the API, so they run on
  // start, on an engine or key change, and on Test, not on every status read.
  const engineChecks: Partial<Record<EngineKind, { ready: boolean; message: string; command?: string }>> = {};
  const checkEngine = async () => {
    const kind = settings.getSettings().aiEngine;
    const result = await engines[kind].check();
    engineChecks[kind] = result;
    pushStatus();
    return result;
  };

  /** Gmail with the saved address and app password. @throws when either is missing. */
  const gmail = () => {
    const user = settings.getSettings().gmailAddress;
    const pass = secrets.get('gmailAppPassword');
    if (!user || !pass) throw new Error('Set up Gmail in Settings first: your address and an app password.');
    return createGmail({ user, pass, ...(mailTransport ? { transport: mailTransport } : {}) });
  };

  /** Records how a sign-in went (`Settings.checks`), so the page calls a connection Connected only after it worked. */
  const recordCheck = (kind: 'gmail' | 'telegram', err?: unknown) => {
    const at = new Date().toISOString();
    const code = (err as { code?: unknown } | undefined)?.code;
    const check: ConnectionCheck =
      err === undefined
        ? { ok: true, at, message: kind === 'gmail' ? 'Signed in to Gmail.' : 'Test message delivered.' }
        : { ok: false, at, message: err instanceof Error ? err.message : String(err), ...(code === 'email_offline' || code === 'telegram_offline' ? { offline: true } : {}) };
    const checks = (kv.get(CHECKS_KEY) as Settings['checks'] | undefined) ?? {};
    kv.set(CHECKS_KEY, { ...checks, [kind]: check });
  };

  /** Sends through Gmail and keeps its check current: a sent email proves the password, a sign-in refusal disproves it. */
  const sendGmail = async (message: Parameters<ReturnType<typeof gmail>['send']>[0]) => {
    try {
      await gmail().send(message);
      recordCheck('gmail');
    } catch (err) {
      if ((err as { code?: unknown }).code === 'email_auth') recordCheck('gmail', err);
      throw err;
    }
  };

  /** Telegram's check: a short message to the operator's chat, the only way to prove both the token and the chat ID. */
  const telegramHello = async () => {
    const t = telegram();
    if (!t) throw new Error('Missing credentials. Fill in the fields above first.');
    await t.api.sendMessage(t.chatId, 'Applio is connected. Matches, drafts and replies will show up here.');
  };

  /**
   * Signs in with a connection's saved credentials, once both parts are there, and
   * records the result. Gmail is checked without sending; Telegram with a test message.
   * Changed credentials always drop the old result first, so a stale "Connected" never shows.
   */
  const verifyConnection = async (kind: 'gmail' | 'telegram') => {
    const s = settings.getSettings();
    const checks = (kv.get(CHECKS_KEY) as Settings['checks'] | undefined) ?? {};
    const { [kind]: _old, ...others } = checks;
    kv.set(CHECKS_KEY, others);
    const complete = kind === 'gmail' ? !!s.gmailAddress && s.secretsSet.gmailAppPassword : !!s.telegramChatId && s.secretsSet.telegramBotToken;
    if (!complete) return;
    try {
      if (kind === 'gmail') await gmail().verify();
      else await telegramHello();
      recordCheck(kind);
    } catch (err) {
      recordCheck(kind, err);
    }
  };

  /**
   * Adds the draft's provenance check, worked out now against today's profile:
   * stale when the profile changed since it was made, plus the letter lines no
   * fact backs and any term the operator's notes forbid (QA 2026-11-07 #10).
   */
  const withCheck = (draft: Draft): Draft => {
    const p = profile.getProfile();
    const job = getJob(draft.jobId);
    const now = profileVersion({ facts: p.facts, groups: p.factGroups, contact: p.contact });
    const found = checkDraft(draft, {
      facts: p.facts, groups: p.factGroups, contact: p.contact, owner: `${settings.getSettings().fullName} ${settings.getSettings().gmailAddress}`,
      job: { company: job.company, title: job.title, description: job.description },
    });
    return { ...draft, check: { stale: draft.profileVersion !== now, ...found } };
  };

  const localMidnight = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  };

  const applyPorts: ApplyPorts = {
    job: getJob,
    draft: (id) => drafts.get(id),
    transition: (id, status, extra) =>
      transaction(db, () => {
        if (extra?.sentBy) jobs.update(id, { sentBy: extra.sentBy });
        return jobs.transition(id, { status, at: new Date().toISOString(), ...(extra?.note ? { note: extra.note } : {}) });
      }),
    note,
    sendLog: sends,
    sendEmail: sendGmail,
    checkSetup: (channel) => void (channel === 'email' && gmail()),
    folder: (job) => jobFolder(job),
    fileExists: existsSync,
    writeFile: (path, text) => writeFileSync(path, text),
    copyFile: (from, to) => copyFileSync(from, to),
    owner,
    // ponytail: Gmail's cap is SPEC F10's default; the editable quota table comes with PR-24.
    caps: () => ({ gmailDaily: GMAIL_DAILY_CAP, perChannel: settings.getSettings().maxPerChannelPerDay }),
    dayStart: localMidnight,
    now: () => new Date(),
    newMessageId: (jobId) => `<${jobId}.${randomUUID()}@applio.local>`,
    saveAiAnswers: (answers) => {
      for (const a of answers) profile.saveAnswer(a);
    },
    bankAnswers: () => profile.getProfile().answers.map(({ question, answer }) => ({ question, answer })),
    submitAts,
  };

  /**
   * The Autonomous level (SPEC F6): a freshly drafted job goes out without the
   * operator only when its source, channel, score and guardrails all allow.
   */
  const sendOnItsOwn = async (jobId: string) => {
    const job = getJob(jobId);
    const source = sourcesRepo.get(job.sourceId);
    const { autoSendThreshold, blocklist } = settings.getSettings();
    // A source's own ceiling (clipped jobs, Upwork) caps what it asks for.
    const asked = source?.autonomy ?? 'draft';
    const sourceAutonomy = source?.maxAutonomy && AUTONOMY_LEVELS.indexOf(source.maxAutonomy) < AUTONOMY_LEVELS.indexOf(asked) ? source.maxAutonomy : asked;
    const outcome = await autoSend(job, { sourceAutonomy, autoSendThreshold, blocklist, paused: isPaused(), budgetStop: ai.budgetStop() }, {
      send: (id) => (job.channel === 'email' ? sendByEmail(id, 'autonomous', applyPorts) : sendByAts(id, 'autonomous', applyPorts)),
      note,
    });
    const now = getJob(jobId);
    tell(outcome === 'sent' ? `sent:${jobId}` : `draft:${jobId}`, outcome === 'sent' ? sentOnItsOwn(now) : draftReady(now));
  };

  // Reply tracking (SPEC F7): read new inbox mail every 15 minutes; it reads only and sends nothing, so pause doesn't stop it.
  let lastInboxCheck = 0;
  const checkReplies = async () => {
    const user = settings.getSettings().gmailAddress;
    const pass = secrets.get('gmailAppPassword');
    if (!user || !pass || Date.now() - lastInboxCheck < 15 * 60_000) return;
    lastInboxCheck = Date.now();
    const afterUid = kv.get('inboxLastUid') as number | undefined;
    const { mails, lastUid } = await readInbox({ ...(afterUid !== undefined ? { afterUid } : {}), since: new Date(Date.now() - 30 * 86_400_000) }, () => inbox({ user, pass }));
    trackReplies(mails, {
      applications: () =>
        jobs.list({ statuses: ['applied', 'replied', 'interview'] }).map((j) => {
          const row = sends.get(j.id);
          return { id: j.id, company: j.company, applyTarget: j.applyTarget, status: j.status, messageIds: row?.state === 'sent' && row.messageId ? [row.messageId] : [] };
        }),
      ownAddress: user,
      move: (id, status, text, at) => {
        tell(`reply:${id}:${at}`, replyArrived(jobs.transition(id, { status, at, note: text }), text));
      },
      note: (id, text, at) => {
        const job = jobs.get(id);
        if (job) tell(`reply:${id}:${at}`, replyArrived(jobs.transition(id, { status: job.status, at, note: text }), text));
      },
    });
    kv.set('inboxLastUid', lastUid);
  };

  /** Moves silent applications to No reply (SPEC F7), and tells Telegram about follow-ups coming due; runs on every tick. */
  const markNoReply = () => {
    const waiting = jobs.list({ statuses: ['applied'] });
    for (const id of silentApplications(waiting, new Date())) {
      jobs.transition(id, { status: 'ghosted', at: new Date().toISOString(), note: 'No reply in 21 days' });
    }
    const { followUpDays } = settings.getSettings();
    for (const job of waiting) {
      const last = job.history.at(-1)?.at ?? '';
      // Keyed by the last contact, so each waiting period gets one nudge.
      if (Date.now() - Date.parse(last) > followUpDays * 86_400_000) tell(`followup:${job.id}:${last}`, followUpDue(job, followUpDays));
    }
  };

  /** The Usage page (SPEC F10), from what's recorded: AI usage, sends, drafts and today's polls. */
  const usageFor = (period: 'today' | 'month') => {
    const now = new Date();
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = (weekAgo < monthStart ? weekAgo : monthStart).toISOString();
    const today = localDay(now);
    // perf: reads every job to find sent ones; fine for a personal log of a few thousand applications.
    const sent = jobs.list().flatMap((j) => {
      const appliedAt = j.history.find((e) => e.status === 'applied')?.at;
      return j.sentBy && appliedAt ? [{ at: appliedAt, sentBy: j.sentBy, channel: j.channel, tokens: j.tokensUsed }] : [];
    });
    return buildUsage(period, {
      now,
      usage: activity.usageSince(from),
      sent,
      bankAnswersReused: drafts.createdSince(from).map((d) => ({ at: d.createdAt, count: d.answers.filter((a) => a.origin === 'bank').length })),
      polls: sources.filter((s) => sourcesRepo.get(s.id)?.enabled).map((s) => ({ id: s.id, name: sourcesRepo.get(s.id)?.name ?? s.name, used: polls.count(s.id, today), limit: s.dailyPollLimit })),
      settings: settings.getSettings(),
      gmailDailyCap: GMAIL_DAILY_CAP,
      runs: activity.runsSince(from),
    });
  };

  /** One Telegram warning per limit per day at 80% (SPEC F10); tokens already warn from the AI guard. */
  const warnLimits = () => {
    for (const q of usageFor('today').quotas) {
      if (q.off || q.unit === 'tokens' || q.unit === 'polls' || quotaLevel(q) !== 'warn') continue;
      tell(`quota:${q.id}:${localMidnight()}`, quotaWarning(`${q.label}: ${q.used} of ${q.limit} ${q.unit} used today. Applio stops at ${q.limit}.`));
    }
  };

  const skipJob = (jobId: string) => {
    const job = getJob(jobId);
    if (!SKIPPABLE.has(job.status)) throw new Error(`Job ${jobId} is already ${job.status}, so it can't be skipped`);
    return applyPorts.transition(jobId, 'skipped');
  };

  /** True when every enabled source has used today's polls, so Run now would fetch nothing. */
  const allSourcesAtLimit = () => {
    const day = localDay(new Date());
    const enabled = sources.filter((src) => sourcesRepo.get(src.id)?.enabled);
    return enabled.length > 0 && enabled.every((src) => polls.count(src.id, day) >= src.dailyPollLimit);
  };

  const getStatus = (): AppStatus => {
    const { aiEngine, secretsSet, dailyTokenBudget } = settings.getSettings();
    // Until the first check returns, a saved key (or Claude Code, the default) counts as ready.
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    return {
      engine: aiEngine,
      engineReady: engineChecks[aiEngine]?.ready ?? (aiEngine === 'claude-code' || secretsSet.anthropicApiKey),
      paused: isPaused(),
      nextRunAt: scheduler.nextRunAt(),
      tokensToday: activity.tokensSince(midnight),
      dailyTokenBudget,
      lastRun: activity.latestRun(),
      jobsVersion: jobs.version(),
      drafting: [...draftingNow],
      ...(ai.budgetStop() ? { budgetStop: ai.budgetStop() } : {}),
      ...(allSourcesAtLimit() ? { sourcesAtLimit: true } : {}),
    };
  };
  let pushedJobsVersion: number | undefined;
  const pushStatus = () => {
    const status = getStatus();
    pushedJobsVersion = status.jobsVersion;
    onStatus(status);
  };
  void checkEngine().catch((err: unknown) => console.error('[engine] check failed', err));

  /** Runs a synchronous service call as the async API method; a throw becomes a rejection. */
  const later = <A extends unknown[], R>(fn: (...args: A) => R) => async (...args: A) => fn(...args);

  /**
   * Opens a folder in Finder/Explorer. The UI already prefixes "Couldn't open the folder.",
   * so messages here say only why. A missing folder is checked first: the OS's own
   * answer for that ("Failed to open path") doesn't help the operator.
   */
  const openWithShell = async (path: string, missing: string) => {
    const full = expandHome(path);
    if (!existsSync(full)) throw new Error(missing);
    const error = await shell.openPath(full);
    if (error) throw new Error(`The system said: ${error}`);
  };

  return {
    // Jobs and drafts come from SQLite; the send flow stays mock until PR-18.
    listJobs: later((filter = {}) => jobs.list(filter.statuses ? { statuses: filter.statuses } : undefined).filter((j) => matchesFilter(j, filter))),
    getJob: later(getJob),
    getDraft: later((jobId) => {
      const draft = drafts.get(jobId);
      return draft ? withCheck(draft) : null;
    }),
    getSend: later((id) => {
      const row = sends.get(id);
      if (!row) return null;
      const { jobId: _jobId, ...record } = row;
      return record;
    }),
    updateCoverLetter: async (jobId, coverLetter) => {
      const draft = drafts.get(jobId);
      if (!draft) throw new Error(`No draft for job ${jobId}`);
      // What went out stays as it went out (email-apply MNB-3): the folder must keep matching sent.md.
      if (!['found', 'scored', 'drafted', 'approved'].includes(getJob(jobId).status)) throw new Error('This application was already sent, so its letter stays as sent.');
      const next = { ...draft, coverLetter, edited: true };
      drafts.save(next);
      // What's on disk must match what gets sent, so the letter file follows the edit.
      const job = getJob(jobId);
      const folder = jobFolder(job);
      if (folder) writeFileSync(join(folder, letterName(next)), await letterFile(job, next));
      return withCheck(next);
    },

    redraft: later((jobId) => {
      const job = getJob(jobId);
      if (job.status !== 'drafted') throw new Error('Only a draft waiting in Review can be redrafted.');
      // Back to scored, so the drafting run treats it like any other match; the old draft goes, so it can't be sent by mistake.
      transaction(db, () => {
        drafts.remove(jobId);
        jobs.transition(jobId, { status: 'scored', at: new Date().toISOString(), note: 'Redrafting from your current profile' });
      });
      draftInBackground(jobId);
      return getJob(jobId);
    }),

    getProfile: later(profile.getProfile),
    saveFact: later(profile.saveFact),
    deleteFact: later(profile.deleteFact),
    saveAnswer: later(profile.saveAnswer),
    deleteAnswer: later(profile.deleteAnswer),
    savePreferences: later(profile.savePreferences),
    saveContact: later(profile.saveContact),
    saveFactGroup: later(profile.saveFactGroup),

    listSources: later(settings.listSources),
    updateSource: later(settings.updateSource),
    getSettings: later(settings.getSettings),
    // Engine, budget and interval all show in the status card, so a save pushes it.
    saveSettings: async (patch) => {
      settings.saveSettings(patch);
      if (patch.launchAtLogin !== undefined) setLaunchAtLogin(patch.launchAtLogin);
      if (patch.aiEngine !== undefined) void checkEngine();
      if (patch.gmailAddress !== undefined) await verifyConnection('gmail');
      if (patch.telegramChatId !== undefined) await verifyConnection('telegram');
      pushStatus();
      return settings.getSettings();
    },
    setSecret: async (key, value) => {
      settings.setSecret(key, value);
      if (key === 'anthropicApiKey') void checkEngine();
      if (key === 'gmailAppPassword') await verifyConnection('gmail');
      if (key === 'telegramBotToken') await verifyConnection('telegram');
      pushStatus();
      return settings.getSettings();
    },

    approveDraft: (jobId) => approveDraft(jobId, applyPorts),

    draftJob: later((jobId) => {
      if (getJob(jobId).status !== 'scored') throw new Error('Only scored jobs can be drafted. This one is already drafted, sent or dismissed.');
      draftInBackground(jobId);
      return getJob(jobId);
    }),

    getUsage: later(usageFor),

    analyzeJob: async (input) => {
      // A platform link is never opened (MNB-1); its page is refused before any request.
      const text = input.kind === 'link' ? await fetchPublicPage(input.value, pageFetch) : input.value;
      const platform = input.kind === 'text' ? platformIn(text) : undefined;
      const sourceName = input.kind === 'link' ? `from ${new URL(input.value).hostname}` : platform ? `clipped from ${platform.name}` : 'pasted by you';
      const { preview, job } = await analyzePost({ text, sourceName, ...(platform ? { platform } : {}) }, {
        ai: (request) => ai.run(request),
        factIds: () => new Set(profile.getProfile().facts.map((f) => f.id)),
        existing: (company, title) => {
          const found = jobs.findByDedupKey(dedupKey({ company, title }));
          return found ? { id: found.id, title: found.title, status: found.status } : undefined;
        },
      });
      const previewId = randomUUID();
      // ponytail: kept in memory and capped; an analysis lost to a restart just needs Analyze again.
      if (analyses.size >= 20) analyses.delete(analyses.keys().next().value!);
      analyses.set(previewId, job);
      return { ...preview, previewId };
    },

    addJob: async ({ previewId }) => {
      const analyzed = analyses.get(previewId);
      if (!analyzed) throw new Error('Analyze the post again, then add it.');
      const key = dedupKey(analyzed);
      const existing = jobs.findByDedupKey(key);
      if (existing) throw new Error(`${existing.title} at ${existing.company} is already in Applio (${existing.status}).`);
      const id = randomUUID();
      const at = new Date().toISOString();
      jobs.insert({ ...analyzed, id, sourceId: 'clip', status: 'scored', factsUsed: 0, history: [{ status: 'found', at }, { status: 'scored', at }] }, { dedupKey: key, createdAt: at });
      analyses.delete(previewId);
      draftInBackground(id);
      return getJob(id);
    },

    listQuestions: later(() => questions.list().filter((q) => jobs.get(q.jobId)?.status === 'scored')),

    answerQuestions: async (jobId, answers) => {
      if (!questions.get(jobId)) throw new Error('There are no open questions for this job.');
      // Saved answers join the fact bank first, so this draft can already cite them.
      for (const a of answers) if (a.saveTo) profile.saveFact({ group: a.saveTo, text: a.answer.trim() });
      kv.set(answersKey(jobId), answers.map(({ question, answer }) => ({ question, answer: answer.trim() })));
      questions.clear(jobId);
      note(jobId, `You answered ${answers.length} question${answers.length === 1 ? '' : 's'}`);
      draftInBackground(jobId);
      return getJob(jobId);
    },

    markApplied: later((jobId) => {
      const job = getJob(jobId);
      if (!MANUAL_APPLY_FROM.has(job.status)) throw new Error(`Job ${jobId} cannot be marked applied from ${job.status}`);
      return applyPorts.transition(jobId, 'applied', { sentBy: 'you-manual' });
    }),

    skipJob: later(skipJob),

    telegramPoll: async () => {
      const t = telegram();
      if (!t) return false;
      await t.bot.poll();
      return true;
    },

    getStatus: later(getStatus),
    runDiscovery: () => scheduler.runNow(),
    setAutomationPaused: later((paused) => {
      kv.set(PAUSED_KEY, paused);
      pushStatus();
      return getStatus();
    }),
    tick: async () => {
      await scheduler.tick();
      markNoReply();
      warnLimits();
      await checkReplies().catch((err: unknown) => console.error('[replies] inbox check failed', err));
      // Replies, sends and drafts change jobs outside any page's request; tell open pages.
      if (jobs.version() !== pushedJobsVersion) pushStatus();
    },

    sendFollowUp: (jobId, text) =>
      sendFollowUp(jobId, text, {
        job: getJob,
        sent: (id) => {
          const row = sends.get(id);
          return row?.state === 'sent' ? { subject: row.subject, ...(row.messageId ? { messageId: row.messageId } : {}) } : undefined;
        },
        sendEmail: sendGmail,
        owner,
        folder: jobFolder,
        appendFile: (path, text) => appendFileSync(path, text),
        logFollowUp: (id) => jobs.transition(id, { status: 'applied', at: new Date().toISOString(), note: 'Follow-up sent' }),
        newMessageId: applyPorts.newMessageId,
        now: () => new Date(),
      }),

    getInterviewPrep: (jobId) =>
      interviewPrep(jobId, {
        cached: (id) => kv.get(`prep:${id}`) as InterviewPrep | undefined,
        save: (id, prep) => kv.set(`prep:${id}`, prep),
        sent: (id) => {
          const draft = drafts.get(id);
          return { letter: draft?.coverLetter ?? '', resume: draft?.resume.flatMap((s) => s.items.map((i) => i.text)) ?? [] };
        },
        ai: ai.run,
      }),

    setStatus: later((jobId, status, statusNote) => {
      const job = getJob(jobId);
      if (!nextStatuses(job.status).includes(status)) throw new Error(`Cannot move job from ${job.status} to ${status}`);
      return jobs.transition(jobId, { status, at: new Date().toISOString(), ...(statusNote ? { note: statusNote } : {}) });
    }),

    // Every connection test is live: AI readiness, a Gmail test email, a Telegram test message.
    testConnection: async (kind) => {
      if (kind === 'ai') {
        const { ready, message, command } = await checkEngine();
        return { ok: ready, message, ...(command ? { command } : {}) };
      }
      const { secretsSet, gmailAddress, telegramChatId } = settings.getSettings();
      if (kind === 'gmail') {
        if (!secretsSet.gmailAppPassword || !gmailAddress) return { ok: false, message: 'Missing credentials. Fill in the fields above first.' };
        try {
          await gmail().sendTest();
          recordCheck('gmail');
          return { ok: true, message: `Test email sent to ${gmailAddress}` };
        } catch (err) {
          recordCheck('gmail', err);
          return { ok: false, message: err instanceof Error ? err.message : String(err) };
        }
      }
      if (!secretsSet.telegramBotToken || !telegramChatId) return { ok: false, message: 'Missing credentials. Fill in the fields above first.' };
      try {
        await telegramHello();
        recordCheck('telegram');
        return { ok: true, message: 'Test message delivered to Telegram' };
      } catch (err) {
        recordCheck('telegram', err);
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
    },

    openExternal: async (url) => {
      if (!isSafeExternalUrl(url)) throw new Error('Only web links can be opened');
      await shell.openExternal(url);
    },

    openJobFolder: async (jobId) => {
      const job = getJob(jobId);
      if (!job.folderPath) throw new Error('This job has no folder yet');
      await openWithShell(jobFolder(job) ?? job.folderPath, "This job's folder isn't on disk yet. Applio creates it when it saves the application.");
    },

    assistFill: async (jobId) => {
      const job = getJob(jobId);
      if (job.channel !== 'platform' && job.channel !== 'custom') throw new Error('Assisted fill is only for platform and career-site jobs.');
      const name = job.channel === 'platform' ? 'platform apply' : 'career sites';
      if (!settings.getSettings().assistedFill[job.channel]) throw new Error(`Assisted fill is off for ${name}. Turn it on in Settings → Apply channels, or apply by hand.`);
      const url = job.applyUrl ?? job.url;
      if (!url.startsWith('https://')) throw new Error("This job has no form link to open. Apply by hand from the handoff.");
      const draft = drafts.get(jobId);
      const folder = jobFolder(job);
      if (!draft || !folder) throw new Error("This job's files aren't saved yet.");
      const coverLetter = join(folder, 'cover-letter.pdf');
      // Uploaded under the operator's file names, as ATS sends are.
      const names = documentNames(owner().name, draft.headline);
      const asNamed = (from: string, name: string) => (copyFileSync(from, join(folder, name)), join(folder, name));
      const result = await fillPlatformForm({
        url,
        input: {
          applicant: { fullName: owner().name, email: owner().email },
          files: { resume: asNamed(join(folder, 'resume.pdf'), names.resume), ...(existsSync(coverLetter) ? { coverLetter: asNamed(coverLetter, names.letter) } : {}) },
          letter: draft.coverLetter,
          answers: [...draft.answers.map(({ question, answer }) => ({ question, answer })), ...applyPorts.bankAnswers()],
        },
      });
      note(jobId, `Assisted fill: ${result.filled} fields filled. You check them and click Submit.`);
      return result;
    },

    openDraftFile: async (jobId, file) => {
      const job = getJob(jobId);
      const draft = drafts.get(jobId);
      const folder = jobFolder(job);
      if (!draft || !folder) throw new Error("This job's files aren't saved yet.");
      await openWithShell(join(folder, file === 'resume' ? 'resume.pdf' : letterName(draft)), 'That file is missing from the job folder. Open the folder to check it.');
    },

    openOutputFolder: async () => {
      const { outputFolder } = settings.getSettings();
      if (!outputFolder) throw new Error('Choose an output folder first');
      await openWithShell(outputFolder, `${outputFolder} no longer exists. Choose the folder again above.`);
    },

    chooseFolder: async () => {
      const win = getWindow();
      const options = { properties: ['openDirectory', 'createDirectory'] as const };
      const result = win ? await dialog.showOpenDialog(win, { ...options, properties: [...options.properties] }) : await dialog.showOpenDialog({ properties: [...options.properties] });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },

    importResume: async () => {
      const win = getWindow();
      const options: Electron.OpenDialogOptions = { properties: ['openFile'], filters: [{ name: 'Resume', extensions: ['pdf', 'docx'] }] };
      const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      const file = result.filePaths[0];
      if (result.canceled || !file) return null;
      // Read first: an unreadable file throws here, before anything is recorded.
      const text = await readResumeText(file);
      return profile.recordResume(basename(file), text);
    },
  };
}
