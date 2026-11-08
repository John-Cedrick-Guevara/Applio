import { AppError } from '../../shared/errors';
import type { UsageStep } from '../../shared/types';
import { budgetTokens, type AiEngine, type AiReply } from './engine';

const WARN_AT = 0.8;

/** A token budget is used up (SPEC F10 hard stop). Nothing runs until it resets or the operator raises it. */
export class QuotaExceededError extends AppError {
  constructor(message: string) {
    super('quota_exceeded', message);
  }
}

export interface AiRequest {
  step: UsageStep;
  system?: string;
  prompt: string;
  runId?: number;
  /** The jobs this call is about: the tools' scope, and the usage row's job when there's one. */
  jobIds: readonly string[];
  /** False for a one-turn call that answers in text (scoring); Applio's tools are offered otherwise. */
  tools?: boolean;
}

/** One AI call's spend, as the usage table stores it (SPEC F10). */
export interface UsageEntry {
  at: string;
  step: UsageStep;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  /** What counts against the budget: see `budgetTokens`. */
  tokens: number;
  runId?: number;
  jobId?: string;
}

export interface AiPorts {
  /** The engine selected in Settings, read per call so switching applies at once. */
  engine: () => AiEngine;
  budgets: () => { daily: number; monthly: number };
  /** All recorded budget tokens at or after an ISO time. */
  tokensSince: (since: string) => number;
  /** The mean budget tokens of the step's last few calls, or undefined with no history: the pre-flight estimate. */
  recentCost: (step: UsageStep) => number | undefined;
  record: (entry: UsageEntry) => void;
  now: () => Date;
  /** The 80% warning, for the dashboard and (later) Telegram. */
  warn: (message: string) => void;
}

const fmt = (n: number) => n.toLocaleString('en-US');

/**
 * Every AI call goes through here: budget checks before, usage
 * recording and the 80% warning after. A call can overshoot the budget by its
 * own size (its cost isn't known until it returns), and the next one is refused.
 */
export function createAi(ports: AiPorts) {
  const periods = () => {
    const now = ports.now();
    const { daily, monthly } = ports.budgets();
    return [
      { name: 'daily', since: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), limit: daily, over: `Today's Claude token budget is used up`, which: "today's", resumes: 'tomorrow' },
      { name: 'monthly', since: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), limit: monthly, over: `This month's Claude token budget is used up`, which: "this month's", resumes: 'next month' },
    ];
  };

  const usage = () => periods().map((p) => ({ ...p, used: ports.tokensSince(p.since) }));
  const stopMessage = (p: ReturnType<typeof usage>[number]) => `${p.over} (${fmt(p.used)} of ${fmt(p.limit)}). AI resumes ${p.resumes}, or raise the budget in Settings.`;

  return {
    /** The hard-stop message when a budget is used up, else undefined (SPEC F10). */
    budgetStop(): string | undefined {
      const full = usage().find((p) => p.used >= p.limit);
      return full ? stopMessage(full) : undefined;
    },

    /**
     * @throws QuotaExceededError once a budget is used up.
     */
    async run(request: AiRequest): Promise<AiReply> {
      const before = usage();
      const full = before.find((p) => p.used >= p.limit);
      if (full) throw new QuotaExceededError(stopMessage(full));
      // Pre-flight: stop before a call that would go over, not after (QA: 95k used against a 60k cap).
      const estimate = ports.recentCost(request.step);
      const tight = estimate === undefined ? undefined : before.find((p) => p.used + estimate > p.limit);
      if (tight && estimate !== undefined) {
        throw new QuotaExceededError(
          `This call would go over ${tight.which} Claude token budget: about ${fmt(estimate)} tokens, with ${fmt(tight.limit - tight.used)} of ${fmt(tight.limit)} left. AI resumes ${tight.resumes}, or raise the budget in Settings.`,
        );
      }

      const reply = await ports.engine().complete({ system: request.system, prompt: request.prompt, jobIds: request.jobIds, ...(request.tools === false ? { tools: false } : {}) });
      ports.record({
        at: ports.now().toISOString(),
        step: request.step,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
        cacheReadTokens: reply.cacheReadTokens ?? 0,
        tokens: budgetTokens(reply),
        ...(request.runId !== undefined ? { runId: request.runId } : {}),
        ...(request.jobIds.length === 1 ? { jobId: request.jobIds[0] } : {}),
      });

      for (const p of before) {
        const after = ports.tokensSince(p.since) / p.limit;
        if (p.used / p.limit < WARN_AT && after >= WARN_AT) {
          ports.warn(`Claude tokens: ${Math.floor(after * 100)}% of the ${p.name} budget used. AI stops at 100%.`);
        }
      }
      return reply;
    },
  };
}
