import type { ApplioApi } from '../api';
import { matchesFilter } from '../job-filter';
import { capAutonomy } from '../autonomy';
import { nextStatuses } from '../status';
import type { AppStatus, Job, JobStatus, OpenQuestions, SecretKey, SendRecord } from '../types';
import {
  seedLastRun,
  seedDrafts,
  seedJobs,
  seedProfile,
  seedSettings,
  seedSources,
  seedUsage,
} from './fixtures';
import { analyze } from './analyze';

interface MockOptions {
  /** Simulated round-trip so loading states are visible in dev. */
  latencyMs?: number;
  now?: () => Date;
  /**
   * Plays Gmail or the form refusing a send: return a reason and the next send fails
   * the way the real backend's does (approved, noted "Not sent: …", rejected).
   */
  sendFailure?: () => string | undefined;
  /** Plays Gmail or Telegram refusing the saved credentials when Applio signs in to check them. */
  signInFailure?: (kind: 'gmail' | 'telegram') => string | undefined;
}

/**
 * In-memory backend used by the browser dev build, tests, and (until the SQLite
 * services land) the Electron main process. It enforces the same rules the real
 * main process will (status flow, channel caps, write-only secrets) so UI bugs
 * surface here rather than after integration.
 */
export function createMockApi({ latencyMs = 250, now = () => new Date(), sendFailure = () => undefined, signInFailure = () => undefined }: MockOptions = {}): ApplioApi {
  const start = now();
  const jobs = seedJobs(start);
  const drafts = seedDrafts(jobs, start);
  const profile = seedProfile(start);
  const sources = seedSources(start);
  let settings = seedSettings();
  let paused = false;
  let openQuestions: OpenQuestions[] = [];
  let lastRun = seedLastRun(start);
  const secrets = new Map<SecretKey, string>();
  let nextId = 1000;

  /** What "went out" for each job Applio sent, like the real send log; manual applications have none. */
  const sends = new Map<string, SendRecord>();
  const recordSend = (job: Job, at: string) => {
    const draft = drafts.find((d) => d.jobId === job.id);
    const subject = settings.fullName ? `Application: ${job.title} — ${settings.fullName}` : `Application: ${job.title}`;
    sends.set(job.id, { state: 'sent', channel: job.channel, to: job.applyTarget, subject: draft?.subject ?? subject, body: draft?.coverLetter ?? '', attachments: ['resume.pdf'], at });
  };
  for (const job of jobs) {
    const at = job.history.find((e) => e.status === 'applied')?.at;
    if (at && job.sentBy && job.sentBy !== 'you-manual') recordSend(job, at);
  }

  /** Resolves a deep copy after the simulated latency — callers never share store references. */
  const respond = <T>(value: T): Promise<T> =>
    new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), latencyMs));

  const fail = (message: string): Promise<never> =>
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), latencyMs));

  const findJob = (id: string): Job => {
    const job = jobs.find((j) => j.id === id);
    if (!job) throw new Error(`Job ${id} not found`);
    return job;
  };

  /** Appends a history event and moves the job — the single place status changes. */
  const transition = (job: Job, status: JobStatus, note?: string): Job => {
    job.status = status;
    job.history.push({ status, at: now().toISOString(), note });
    return job;
  };

  /** Engine/scheduler snapshot; the next run is the next 6-hour slot (SPEC F2). */
  const status = (): AppStatus => {
    const next = new Date(now());
    next.setHours(Math.ceil((next.getHours() + 1) / 6) * 6, 0, 0, 0);
    return {
      engine: settings.aiEngine,
      engineReady: settings.aiEngine === 'claude-code' || settings.secretsSet.anthropicApiKey,
      paused,
      nextRunAt: paused ? undefined : next.toISOString(),
      tokensToday: seedUsage(start, 'today').summary.tokens,
      dailyTokenBudget: settings.dailyTokenBudget,
      lastRun,
    };
  };

  /** Like main: signs in once both parts of a connection are saved and records how it went, dropping any older result. */
  const verify = (kind: 'gmail' | 'telegram') => {
    const { [kind]: _old, ...checks } = settings.checks;
    const complete = kind === 'gmail' ? !!settings.gmailAddress && settings.secretsSet.gmailAppPassword : !!settings.telegramChatId && settings.secretsSet.telegramBotToken;
    const refused = complete ? signInFailure(kind) : undefined;
    const at = now().toISOString();
    settings = { ...settings, checks: complete ? { ...checks, [kind]: refused ? { ok: false, at, message: refused } : { ok: true, at, message: 'Signed in.' } } : checks };
  };

  /** Wraps a sync mutation so thrown domain errors become rejected promises. */
  const run = <T>(fn: () => T): Promise<T> => {
    try {
      return respond(fn());
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  };

  return {
    listJobs: (filter = {}) =>
      respond(
        jobs
          .filter((j) => matchesFilter(j, filter))
          .sort((a, b) => b.history.at(-1)!.at.localeCompare(a.history.at(-1)!.at)),
      ),

    getJob: (id) => run(() => findJob(id)),

    getDraft: (jobId) => respond(drafts.find((d) => d.jobId === jobId) ?? null),
    getSend: (jobId) => respond(sends.get(jobId) ?? null),

    updateCoverLetter: (jobId, coverLetter) =>
      run(() => {
        const draft = drafts.find((d) => d.jobId === jobId);
        if (!draft) throw new Error(`No draft for job ${jobId}`);
        draft.coverLetter = coverLetter;
        draft.edited = true;
        return draft;
      }),

    approveDraft: (jobId) =>
      run(() => {
        const job = findJob(jobId);
        if (job.status !== 'drafted' && job.status !== 'approved') throw new Error(`Job ${jobId} is not awaiting approval`);
        // Approval sends only where the channel can send on its own (SPEC F5).
        const canSend = capAutonomy('autonomous', job.channel) === 'autonomous';
        // Like the real backend: missing setup refuses before the status changes.
        if (canSend && job.channel === 'email' && (!settings.gmailAddress || !settings.secretsSet.gmailAppPassword)) {
          throw new Error('Set up Gmail in Settings first: your address and an app password.');
        }
        if (job.status === 'drafted') transition(job, 'approved');
        if (!canSend) return job;
        const refused = sendFailure();
        if (refused) {
          job.history.push({ status: job.status, at: now().toISOString(), note: `Not sent: ${refused}` });
          throw new Error(refused);
        }
        job.sentBy = 'you-app';
        const applied = transition(job, 'applied');
        recordSend(applied, applied.history.at(-1)!.at);
        return applied;
      }),

    skipJob: (jobId) => run(() => transition(findJob(jobId), 'skipped')),

    // The mock drafts at once; main drafts in the background and reports it in `drafting`.
    draftJob: (jobId) =>
      run(() => {
        const job = findJob(jobId);
        if (job.status !== 'scored') throw new Error('Only scored jobs can be drafted. This one is already drafted, sent or dismissed.');
        const drafted = transition(job, 'drafted', 'Drafted at your request');
        if (!drafts.some((d) => d.jobId === jobId)) drafts.push({ ...seedDrafts([drafted], now())[0]! });
        return drafted;
      }),

    markApplied: (jobId) =>
      run(() => {
        const job = findJob(jobId);
        if (!['drafted', 'approved', 'scored'].includes(job.status)) {
          throw new Error(`Job ${jobId} cannot be marked applied from ${job.status}`);
        }
        job.sentBy = 'you-manual';
        return transition(job, 'applied');
      }),

    setStatus: (jobId, status, note) =>
      run(() => {
        const job = findJob(jobId);
        if (!nextStatuses(job.status).includes(status)) {
          throw new Error(`Cannot move job from ${job.status} to ${status}`);
        }
        return transition(job, status, note);
      }),

    sendFollowUp: (jobId, text) =>
      run(() => {
        const job = findJob(jobId);
        if (job.status !== 'applied') throw new Error('Follow-ups go only to applications still waiting on a reply');
        if (!text.trim()) throw new Error('Write the follow-up first');
        job.history.push({ status: 'applied', at: now().toISOString(), note: 'Follow-up sent' });
        return job;
      }),

    getInterviewPrep: (jobId) =>
      run(() => {
        const job = findJob(jobId);
        return {
          told: job.strengths.length ? job.strengths.slice(0, 2) : ['Cut invoicing p95 from 900 ms to 120 ms', 'Built usage metering on SQS with idempotent consumers'],
          likelyQuestions: [
            'Walk through the design of your strongest project and its failure modes',
            ...job.gaps.map((g) => `How would you close this gap: ${g.toLowerCase()}?`),
            'How do you work across time zones?',
          ],
          askThem: [`What breaks most often at ${job.company} today?`],
          tokens: 2_400,
        };
      }),

    getStatus: () => respond(status()),

    runDiscovery: () =>
      run(() => {
        if (paused) throw new Error('Automation is paused. Resume it to run discovery');
        lastRun = { at: now().toISOString(), found: 14, newAfterDedup: 11, passedFilters: 2, drafted: 0 };
        return lastRun;
      }),

    setAutomationPaused: (next) =>
      run(() => {
        paused = next;
        return status();
      }),

    // OS methods are no-ops here; Electron main and the browser dev build swap in real ones.
    openExternal: () => respond(undefined),
    openJobFolder: () => respond(undefined),
    openDraftFile: () => respond(undefined),
    assistFill: () => respond({ filled: 6, missing: ['Current company'] }),
    chooseFolder: () => respond('~/JobApps'),
    openOutputFolder: () => respond(undefined),

    analyzeJob: (input) =>
      run(() => {
        if (!input.value.trim()) throw new Error('Paste a job post or link first');
        const preview = analyze(input.value);
        // Like main's dedup key, roughly: same company and title means the same job.
        const same = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]/g, '') === b.toLowerCase().replace(/[^a-z0-9]/g, '');
        const dupe = jobs.find((j) => same(j.company, preview.company) && same(j.title, preview.title));
        return dupe ? { ...preview, duplicate: { jobId: dupe.id, status: dupe.status } } : preview;
      }),

    addJob: (preview) =>
      run(() => {
        if (preview.duplicate) throw new Error(`${preview.title} at ${preview.company} is already in Applio (${preview.duplicate.status}).`);
        const id = `j${nextId++}`;
        const job: Job = {
          id, sourceId: 'clip', sourceName: preview.sourceName, company: preview.company, title: preview.title,
          url: preview.channel === 'platform' ? 'https://www.linkedin.com/jobs/' : 'https://example.com', location: 'Remote',
          employmentType: 'contract', postedAt: now().toISOString(), status: 'drafted', channel: preview.channel ?? 'custom',
          description: preview.summary, score: preview.score, roleSummary: preview.summary, tags: preview.tags, strengths: [], gaps: [],
          applyTarget: preview.applyTarget, factsUsed: 8, tokensUsed: preview.tokensUsed,
          history: ['found', 'scored', 'drafted'].map((status) => ({ status: status as JobStatus, at: now().toISOString() })),
        };
        jobs.push(job);
        drafts.push({ ...seedDrafts([job], now())[0]! });
        return job;
      }),

    getProfile: () => respond(profile),

    saveFact: (input) =>
      run(() => {
        const existing = input.id ? profile.facts.find((f) => f.id === input.id) : undefined;
        if (existing) return Object.assign(existing, input);
        if (!input.text.trim()) throw new Error('Write the fact first');
        const fact = { ...input, id: `f${nextId++}`, tags: [], timesUsed: 0 };
        profile.facts.unshift(fact);
        return fact;
      }),

    deleteFact: (id) =>
      run(() => {
        profile.facts = profile.facts.filter((f) => f.id !== id);
      }),

    saveAnswer: (input) =>
      run(() => {
        const existing = input.id ? profile.answers.find((a) => a.id === input.id) : undefined;
        if (existing) return Object.assign(existing, input);
        if (!input.question.trim() || !input.answer.trim()) throw new Error('Fill in both the question and the answer');
        const answer = { ...input, id: `a${nextId++}`, origin: 'you' as const, timesReused: 0 };
        profile.answers.unshift(answer);
        return answer;
      }),

    deleteAnswer: (id) =>
      run(() => {
        profile.answers = profile.answers.filter((a) => a.id !== id);
      }),

    savePreferences: (preferences) => run(() => (profile.preferences = preferences)),

    listQuestions: () => respond(openQuestions),

    answerQuestions: (jobId, answers) =>
      run(() => {
        if (!openQuestions.some((q) => q.jobId === jobId)) throw new Error('There are no open questions for this job.');
        for (const a of answers) {
          if (a.saveTo) profile.facts.push({ id: `f${profile.facts.length + 100}`, group: a.saveTo, text: a.answer, tags: [], timesUsed: 0 });
        }
        openQuestions = openQuestions.filter((q) => q.jobId !== jobId);
        return transition(findJob(jobId), 'drafted', `You answered ${answers.length} questions`);
      }),

    saveContact: (contact) => run(() => (profile.contact = contact)),

    saveFactGroup: (group) =>
      run(() => {
        if (!profile.factGroups.some((g) => g.name === group.name)) throw new Error('That section no longer exists. Reload Profile and try again.');
        profile.factGroups = profile.factGroups.map((g) => (g.name === group.name ? group : g));
        return profile.factGroups;
      }),

    importResume: () =>
      run(() => {
        const suggestions = [
          { group: '[Previous Company] — Senior Software Engineer', text: 'Cut monthly AWS spend by 30% by right-sizing ECS tasks.' },
          { group: 'Projects', text: 'Maintain an open-source CLI for PostgreSQL migrations.' },
        ];
        profile.referenceResume = { fileName: 'resume.pdf', uploadedAt: now().toISOString(), factsFound: suggestions.length };
        return { resume: profile.referenceResume, suggestions };
      }),

    listSources: () => respond(sources),

    updateSource: (id, patch) =>
      run(() => {
        const source = sources.find((s) => s.id === id);
        if (!source) throw new Error(`Source ${id} not found`);
        if (patch.autonomy === 'autonomous' && source.maxAutonomy && source.maxAutonomy !== 'autonomous') {
          throw new Error(`${source.name} is never autonomous`);
        }
        return Object.assign(source, patch);
      }),

    getUsage: (period) => respond(seedUsage(start, period)),

    getSettings: () => respond(settings),

    saveSettings: (patch) =>
      run(() => {
        settings = { ...settings, ...patch };
        if (patch.gmailAddress !== undefined) verify('gmail');
        if (patch.telegramChatId !== undefined) verify('telegram');
        return settings;
      }),

    setSecret: (key, value) =>
      run(() => {
        secrets.set(key, value);
        settings = { ...settings, secretsSet: { ...settings.secretsSet, [key]: value.length > 0 } };
        if (key === 'gmailAppPassword') verify('gmail');
        if (key === 'telegramBotToken') verify('telegram');
        return settings;
      }),

    testConnection: (kind) =>
      run(() => {
        const ready =
          kind === 'gmail' ? settings.secretsSet.gmailAppPassword && !!settings.gmailAddress
          : kind === 'telegram' ? settings.secretsSet.telegramBotToken && !!settings.telegramChatId
          : settings.aiEngine === 'claude-code' || settings.secretsSet.anthropicApiKey;
        if (!ready) return { ok: false, message: kind === 'ai' ? 'Add your Anthropic API key below.' : 'Missing credentials. Fill in the fields above first.' };
        const message = kind === 'gmail' ? `Test email sent to ${settings.gmailAddress}` : kind === 'telegram' ? 'Test message delivered to Telegram' : 'Engine is ready';
        return { ok: true, message };
      }),
  };
}
