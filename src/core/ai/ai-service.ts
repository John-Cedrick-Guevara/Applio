import { AppError } from '../../shared/errors';
import type { UsageStep } from '../../shared/types';
import { AutomationPausedError } from '../jobs/scheduler';
import type { AiEngine, AiReply } from './engine';

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
  jobId?: string;
  /** Scheduled work stops while automation is paused; what the operator asks for still runs (MNB-1). */
  trigger: 'scheduled' | 'operator';
}

/** One AI call's spend, as the usage table stores it (SPEC F10). */
export interface UsageEntry {
  at: string;
  step: UsageStep;
  inputTokens: number;
  outputTokens: number;
  runId?: number;
  jobId?: string;
}

export interface AiPorts {
  /** The engine selected in Settings, read per call so switching applies at once. */
  engine: () => AiEngine;
  budgets: () => { daily: number; monthly: number };
  /** All recorded tokens at or after an ISO time. */
  tokensSince: (since: string) => number;
  record: (entry: UsageEntry) => void;
  isPaused: () => boolean;
  now: () => Date;
  /** The 80% warning, for the dashboard and (later) Telegram. */
  warn: (message: string) => void;
}

const fmt = (n: number) => n.toLocaleString('en-US');

/**
 * Every AI call goes through here: pause and budget checks before, usage
 * recording and the 80% warning after. A call can overshoot the budget by its
 * own size (its cost isn't known until it returns), and the next one is refused.
 */
export function createAi(ports: AiPorts) {
  const periods = () => {
    const now = ports.now();
    const { daily, monthly } = ports.budgets();
    return [
      { name: 'daily', since: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), limit: daily, over: `Today's Claude token budget is used up`, resumes: 'tomorrow' },
      { name: 'monthly', since: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), limit: monthly, over: `This month's Claude token budget is used up`, resumes: 'next month' },
    ];
  };

  return {
    /**
     * @throws AutomationPausedError for scheduled work while paused.
     * @throws QuotaExceededError once a budget is used up.
     */
    async run(request: AiRequest): Promise<AiReply> {
      if (request.trigger === 'scheduled' && ports.isPaused()) throw new AutomationPausedError();
      const before = periods().map((p) => ({ ...p, used: ports.tokensSince(p.since) }));
      const full = before.find((p) => p.used >= p.limit);
      if (full) throw new QuotaExceededError(`${full.over} (${fmt(full.used)} of ${fmt(full.limit)}). AI resumes ${full.resumes}, or raise the budget in Settings.`);

      const reply = await ports.engine().complete({ system: request.system, prompt: request.prompt });
      ports.record({
        at: ports.now().toISOString(),
        step: request.step,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
        ...(request.runId !== undefined ? { runId: request.runId } : {}),
        ...(request.jobId !== undefined ? { jobId: request.jobId } : {}),
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
