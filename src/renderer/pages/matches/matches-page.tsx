import { useEffect, useRef, useState } from 'react';
import type { AppStatus, Job, Settings } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { Button, buttonClass } from '../../components/button';
import { PageHeader } from '../../components/page-header';
import { useAction } from '../../hooks/use-action';
import { useAsync } from '../../hooks/use-async';
import { useHeldAction } from '../../hooks/use-held-action';
import { useJobsVersion } from '../../hooks/use-jobs-version';
import { formatTokens } from '../../lib/format';
import type { RouteParams } from '../../lib/router';
import { CHANNEL_LABEL } from '../../lib/labels';
import { DRAFT_TOKENS, OLD_TRASH_DAYS, SCORE_TOKENS, bucketOf, draftEstimate, isOldTrash, matchRows, staleMatches, tabCounts, type MatchTab } from './matches-model';
import './matches.css';

/** How long after the last slider move the draft bar is saved. */
const SAVE_BAR_MS = 400;

const TABS: { id: MatchTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strong', label: 'At or above bar' },
  { id: 'below', label: 'Below bar' },
  { id: 'unscored', label: 'Not scored' },
  { id: 'trash', label: 'Trash' },
];

/**
 * Matches (redesign v2): every job with no draft yet, so sorting them happens in
 * one list with the draft bar beside it. Drafts started here go to the Inbox.
 */
export default function MatchesPage({ params = {} }: { params?: RouteParams }) {
  const api = useApi();
  const jobsChanges = useJobsVersion();
  const state = useAsync(async () => {
    const [scoredOrFound, settings, status, questions] = await Promise.all([api.listJobs({ statuses: ['scored', 'found', 'skipped'] }), api.getSettings(), api.getStatus(), api.listQuestions()]);
    // Jobs Claude asked about wait in the Inbox's Answer tab, so they aren't listed twice.
    const asking = new Set(questions.map((q) => q.jobId));
    return { jobs: scoredOrFound.filter((j) => !asking.has(j.id)), settings, status };
  }, [api, jobsChanges]);
  const setStatus = (status: AppStatus) => state.setData((d) => ({ ...d, status }));
  useEffect(() => window.applioEvents?.onStatus(setStatus), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="matches">
      <PageHeader title="Matches" description="Jobs that passed your filters but have no draft yet. Draft the ones worth it; drafts go to the Inbox when ready." />
      <AsyncView state={state} what="your matches" rows={6}>
        {(data) => (
          <MatchesView
            // Keyed by the link, so /matches/new and /matches each start from their own filters even though the page stays mounted.
            key={params.view ?? 'all'}
            onlyNewAtStart={params.view === 'new'}
            jobs={data.jobs}
            settings={data.settings}
            status={data.status}
            onSettings={(settings) => state.setData((d) => ({ ...d, settings }))}
            onJob={(job) => state.setData((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === job.id ? job : j)) }))}
          />
        )}
      </AsyncView>
    </div>
  );
}

interface ViewProps {
  /** Opened from a scan's "Open the n new matches" link (`/matches/new`). */
  onlyNewAtStart: boolean;
  jobs: Job[];
  settings: Settings;
  status: AppStatus;
  onSettings: (settings: Settings) => void;
  /** Swaps in a job the page changed (scored on request). */
  onJob: (job: Job) => void;
}

