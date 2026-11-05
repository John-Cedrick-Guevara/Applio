import type { Job } from '../../shared/types';
import { BOARD_CREDITS } from '../../shared/attribution';

/**
 * "via <board>": boards that ask for credit get their name linked to the job on
 * their site (it opens in the system browser); other sources are named plainly.
 */
export function SourceCredit({ job }: { job: Pick<Job, 'sourceId' | 'sourceName' | 'url'> }) {
  const board = BOARD_CREDITS[job.sourceId];
  if (!board) return <>via {job.sourceName}</>;
  return (
    <>
      via{' '}
      <a href={job.url} target="_blank" rel="noopener">
        {board}
      </a>
    </>
  );
}
