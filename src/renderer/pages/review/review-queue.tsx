import { useState, type KeyboardEvent } from 'react';
import type { Job } from '../../../shared/types';
import { buttonClass } from '../../components/button';
import { CHANNEL_LABEL } from '../../lib/labels';
import { navigate } from '../../lib/router';
import { pendingReason } from '../../lib/job-progress';
import { queueGroups, queueState, sendsOnApprove, type QueueFilter, type QueueGroup } from './review-model';

interface ReviewQueueProps {
  jobs: Job[];
  currentId?: string;
  /** Jobs scored below the draft bar, best first: shown on request, never drafted unless asked. */
  below: Job[];
  /** Jobs not scored yet; the next scan scores them. */
  waiting: Job[];
  /** Strong matches with no draft yet, one click from one. */
  toDraft: Job[];
  /** Jobs where Claude asked questions before drafting. */
  asking: Job[];
  /** Jobs Claude is drafting right now in the background. */
  drafting: Job[];
  draftThreshold: number;
}

const FILTERS: { id: QueueFilter | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'attention', label: 'Needs you' },
  { id: 'send', label: 'Send' },
  { id: 'handoff', label: 'Hand off' },
];

/** At or past this many drafts with a low draft bar, the queue suggests raising it. */
const CROWDED = 12;
const LOW_DRAFT_SCORE = 50;

/** ↑ and ↓ move between queue rows and open the one they land on, like a mail list. */
function moveSelection(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLAnchorElement>('a.queue-row')];
  const at = rows.indexOf(document.activeElement as HTMLAnchorElement);
  if (at < 0) return;
  e.preventDefault();
  const next = rows[Math.min(rows.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)))]!;
  next.focus();
  navigate(next.getAttribute('href')!.replace(/^#/, ''));
}

/**
 * "Waiting on you", grouped by what the operator does next (needs you, send, hand
 * off) with a filter for each, two-line rows, and badges only for exceptions. The
 * list scrolls inside its card, so a long queue never pushes the draft out of view.
 */
export function ReviewQueue({ jobs, currentId, below, waiting, asking, drafting, toDraft, draftThreshold }: ReviewQueueProps) {
  const [filter, setFilter] = useState<QueueFilter | 'all'>('all');
  const [showBelow, setShowBelow] = useState(false);
  const [showWaiting, setShowWaiting] = useState(false);
  const groups = queueGroups(jobs, asking, drafting, toDraft);
  const count = (f: QueueFilter | 'all') => groups.filter((g) => f === 'all' || g.filter === f).reduce((n, g) => n + g.jobs.length, 0);
  const shown = groups.filter((g) => filter === 'all' || g.filter === filter);
  const drafted = groups.filter((g) => g.key === 'send' || g.key === 'handoff').reduce((n, g) => n + g.jobs.length, 0);

  return (
    <section className="card card-flush review-queue" aria-label="Queue" onKeyDown={moveSelection}>
      <div className="card-header queue-head">
        <h2 className="queue-title">Waiting on you <span className="queue-count">{count('all')}</span></h2>
        <div className="queue-filters" role="group" aria-label="Show">
          {FILTERS.filter((f) => f.id === 'all' || count(f.id) > 0).map((f) => (
            <button key={f.id} type="button" className="queue-filter" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} <span className="queue-filter-count">{count(f.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {drafted >= CROWDED && draftThreshold < LOW_DRAFT_SCORE ? (
        <p className="queue-hint">
          Your draft bar is {draftThreshold}, so almost every match gets a draft. <a href="#/settings">Raise it in Settings</a> to see only strong matches.
        </p>
      ) : null}

      <div className="queue-scroll">
        {shown.map((g) => <Group key={g.key} group={g} currentId={currentId} />)}
        {shown.length === 0 ? <p className="queue-empty cell-sub">Nothing here right now.</p> : null}

        {filter === 'all' && waiting.length > 0 ? (
          <div className="queue-footer">
            {waiting.length} not scored yet; your next scan scores {waiting.length === 1 ? 'it' : 'them'}.{' '}
            <button type="button" className={buttonClass('link', 'sm', 'queue-footer-action')} aria-expanded={showWaiting} aria-label={showWaiting ? 'Hide waiting jobs' : 'Show waiting jobs'} onClick={() => setShowWaiting((s) => !s)}>
              {showWaiting ? 'Hide them' : 'Show them'}
            </button>
            {showWaiting ? (
              <ul className="list-plain below-list">
                {waiting.map((job) => (
                  <li key={job.id}>
                    <a href={`#/review/${job.id}`} className="below-row" aria-current={job.id === currentId ? 'true' : undefined}>
                      <span>{job.title}<span className="cell-sub"> · {job.company}</span><span className="cell-sub waiting-reason">{pendingReason(job)}</span></span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {filter === 'all' && below.length > 0 ? (
          <div className="queue-footer">
            {below.length} more scored below your draft bar ({draftThreshold}).{' '}
            <button type="button" className={buttonClass('link', 'sm', 'queue-footer-action')} aria-expanded={showBelow} onClick={() => setShowBelow((s) => !s)}>
              {showBelow ? 'Hide them' : 'Show them'}
            </button>
            {showBelow ? (
              <ul className="list-plain below-list">
                {below.map((job) => (
                  <li key={job.id}>
                    <a href={`#/review/${job.id}`} className="below-row" aria-current={job.id === currentId ? 'true' : undefined}>
                      <span className="queue-score mono">{job.score}</span>
                      <span>{job.title}<span className="cell-sub"> · {job.company} · {job.sourceName}</span></span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** One group: a header with its count, then its rows. */
function Group({ group, currentId }: { group: QueueGroup; currentId?: string }) {
  return (
    <>
      <div className="queue-group-label">{group.label} ({group.jobs.length})</div>
      <ul className="list-plain" aria-label={group.label}>
        {group.jobs.map((job) => <QueueRow key={job.id} job={job} group={group.key} currentId={currentId} />)}
      </ul>
    </>
  );
}

/**
 * A two-line row: title and score, then company and channel. A badge shows only
 * when something is off the normal path (a failed send, Claude's questions, a
 * suspicious post, a skip); the group already says what the rest are waiting for.
 */
function QueueRow({ job, group, currentId }: { job: Job; group: QueueGroup['key']; currentId?: string }) {
  const channel = job.platform ? job.applyTarget.split(' · ')[0] : CHANNEL_LABEL[job.channel];
  const badge =
    group === 'unsent' ? <span className={sendsOnApprove(job.channel) ? 'badge badge-danger' : 'badge badge-warning'}>{queueState(job)}</span>
    : group === 'asking' ? <span className="badge badge-warning">Claude has questions</span>
    : job.suspicious ? <span className="badge badge-danger" title={job.suspicious}>Check post</span>
    : job.status === 'skipped' ? <span className="badge badge-neutral">Skipped</span>
    : null;
  return (
    <li>
      <a
        href={`#/review/${job.id}`}
        className={['queue-row', job.status === 'skipped' && 'queue-row-skipped'].filter(Boolean).join(' ')}
        aria-current={job.id === currentId ? 'true' : undefined}
        aria-busy={group === 'drafting' || undefined}
      >
        <div className="queue-row-top">
          <span className="queue-role" title={job.title}>{job.title}</span>
          <span className="queue-score mono">{job.score}</span>
        </div>
        <div className="queue-row-sub cell-sub">
          {group === 'drafting' ? <span className="spinner" aria-hidden="true" /> : null}
          <span className="queue-row-where">{job.company} · {group === 'drafting' ? 'Claude is drafting…' : channel}</span>
          {badge}
        </div>
      </a>
    </li>
  );
}
