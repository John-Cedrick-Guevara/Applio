import { useEffect, useState, type KeyboardEvent } from 'react';
import type { Job } from '../../../shared/types';
import { Button } from '../../components/button';
import { formatRelative } from '../../lib/format';
import { navigate } from '../../lib/router';
import type { InboxSort, InboxTab, InboxTabKey } from './review-model';

interface InboxQueueProps {
  /** All four tabs, most urgent first (`inboxTabs`). */
  tabs: InboxTab[];
  /** Jobs Claude is drafting now: not decisions yet, listed so none goes missing. */
  drafting: Job[];
  currentId?: string;
  sort: InboxSort;
  onSort: (sort: InboxSort) => void;
}

/** ↑ and ↓ move between rows and open the one they land on, like a mail list. */
function moveSelection(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLAnchorElement>('a.inbox-row')];
  const at = rows.indexOf(document.activeElement as HTMLAnchorElement);
  if (at < 0) return;
  e.preventDefault();
  const next = rows[Math.min(rows.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)))]!;
  next.focus();
  navigate(next.getAttribute('href')!.replace(/^#/, ''));
}

/** The tab a job sits in, else the most urgent tab with jobs. */
const tabFor = (tabs: InboxTab[], id?: string): InboxTabKey =>
  tabs.find((t) => t.jobs.some((j) => j.id === id))?.key ?? tabs.find((t) => t.jobs.length)?.key ?? tabs[0]!.key;

/**
 * The Inbox list (redesign v2): one tab at a time so a long queue stays calm,
 * one-line rows, and a label only when something is off the normal path. The
 * list scrolls inside its frame, so the detail never scrolls out of view.
 */
export function InboxQueue({ tabs, drafting, currentId, sort, onSort }: InboxQueueProps) {
  const [active, setActive] = useState<InboxTabKey>(() => tabFor(tabs, currentId));
  // Follow the selected job into its tab: one opened from a link, or one that moved (a refused send → Fix first).
  const owner = tabs.find((t) => t.jobs.some((j) => j.id === currentId))?.key;
  useEffect(() => {
    if (owner) setActive(owner);
  }, [currentId, owner]);

  const tab = tabs.find((t) => t.key === active)!;
  const at = tabs.indexOf(tab);
  const next = [...tabs.slice(at + 1), ...tabs.slice(0, at)].find((t) => t.jobs.length);

  return (
    <section className="card card-flush inbox-queue" aria-label="Queue">
      <div className="inbox-tabs" role="tablist" aria-label="What to decide">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`inbox-tab-${t.key}`}
            aria-selected={t.key === active}
            aria-controls="inbox-panel"
            className={`inbox-tab${t.key === 'fix' && t.jobs.length ? ' inbox-tab-urgent' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label} <span className="inbox-tab-count">{t.jobs.length}</span>
          </button>
        ))}
      </div>
      <div className="inbox-tools">
        <span className="cell-sub">{tab.hint}</span>
        <label htmlFor="inbox-sort" className="visually-hidden">Sort</label>
        <select id="inbox-sort" className="input inbox-sort" value={sort} onChange={(e) => onSort(e.target.value as InboxSort)}>
          <option value="score">Best match first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <div id="inbox-panel" role="tabpanel" aria-labelledby={`inbox-tab-${active}`} className="inbox-scroll" onKeyDown={moveSelection}>
        {tab.jobs.length ? (
          <ul className="list-plain">
            {tab.jobs.map((job) => <InboxRow key={job.id} job={job} current={job.id === currentId} />)}
          </ul>
        ) : (
          <div className="inbox-empty">
            <p><strong>{tab.label} is clear.</strong></p>
            {next ? <Button size="sm" onClick={() => setActive(next.key)}>Go to {next.label}</Button> : null}
          </div>
        )}
      </div>

      {drafting.length ? (
        <div className="inbox-drafting">
          <h2 className="section-label">Drafting now ({drafting.length})</h2>
          <ul className="list-plain" aria-label="Drafting now">
            {drafting.map((job) => (
              <li key={job.id}>
                <a href={`#/inbox/${job.id}`} className="inbox-drafting-row" aria-current={job.id === currentId ? 'true' : undefined}>
                  <span className="spinner" aria-hidden="true" />
                  <span className="inbox-row-text">{job.title} · {job.company}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** One line: score, role · company, a label only for an exception, and how long it's waited. */
function InboxRow({ job, current }: { job: Job; current: boolean }) {
  const label = job.suspicious ? 'Check post' : job.status === 'approved' ? 'Not sent' : undefined;
  const text = `${job.title} · ${job.company}`;
  return (
    <li>
      <a href={`#/inbox/${job.id}`} className="inbox-row" aria-current={current ? 'true' : undefined} title={text}>
        <span className="inbox-row-score mono">{job.score ?? '—'}</span>
        <span className="inbox-row-text"><span className="inbox-row-role">{job.title}</span> · {job.company}</span>
        {label ? <span className="badge badge-danger">{label}</span> : null}
        <span className="inbox-row-age cell-sub">{formatRelative(job.history[0]?.at ?? job.postedAt)}</span>
      </a>
    </li>
  );
}
