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
import { CHANNEL_LABEL } from '../../lib/labels';
import { DRAFT_TOKENS, bucketOf, draftEstimate, matchRows, tabCounts, type MatchTab } from './matches-model';
import './matches.css';

/** How long after the last slider move the draft bar is saved. */
const SAVE_BAR_MS = 400;

const TABS: { id: MatchTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strong', label: 'At or above bar' },
  { id: 'below', label: 'Below bar' },
  { id: 'unscored', label: 'Not scored' },
];

/**
 * Matches (redesign v2): every job with no draft yet, so sorting them happens in
 * one list with the draft bar beside it. Drafts started here go to Review.
 */
export default function MatchesPage() {
  const api = useApi();
  const jobsChanges = useJobsVersion();
  const state = useAsync(async () => {
    const [jobs, settings, status] = await Promise.all([api.listJobs({ statuses: ['scored', 'found'] }), api.getSettings(), api.getStatus()]);
    return { jobs, settings, status };
  }, [api, jobsChanges]);
  const setStatus = (status: AppStatus) => state.setData((d) => ({ ...d, status }));
  useEffect(() => window.applioEvents?.onStatus(setStatus), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="matches">
      <PageHeader title="Matches" description="Jobs that passed your filters but have no draft yet. Draft the ones worth it; drafts go to Review when ready." />
      <AsyncView state={state} what="your matches" rows={6}>
        {(data) => <MatchesView jobs={data.jobs} settings={data.settings} status={data.status} onSettings={(settings) => state.setData((d) => ({ ...d, settings }))} />}
      </AsyncView>
    </div>
  );
}

interface ViewProps {
  jobs: Job[];
  settings: Settings;
  status: AppStatus;
  onSettings: (settings: Settings) => void;
}

function MatchesView({ jobs, settings, status, onSettings }: ViewProps) {
  const api = useApi();
  const action = useAction();
  const [bar, setBar] = useState(settings.draftThreshold);
  const [tab, setTab] = useState<MatchTab>('all');
  const [query, setQuery] = useState('');
  const [onlyNew, setOnlyNew] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // Skipped rows stay hidden after the skip is saved, until the list reloads without them;
  // a failed save brings its row back (the error toast says why).
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const unhide = (ids: string[]) => setGone((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
  const skips = useHeldAction(async (ids) => {
    for (const id of ids) {
      const done = await action.run('skip the job', () => api.skipJob(id));
      if (!done) unhide([id]);
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
  const filters = { bar, tab, query, onlyNew, drafting: status.drafting ?? [], ...(status.lastRun ? { lastRunAt: status.lastRun.at } : {}) };
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
        </div>

        {chosen.length ? (
          <div className="matches-selected" role="region" aria-label="Selected">
            <strong>{chosen.length} selected</strong>
            <span>≈ {formatTokens(estimate.cost)} tokens · {formatTokens(estimate.left)} left today</span>
            {estimate.leftOut ? <span>{estimate.leftOut} not scored yet {estimate.leftOut === 1 ? 'is' : 'are'} left out of drafting.</span> : null}
            <span className="matches-selected-actions">
              {estimate.block ? <span id="draft-block" className="field-error">{estimate.block}</span> : null}
              <Button size="sm" onClick={() => skip(chosen)}>Skip {chosen.length}</Button>
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
                        {bucket === 'unscored' ? 'Not scored yet. Your next scan scores it.'
                          : bucket === 'strong' ? `At or above your draft bar (${bar}).`
                          : `Below your draft bar (${bar}).`}
                      </td>
                      <td className="matches-actions">
                        <Button size="sm" variant="link" onClick={() => skip([j])}>Skip</Button>
                        {bucket !== 'unscored' ? (
                          <Button size="sm" variant={bucket === 'strong' ? 'primary' : 'secondary'} busy={action.pending} disabled={!!status.budgetStop} title={status.budgetStop} onClick={() => draft([j])}>Draft · ≈ {formatTokens(DRAFT_TOKENS)}</Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
            <a className={buttonClass('primary')} href="#/find-jobs">Find jobs</a>
          </div>
        )}
        {status.budgetStop ? <p className="cell-sub matches-foot">{status.budgetStop} Drafting waits until it resets.</p> : null}
      </section>

      {skips.held ? (
        <div className="matches-undo" role="status" aria-label="Undo">
          <span>{skips.held.message}</span>
          <Button size="sm" variant="link" onClick={() => { unhide(skips.held!.ids); skips.undo(); }}>Undo</Button>
        </div>
      ) : null}
    </>
  );
}
