import type { ApplioApi } from '../api';
import { matchesFilter } from '../job-filter';
import { capAutonomy } from '../autonomy';
import { nextStatuses } from '../status';
import type { AppStatus, Job, JobStatus, SecretKey } from '../types';
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
}

/**
 * In-memory backend used by the browser dev build, tests, and (until the SQLite
 * services land) the Electron main process. It enforces the same rules the real
 * main process will (status flow, channel caps, write-only secrets) so UI bugs
 * surface here rather than after integration.
 */
export function createMockApi({ latencyMs = 250, now = () => new Date() }: MockOptions = {}): ApplioApi {
  const start = now();
  const jobs = seedJobs(start);
  const drafts = seedDrafts(jobs, start);
  const profile = seedProfile(start);
  const sources = seedSources(start);
  let settings = seedSettings();
  let paused = false;
  let lastRun = seedLastRun(start);
  const secrets = new Map<SecretKey, string>();
  let nextId = 1000;

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
        if (job.status !== 'drafted') throw new Error(`Job ${jobId} is not awaiting approval`);
        transition(job, 'approved');
        // Approval sends only where the channel can send on its own (SPEC F5).
        const canSend = capAutonomy('autonomous', job.channel) === 'autonomous';
        if (!canSend) return job;
        job.sentBy = 'you-app';
        return transition(job, 'applied');
      }),

    skipJob: (jobId) => run(() => transition(findJob(jobId), 'skipped')),

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
    chooseFolder: () => respond('~/JobApps'),
    openOutputFolder: () => respond(undefined),

    analyzeJob: (input) =>
      run(() => {
        if (!input.value.trim()) throw new Error('Paste a job post or link first');
        return analyze(input.value);
      }),

    addJob: (preview) =>
      run(() => {
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

    saveSettings: (patch) => run(() => (settings = { ...settings, ...patch })),

    setSecret: (key, value) =>
      run(() => {
        secrets.set(key, value);
        settings = { ...settings, secretsSet: { ...settings.secretsSet, [key]: value.length > 0 } };
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