function MatchesView({ onlyNewAtStart, jobs, settings, status, onSettings, onJob }: ViewProps) {
  const api = useApi();
  const action = useAction();
  const [bar, setBar] = useState(settings.draftThreshold);
  const [tab, setTab] = useState<MatchTab>('all');
  const [query, setQuery] = useState('');
  const [onlyNew, setOnlyNew] = useState(onlyNewAtStart);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // Clean up: a previewed, manual move of stale matches to the Trash.
  const [cleaning, setCleaning] = useState(false);
  const [olderOn, setOlderOn] = useState(true);
  const [belowOn, setBelowOn] = useState(true);
  const [days, setDays] = useState('14');
  const [cleaned, setCleaned] = useState<{ jobs: Job[]; message: string } | null>(null);
  const [showOldTrash, setShowOldTrash] = useState(false);
  // The undo bar for a cleanup goes away on its own.
  useEffect(() => {
    if (!cleaned) return;
    const timer = setTimeout(() => setCleaned(null), 15_000);
    return () => clearTimeout(timer);
  }, [cleaned]);
  // Skipped rows stay hidden after the skip is saved, until the list reloads without them;
  // a failed save brings its row back (the error toast says why).
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const unhide = (ids: string[]) => setGone((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
  const skips = useHeldAction(async (ids) => {
    for (const id of ids) {
      const done = await action.run('skip the job', () => api.skipJob(id));
      // A saved skip lands in the Trash; a failed one brings the row back. Either way the hold is over.
      if (done) onJob(done);
      unhide([id]);
    }
  });

  // The slider moves freely; the draft bar is saved once it settles, or at once if the page closes first.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unsaved = useRef<number | undefined>(undefined);
  const saveBar = async () => {
    clearTimeout(saveTimer.current);
    const value = unsaved.current;
    unsaved.current = undefined;
    if (value === undefined) return;
    const next = await action.run('save the draft bar', () => api.saveSettings({ draftThreshold: value }));
    if (next) onSettings(next);
  };
  const saveBarRef = useRef(saveBar);
  saveBarRef.current = saveBar;
  useEffect(() => () => void saveBarRef.current(), []);
  const moveBar = (value: number) => {
    setBar(value);
    unsaved.current = value;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveBar(), SAVE_BAR_MS);
  };

  const visible = jobs.filter((j) => !gone.has(j.id));
  const now = Date.now();
  const filters = { bar, tab, query, onlyNew, drafting: status.drafting ?? [], now, showOldTrash, ...(status.lastRun ? { lastRunAt: status.lastRun.at } : {}) };
  const oldTrash = visible.filter((j) => isOldTrash(j, now)).length;
  const daysNum = /^\d+$/.test(days) ? Number(days) : NaN;
  const daysOk = daysNum >= 1 && daysNum <= 365;
  const stale = staleMatches(visible, { olderOn, olderDays: daysOk ? daysNum : Infinity, belowOn, bar, drafting: status.drafting ?? [], now });
  const cleanBlock = !daysOk ? 'Enter a whole number of days from 1 to 365.' : stale.picked.length === 0 ? 'Nothing matches these rules.' : undefined;
  const rows = matchRows(visible, filters);
  const counts = tabCounts(visible, filters);
  const strong = tabCounts(visible, { ...filters, query: '', onlyNew: false }).strong;
  const chosen = rows.filter((j) => selected.has(j.id));
  const estimate = draftEstimate(chosen, status);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const skip = (picked: Job[]) => {
    setSelected(new Set());
    setGone((prev) => new Set([...prev, ...picked.map((j) => j.id)]));
    skips.hold(picked.map((j) => j.id), picked.length === 1 ? `Skipped ${picked[0]!.title}.` : `Skipped ${picked.length} matches.`);
  };
  const draft = async (picked: Job[]) => {
    setSelected(new Set());
    const scored = picked.filter((j) => j.status === 'scored');
    for (const j of scored) await action.run('start the draft', () => api.draftJob(j.id));
  };
  /** Moves the previewed matches to the Trash. One that fails stays a match; the rest still move. */
  const moveStale = async () => {
    const picked = stale.picked;
    setCleaning(false);
    const moved: Job[] = [];
    for (const j of picked) {
      const done = await action.run('skip the job', () => api.skipJob(j.id));
      if (done) {
        onJob(done);
        moved.push(done);
      }
    }
    if (moved.length) setCleaned({ jobs: moved, message: `Moved ${moved.length} match${moved.length === 1 ? '' : 'es'} to the Trash.` });
  };
  const undoCleanup = async () => {
    const jobsToRestore = cleaned?.jobs ?? [];
    setCleaned(null);
    for (const j of jobsToRestore) {
      const next = await action.run('restore the job', () => api.restoreJob(j.id));
      if (next) onJob(next);
    }
  };

  // Restoring takes jobs out of the Trash, back to the status they had before the skip.
  const restore = async (picked: Job[]) => {
    setSelected(new Set());
    for (const j of picked.filter((p) => p.status === 'skipped')) {
      const next = await action.run('restore the job', () => api.restoreJob(j.id), `Restored ${j.title} at ${j.company}.`);
      if (next) onJob(next);
    }
  };

  // Scoring one job is its own small AI call, through main's quota guard.
  const score = async (picked: Job[]) => {
    setSelected(new Set());
    for (const j of picked.filter((p) => p.status === 'found')) {
      const next = await action.run('score the job', () => api.scoreJob(j.id));
      if (next) onJob(next);
    }
  };
  const clearFilters = () => {
    setQuery('');
    setOnlyNew(false);
    setTab('all');
  };

  return (
    <>
      <section className="card matches-bar" aria-label="Draft bar">
        <label htmlFor="draft-bar" className="matches-bar-label">Draft bar <span className="mono">{bar}</span></label>
        <input id="draft-bar" type="range" min={0} max={settings.autoSendThreshold} step={1} value={bar} onChange={(e) => moveBar(Number(e.target.value))} aria-describedby="draft-bar-note" />
        <span id="draft-bar-note" className="cell-sub">{strong} match{strong === 1 ? '' : 'es'} at or above.</span>
        <span className="cell-sub">Auto-send is at {settings.autoSendThreshold}, so the bar stops there.</span>
      </section>

      <section className="card card-flush" aria-label="Match list">
        <div className="matches-tools">
          <label htmlFor="matches-search" className="visually-hidden">Search matches</label>
          <input id="matches-search" type="search" className="input matches-search" placeholder="Search role or company" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="matches-tabs" role="group" aria-label="Show">
            {TABS.map((t) => (
              <button key={t.id} type="button" className="matches-tab" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label} <span className="mono">{counts[t.id]}</span>
              </button>
            ))}
          </div>
          <label className="matches-new"><input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />New since last scan</label>
          <Button aria-expanded={cleaning} onClick={() => setCleaning((c) => !c)}>Clean up</Button>
        </div>

        {cleaning ? (
          <div className="matches-clean" role="region" aria-label="Clean up">
            <h2 className="matches-clean-title">Clean up</h2>
            <p className="cell-sub">Moves stale matches to the Trash. Nothing is deleted, and you can undo it.</p>
            <label className="matches-clean-rule">
              <input type="checkbox" checked={olderOn} onChange={(e) => setOlderOn(e.target.checked)} />
              <span>Matches older than</span>
              <input type="number" className="input matches-clean-days" aria-label="Days" min={1} max={365} step={1} value={days} onChange={(e) => setDays(e.target.value)} />
              <span>days</span>
              <span className="mono matches-clean-count">{daysOk ? stale.older.length : 0}</span>
            </label>
            <label className="matches-clean-rule">
              <input type="checkbox" checked={belowOn} onChange={(e) => setBelowOn(e.target.checked)} />
              <span>Matches below the draft bar ({bar})</span>
              <span className="mono matches-clean-count">{stale.below.length}</span>
            </label>
            {stale.picked.length ? (
              <ul className="list-plain matches-clean-list" aria-label="Would move">
                {stale.picked.slice(0, 8).map((j) => <li key={j.id}><span>{j.title}</span> <span className="cell-sub">· {j.company}</span></li>)}
                {stale.picked.length > 8 ? <li className="cell-sub">and {stale.picked.length - 8} more</li> : null}
              </ul>
            ) : null}
            <div className="matches-clean-actions">
              {cleanBlock ? <span id="clean-block" className="field-error">{cleanBlock}</span> : null}
              <Button onClick={() => setCleaning(false)}>Cancel</Button>
              <Button variant="primary" disabled={!!cleanBlock} aria-describedby={cleanBlock ? 'clean-block' : undefined} onClick={moveStale}>Move {cleanBlock && !daysOk ? 0 : stale.picked.length} to the Trash</Button>
            </div>
          </div>
        ) : null}

        {chosen.length && tab === 'trash' ? (
          <div className="matches-selected" role="region" aria-label="Selected">
            <strong>{chosen.length} selected</strong>
            <span className="matches-selected-actions">
              <Button size="sm" variant="primary" busy={action.pending} onClick={() => restore(chosen)}>Restore {chosen.length}</Button>
            </span>
          </div>
        ) : chosen.length ? (
          <div className="matches-selected" role="region" aria-label="Selected">
            <strong>{chosen.length} selected</strong>
            <span>≈ {formatTokens(estimate.cost)} tokens · {formatTokens(estimate.left)} left today</span>
            {estimate.leftOut ? <span>{estimate.leftOut} not scored yet {estimate.leftOut === 1 ? 'is' : 'are'} left out of drafting.</span> : null}
            <span className="matches-selected-actions">
              {estimate.block ? <span id="draft-block" className="field-error">{estimate.block}</span> : null}
              <Button size="sm" onClick={() => skip(chosen)}>Skip {chosen.length}</Button>
              {estimate.leftOut ? <Button size="sm" busy={action.pending} disabled={!!status.budgetStop} onClick={() => score(chosen)}>Score {estimate.leftOut}</Button> : null}
              <Button size="sm" variant="primary" busy={action.pending} disabled={!!estimate.block || estimate.draftable === 0} aria-describedby={estimate.block ? 'draft-block' : undefined} onClick={() => draft(chosen)}>Draft {estimate.draftable}</Button>
            </span>
          </div>
        ) : null}

        {rows.length ? (
          <div className="table-scroll">
            <table className="table matches-table">
              <thead>
                <tr><th scope="col"><span className="visually-hidden">Select</span></th><th scope="col">Score</th><th scope="col">Role</th><th scope="col">Why it's here</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {rows.map((j) => {
                  const bucket = bucketOf(j, bar);
                  return (
                    <tr key={j.id} aria-selected={selected.has(j.id)}>
                      <td><input type="checkbox" aria-label={`Select ${j.title} at ${j.company}`} checked={selected.has(j.id)} onChange={() => toggle(j.id)} /></td>
                      <td className="mono">{j.score ?? '—'}</td>
                      <td>
                        <a href={`#/inbox/${j.id}`} className="matches-role">{j.title}</a>
                        <span className="cell-sub matches-sub">{j.company} · {j.sourceName} · {CHANNEL_LABEL[j.channel]}</span>
                      </td>
                      <td className="matches-why">
                        {bucket === 'trash' ? 'In the Trash. Restore it to see it in Matches or the Inbox again.'
                          : bucket === 'unscored' ? 'Not scored yet. Score it now, or your next scan will.'
                          : bucket === 'strong' ? `At or above your draft bar (${bar}).`
                          : `Below your draft bar (${bar}).`}
                      </td>
                      <td className="matches-actions">
                        {bucket === 'trash' ? <Button size="sm" busy={action.pending} onClick={() => restore([j])}>Restore</Button> : <Button size="sm" variant="link" onClick={() => skip([j])}>Skip</Button>}
                        {bucket === 'unscored' ? (
                          <Button size="sm" busy={action.pending} disabled={!!status.budgetStop} title={status.budgetStop} onClick={() => score([j])}>Score · ≈ {formatTokens(SCORE_TOKENS)}</Button>
                        ) : null}
                        {bucket !== 'unscored' && bucket !== 'trash' ? (
                          <Button size="sm" variant={bucket === 'strong' ? 'primary' : 'secondary'} busy={action.pending} disabled={!!status.budgetStop} title={status.budgetStop} onClick={() => draft([j])}>Draft · ≈ {formatTokens(DRAFT_TOKENS)}</Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : tab === 'trash' && !query && !onlyNew ? (
          oldTrash > 0 && !showOldTrash ? (
            <div className="matches-empty">
              <h2>Nothing recent in the Trash</h2>
              <p className="muted">{oldTrash} job{oldTrash === 1 ? '' : 's'} trashed more than {OLD_TRASH_DAYS} days ago {oldTrash === 1 ? 'is' : 'are'} hidden.</p>
              <Button onClick={() => setShowOldTrash(true)}>Show older ({oldTrash})</Button>
            </div>
          ) : (
            <div className="matches-empty">
              <h2>The Trash is empty</h2>
              <p className="muted">Jobs you skip or clean up wait here until you restore them.</p>
            </div>
          )
        ) : jobs.length ? (
          <div className="matches-empty">
            <h2>No matches fit your filters</h2>
            <p className="muted">Try other words, another tab, or clear the filters.</p>
            <Button onClick={clearFilters}>Clear all filters</Button>
          </div>
        ) : (
          <div className="matches-empty">
            <h2>No matches yet</h2>
            <p className="muted">Jobs that pass your filters land here after a scan, ready to draft.</p>
            <a className={buttonClass('primary')} href="#/get-jobs">Get jobs</a>
          </div>
        )}
        {tab === 'trash' && rows.length > 0 && oldTrash > 0 ? (
          <p className="cell-sub matches-foot">
            {showOldTrash ? `Showing jobs trashed more than ${OLD_TRASH_DAYS} days ago too.` : `${oldTrash} older than ${OLD_TRASH_DAYS} days ${oldTrash === 1 ? 'is' : 'are'} hidden.`}{' '}
            <Button size="sm" variant="link" onClick={() => setShowOldTrash((v) => !v)}>{showOldTrash ? 'Hide older' : `Show older (${oldTrash})`}</Button>
          </p>
        ) : null}
        {status.budgetStop ? <p className="cell-sub matches-foot">{status.budgetStop} Drafting waits until it resets.</p> : null}
      </section>

      {skips.held ? (
        <div className="undo-bar" role="status" aria-label="Undo">
          <span>{skips.held.message}</span>
          <Button size="sm" variant="link" onClick={() => { unhide(skips.held!.ids); skips.undo(); }}>Undo</Button>
        </div>
      ) : cleaned ? (
        <div className="undo-bar" role="status" aria-label="Undo">
          <span>{cleaned.message}</span>
          <Button size="sm" variant="link" onClick={undoCleanup}>Undo</Button>
        </div>
      ) : null}
    </>
  );
}
