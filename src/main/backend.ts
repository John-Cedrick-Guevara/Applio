import { dialog, shell, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
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
import { draftJobs } from '../core/generation/draft-jobs';
import { discover } from '../core/jobs/discover';
import { localDay, runSources } from '../core/jobs/run-sources';
import { createScheduler } from '../core/jobs/scheduler';
import type { HttpGet, JobSource } from '../core/jobs/source';
import { createProfileService } from '../core/profile/profile-service';
import { scoreJobs } from '../core/scoring/score-jobs';
import { createSettingsService } from '../core/settings/settings-service';
import {
  createActivityRepo, createDraftsRepo, createJobsRepo, createSendsRepo, createPollsRepo, createProfileRepo, createSettingsRepo, createSourcesRepo, transaction,
} from '../infra/db';
import { createGmail, type MailTransport } from '../infra/email/gmail';
import { findJobFolder, writeApplication } from '../infra/fs/application-files';
import { readResumeText } from '../infra/resume/read-resume';
import type { SecretStore } from '../infra/secrets/secret-store';
import type { ApplioApi } from '../shared/api';
import type { Draft, AiEngine as EngineKind, AppStatus, InterviewPrep, Job } from '../shared/types';
import { AUTONOMY_LEVELS } from '../shared/autonomy';
import { nextStatuses } from '../shared/status';
import { matchesFilter } from '../shared/job-filter';
import { letterBody, pageHtml, resumeBody } from '../shared/templates/application-documents';
import { createMockApi } from '../shared/mock/mock-api';
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
  /** IMAP for reply tracking; the real Gmail one in the app, a fake in tests. */
  inbox?: (auth: { user: string; pass: string }) => InboxClient;
  /** Fills and submits an ATS form in Applio's own window (SPEC F5 channel 2). */
  submitAts: (request: { url: string; input: FillInput; visible: boolean }) => Promise<AtsOutcome>;
  /** One engine per Settings choice (SPEC §2). */
  engines: Record<EngineKind, AiEngine>;
}

