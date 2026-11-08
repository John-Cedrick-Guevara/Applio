import { capAutonomy } from '../../shared/autonomy';
import type { Autonomy, Job } from '../../shared/types';
import { companyKey } from '../triage/words';

/** Everything the gate needs besides the job itself. */
export interface AutoSendContext {
  /** The source's autonomy, already capped by the source's own ceiling. */
  sourceAutonomy: Autonomy;
  autoSendThreshold: number;
  blocklist: readonly string[];
  paused: boolean;
  /** Set when the AI budget hard stop is reached (SPEC F10): nothing goes out on its own then. */
  budgetStop?: string;
}

const NEVER = { platform: 'Platform jobs are never sent automatically.', custom: 'Career-site jobs are never sent automatically.' } as const;

/**
 * Why a drafted job may not be sent without the operator (SPEC F6), or undefined
 * when every gate passes. The daily caps and the double-send guard are checked
 * again by the send itself.
 */
export function autoSendBlock(job: Pick<Job, 'channel' | 'score' | 'company' | 'platform' | 'suspicious'>, c: AutoSendContext): string | undefined {
  if (job.channel === 'platform' || job.channel === 'custom') return NEVER[job.channel];
  if (job.platform === 'Upwork') return 'Upwork proposals are never sent automatically.';
  if (capAutonomy(c.sourceAutonomy, job.channel) !== 'autonomous') return 'Its source is set to Draft → Approve.';
  if (c.paused) return 'Automation is paused.';
  if (job.suspicious) return `${job.suspicious} Suspicious posts are never sent automatically.`;
  if (c.budgetStop) return c.budgetStop;
  if ((job.score ?? 0) < c.autoSendThreshold) return `Its match score (${job.score ?? 0}) is below the auto-send score (${c.autoSendThreshold}).`;
  if (c.blocklist.some((b) => companyKey(b) === companyKey(job.company))) return `${job.company} is on your blocklist.`;
  return undefined;
}

/**
 * Sends a freshly drafted job on its own when the gate allows (SPEC F6). A held
 * job stays drafted, so it stays in Review; jobs from autonomous sources get the
 * reason on their timeline, since the operator expected them to go out.
 */
export async function autoSend(
  job: Job,
  context: AutoSendContext,
  ports: { send: (jobId: string) => Promise<Job>; note: (jobId: string, text: string) => void },
): Promise<'sent' | 'held'> {
  const expected = context.sourceAutonomy === 'autonomous';
  const reason = autoSendBlock(job, context);
  if (reason) {
    if (expected) ports.note(job.id, `Not sent automatically: ${reason}`);
    return 'held';
  }
  try {
    await ports.send(job.id);
    return 'sent';
  } catch (err) {
    ports.note(job.id, `Not sent automatically: ${err instanceof Error ? err.message : String(err)}`);
    return 'held';
  }
}
