import type { Job } from '../../shared/types';

/** Why a job is still waiting: its last failure note, or what's left to do. */
export function pendingReason(job: Pick<Job, 'status' | 'history'>): string {
  return job.history.findLast((e) => e.note)?.note ?? (job.status === 'found' ? 'Not scored yet' : 'Not drafted yet');
}

/**
 * Whether a draft's PDFs are on disk. Claude marks a job drafted mid-turn and the files
 * are printed after, so a fresh draft shows "saving" (Approve waits) rather than letting
 * a click fail; a failed save shows its reason.
 */
export function filesState(job: Pick<Job, 'folderPath' | 'history'>): { kind: 'ready' } | { kind: 'saving' } | { kind: 'failed'; reason: string } {
  if (job.folderPath) return { kind: 'ready' };
  const failed = job.history.findLast((e) => e.note?.startsWith("Couldn't save the files"))?.note;
  return failed ? { kind: 'failed', reason: failed } : { kind: 'saving' };
}
