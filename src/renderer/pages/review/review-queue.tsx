import { useState } from 'react';
import type { Job } from '../../../shared/types';
import { CHANNEL_LABEL } from '../../lib/labels';
import { queueState, sendsOnApprove } from './review-model';

interface ReviewQueueProps {
  jobs: Job[];
  currentId?: string;
  /** Jobs scored below the draft threshold, best first: shown on request, never drafted. */
  below: Job[];
  draftThreshold: number;
}

/** "Waiting on you": one row per draft, linking to it. Manual-handoff channels get an amber chip. */
export function ReviewQueue({ jobs, currentId, below, draftThreshold }: ReviewQueueProps) {
  const [showBelow, setShowBelow] = useState(false);
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
      {below.length > 0 ? (
        <div className="queue-footer">
          {below.length} more scored below your draft threshold ({draftThreshold}).{' '}
          <button type="button" className="link-button" aria-expanded={showBelow} onClick={() => setShowBelow((s) => !s)}>
            {showBelow ? 'Hide them' : 'Show them'}
          </button>
          {showBelow ? (
            <ul className="list-plain below-list">
              {below.map((job) => (
                <li key={job.id}>
                  {/* The posting opens in the system browser (the window refuses to navigate away). */}
                  <a href={job.url || undefined} target="_blank" rel="noreferrer" className="below-row">
                    <span className="queue-score mono">{job.score}</span>
                    <span>{job.title}<span className="cell-sub"> · {job.company}</span></span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
