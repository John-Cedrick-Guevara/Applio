import type { Job } from '../../../shared/types';
import { CHANNEL_LABEL } from '../../lib/labels';
import { queueState, sendsOnApprove } from './review-model';

interface ReviewQueueProps {
  jobs: Job[];
  currentId?: string;
  belowThreshold: number;
  draftThreshold: number;
}

/** "Waiting on you": one row per draft, linking to it. Manual-handoff channels get an amber chip. */
export function ReviewQueue({ jobs, currentId, belowThreshold, draftThreshold }: ReviewQueueProps) {
  return (
    <section className="card card-flush review-queue" aria-label="Queue">
      <div className="card-header">
        <h2 className="queue-title">Waiting on you</h2>
        <span className="cell-sub">Sorted by match</span>
      </div>
      <ul className="list-plain">
        {jobs.map((job) => (
          <li key={job.id}>
            <a
              href={`#/review/${job.id}`}
              className={['queue-row', job.status === 'skipped' && 'queue-row-skipped'].filter(Boolean).join(' ')}
              aria-current={job.id === currentId ? 'true' : undefined}
            >
              <div className="queue-row-top">
                <div className="queue-row-text">
                  <div className="queue-role">{job.title}</div>
                  <div className="cell-sub">{job.company} · {job.sourceName}</div>
                </div>
                <span className="queue-score mono">{job.score}</span>
              </div>
              <div className="queue-row-meta">
                <span className={sendsOnApprove(job.channel) ? 'badge badge-neutral' : 'badge badge-warning'}>
                  {job.platform ? job.applyTarget.split(' · ')[0] : CHANNEL_LABEL[job.channel]}
                </span>
                <span className="cell-sub">{queueState(job)}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
      {belowThreshold > 0 ? (
        <div className="queue-footer">
          {belowThreshold} more scored below your draft threshold ({draftThreshold}). <a href="#/applications">See all</a>
        </div>
      ) : null}
    </section>
  );
}