/** The API, plus the scheduler tick main runs every minute and on wake. */
export type Backend = ApplioApi & { tick(): Promise<void> };

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
export function createBackend(getWindow: () => BrowserWindow | null, { db, secrets, sources, httpFor, onStatus, setLaunchAtLogin, printPdf, mailTransport, submitAts, inbox = gmailImap, engines }: BackendDeps): Backend {
  const store = createMockApi({ latencyMs: 0 });
  const kv = createSettingsRepo(db);
  const jobs = createJobsRepo(db);
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
    record: (u) => activity.recordUsage({ ...u, tokens: u.inputTokens + u.outputTokens }),
    isPaused,
    now: () => new Date(),
    // ponytail: logged and shown through status; Telegram picks warnings up in PR-22.
    warn: (message) => {
      console.warn('[budget]', message);
      pushStatus();
    },
  });

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
  const owner = () => {
    const { fullName, gmailAddress } = settings.getSettings();
    return { name: fullName, email: gmailAddress };
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
    const files = {
      'resume.pdf': await printPdf(pageHtml(resumeBody(draft, owner()), 'Resume')),
      [letterName(draft)]: await letterFile(job, draft),
      'job.md': jobMarkdown(job),
    };
    jobs.update(jobId, { folderPath: writeApplication(outputRoot(), folderFor(job, new Date()), files) });
  };

  /** The job's folder on disk, re-linked by job id if it was renamed or moved under the output folder. */
  const jobFolder = (job: Job): string | undefined => {
    if (job.folderPath && existsSync(expandHome(job.folderPath))) return expandHome(job.folderPath);
    const found = findJobFolder(outputRoot(), job.id);
    if (found) jobs.update(job.id, { folderPath: found });
    return found;
  };

  const runDiscovery = () =>
    discover({
      poll: () => runSources({ sources, isEnabled: (id) => sourcesRepo.get(id)?.enabled ?? false, polls, httpFor, today: () => localDay(new Date()) }),
      existingKeys: () => jobs.dedupKeys(),
      filters: () => ({ preferences: profile.getProfile().preferences, blocklist: settings.getSettings().blocklist }),
      save: (found, details, summary) =>
        transaction(db, () => {
          for (const { job, dedupKey } of found) jobs.insert(job, { dedupKey, createdAt: summary.at });
          return activity.addRun(summary, details);
        }),
      score: (jobIds, runId) =>
        scoreJobs(jobIds, { runId, draftThreshold: settings.getSettings().draftThreshold }, { ai: ai.run, score: (id) => jobs.get(id)?.score, note }),
      draft: (jobIds, runId) =>
        draftJobs(jobIds, { runId }, {
          ai: ai.run,
          hasDraft: (id) => drafts.get(id) !== undefined,
          job: (id) => jobs.get(id),
          autonomy: (sourceId) => sourcesRepo.get(sourceId)?.autonomy ?? 'draft',
          note,
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
        }),
      finishRun: (runId, details, drafted) => activity.updateDetails(runId, details, drafted),
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
  const engineChecks: Partial<Record<EngineKind, { ready: boolean; message: string }>> = {};
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
    sendEmail: (message) => gmail().send(message),
    folder: (job) => jobFolder(job),
    fileExists: existsSync,
    writeFile: (path, text) => writeFileSync(path, text),
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
    await autoSend(job, { sourceAutonomy, autoSendThreshold, blocklist, paused: isPaused(), budgetStop: ai.budgetStop() }, {
      send: (id) => (job.channel === 'email' ? sendByEmail(id, 'autonomous', applyPorts) : sendByAts(id, 'autonomous', applyPorts)),
      note,
    });
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
      move: (id, status, text, at) => void jobs.transition(id, { status, at, note: text }),
      note: (id, text, at) => {
        const job = jobs.get(id);
        if (job) jobs.transition(id, { status: job.status, at, note: text });
      },
    });
    kv.set('inboxLastUid', lastUid);
  };

  /** Moves silent applications to No reply (SPEC F7); runs on every scheduler tick. */
  const markNoReply = () => {
    for (const id of silentApplications(jobs.list({ statuses: ['applied'] }), new Date())) {
      jobs.transition(id, { status: 'ghosted', at: new Date().toISOString(), note: 'No reply in 21 days' });
    }
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
    };
  };
  const pushStatus = () => onStatus(getStatus());
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
    ...store,

    // Jobs and drafts come from SQLite; the send flow stays mock until PR-18.
    listJobs: later((filter = {}) => jobs.list(filter.statuses ? { statuses: filter.statuses } : undefined).filter((j) => matchesFilter(j, filter))),
    getJob: later(getJob),
    getDraft: later((jobId) => drafts.get(jobId) ?? null),
    updateCoverLetter: async (jobId, coverLetter) => {
      const draft = drafts.get(jobId);
      if (!draft) throw new Error(`No draft for job ${jobId}`);
      const next = { ...draft, coverLetter, edited: true };
      drafts.save(next);
      // What's on disk must match what gets sent, so the letter file follows the edit.
      const job = getJob(jobId);
      const folder = jobFolder(job);
      if (folder) writeFileSync(join(folder, letterName(next)), await letterFile(job, next));
      return next;
    },

    getProfile: later(profile.getProfile),
    saveFact: later(profile.saveFact),
    deleteFact: later(profile.deleteFact),
    saveAnswer: later(profile.saveAnswer),
    deleteAnswer: later(profile.deleteAnswer),
    savePreferences: later(profile.savePreferences),

    listSources: later(settings.listSources),
    updateSource: later(settings.updateSource),
    getSettings: later(settings.getSettings),
    // Engine, budget and interval all show in the status card, so a save pushes it.
    saveSettings: later((patch) => {
      const next = settings.saveSettings(patch);
      if (patch.launchAtLogin !== undefined) setLaunchAtLogin(patch.launchAtLogin);
      if (patch.aiEngine !== undefined) void checkEngine();
      pushStatus();
      return next;
    }),
    setSecret: later((key, value) => {
      const next = settings.setSecret(key, value);
      if (key === 'anthropicApiKey') void checkEngine();
      pushStatus();
      return next;
    }),

    approveDraft: (jobId) => approveDraft(jobId, applyPorts),

    markApplied: later((jobId) => {
      const job = getJob(jobId);
      if (!MANUAL_APPLY_FROM.has(job.status)) throw new Error(`Job ${jobId} cannot be marked applied from ${job.status}`);
      return applyPorts.transition(jobId, 'applied', { sentBy: 'you-manual' });
    }),

    skipJob: later((jobId) => {
      const job = getJob(jobId);
      if (!SKIPPABLE.has(job.status)) throw new Error(`Job ${jobId} is already ${job.status}, so it can't be skipped`);
      return applyPorts.transition(jobId, 'skipped');
    }),

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
      await checkReplies().catch((err: unknown) => console.error('[replies] inbox check failed', err));
    },

    sendFollowUp: (jobId, text) =>
      sendFollowUp(jobId, text, {
        job: getJob,
        sent: (id) => {
          const row = sends.get(id);
          return row?.state === 'sent' ? { subject: row.subject, ...(row.messageId ? { messageId: row.messageId } : {}) } : undefined;
        },
        sendEmail: (message) => gmail().send(message),
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

    // AI and Gmail are live checks. Telegram checks saved credentials; its live test comes with PR-22.
    testConnection: async (kind) => {
      if (kind === 'ai') {
        const { ready, message } = await checkEngine();
        return { ok: ready, message };
      }
      const { secretsSet, gmailAddress, telegramChatId } = settings.getSettings();
      if (kind === 'gmail') {
        if (!secretsSet.gmailAppPassword || !gmailAddress) return { ok: false, message: 'Missing credentials. Fill in the fields above first.' };
        try {
          await gmail().sendTest();
          return { ok: true, message: `Test email sent to ${gmailAddress}` };
        } catch (err) {
          return { ok: false, message: err instanceof Error ? err.message : String(err) };
        }
      }
      const ready = secretsSet.telegramBotToken && !!telegramChatId;
      if (!ready) return { ok: false, message: 'Missing credentials. Fill in the fields above first.' };
      return { ok: true, message: 'Credentials saved. A live test arrives with this integration.' };
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
