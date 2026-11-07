import { capAutonomy, maxAutonomyFor } from '../../../shared/autonomy';
import type { ApplyChannel, Autonomy, Job, RunSummary } from '../../../shared/types';
import { formatClock } from '../../lib/format';
import { AUTONOMY_LABEL } from '../../lib/labels';

/** True when approving sends straight away (email, standard ATS); otherwise the operator applies (SPEC F5). */
export function sendsOnApprove(channel: ApplyChannel): boolean {
  return maxAutonomyFor(channel) === 'autonomous';
}

/** Label and behavior of the draft's main button. */
export function primaryAction(job: Job): { label: string; handoff: boolean } {
  if (job.channel === 'email') return { label: 'Approve & send email', handoff: false };
  if (job.channel === 'ats') return { label: 'Approve & submit form', handoff: false };
  return { label: 'Open handoff', handoff: true };
}

/** Short status shown under each queue row. */
export function queueState(job: Job): string {
  if (job.status === 'skipped') return 'Skipped';
  if (job.status !== 'drafted') return 'Sent';
  return sendsOnApprove(job.channel) ? 'Draft ready' : 'Ready to hand off';
}

/** What automation may do with this job: its source's autonomy, capped by channel. */
export function modeLabel(job: Job, sourceAutonomy: Autonomy): string {
  return sendsOnApprove(job.channel) ? AUTONOMY_LABEL[capAutonomy(sourceAutonomy, job.channel)] : 'Manual handoff';
}

/** Why a job is still waiting: its last failure note, or what's left to do. */
export function pendingReason(job: Pick<Job, 'status' | 'history'>): string {
  return job.history.findLast((e) => e.note)?.note ?? (job.status === 'found' ? 'Not scored yet' : 'Not drafted yet');
}

/** One-line summary of the last discovery run for the Review header. */
export function runLine(run: RunSummary | undefined): string {
  if (!run) return 'No runs yet. Run discovery to fill the queue.';
  const when = `Last run ${formatClock(run.at)}`;
  if (run.found === 0 && run.atLimit) return `${when} · every source has used today's polls; they poll again tomorrow`;
  // Jobs dropped by filters aren't stored, so "not yet in Applio" counts them again each run.
  const line = `${when} · ${run.found} found · ${run.newAfterDedup} not yet in Applio · ${run.passedFilters} passed filters · ${run.drafted} drafted`;
  return run.atLimit ? `${line} · ${run.atLimit} source${run.atLimit === 1 ? '' : 's'} at today's limit` : line;
}

/** Confirmation shown after an approved draft goes out. */
export function sentLine(job: Job): string {
  const at = job.history.findLast((e) => e.status === 'applied')?.at;
  const when = at ? ` at ${formatClock(at)}` : '';
  const where = job.channel === 'email' ? `Sent to ${job.applyTarget}${when}.` : `Form submitted${when}.`;
  return job.folderPath ? `${where} Saved to ${job.folderPath.split('/').slice(0, 3).join('/')}.` : where;
}
