import type { RunSummary } from '../../shared/types';
import { formatClock } from './format';

/** What a finished scan produced, or why it fetched nothing. */
export function runResult(run: RunSummary): string {
  if (run.found === 0 && run.atLimit) return "Nothing was fetched: every source has used today's polls. They poll again tomorrow.";
  if (run.stopped) return `Scan stopped: ${run.passedFilters} job${run.passedFilters === 1 ? '' : 's'} passed your filters. Your next scan scores any it didn't.`;
  if (run.passedFilters === 0) return 'Scan finished: nothing new passed your filters.';
  const asked = run.asked ? ` ${run.asked} need${run.asked === 1 ? 's' : ''} your answers in the Inbox.` : '';
  return `Scan finished: ${run.passedFilters} job${run.passedFilters === 1 ? '' : 's'} passed your filters, ${run.drafted} drafted.${asked}`;
}

/** One-line summary of the last scan, for the Inbox header. */
export function runLine(run: RunSummary | undefined): string {
  if (!run) return 'No scans yet. Find jobs to fill the queue.';
  const when = `Last scan ${formatClock(run.at)}`;
  if (run.found === 0 && run.atLimit) return `${when} · every source has used today's polls; they poll again tomorrow`;
  // "New" is jobs no earlier run saw, dropped ones included, so the same filtered-out jobs aren't new every run.
  const line = `${when} · ${run.found} found · ${run.newAfterDedup} new · ${run.passedFilters} passed filters · ${run.drafted} drafted`;
  return run.atLimit ? `${line} · ${run.atLimit} source${run.atLimit === 1 ? '' : 's'} at today's limit` : line;
}
