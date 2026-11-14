import { useEffect, useState } from 'react';
import type { AppStatus, RunSummary, ScanPhase } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { Blocks } from '../../components/blocks';
import { Button } from '../../components/button';
import { Callout, StepList } from '../../components/job-state';
import { ProgressBar } from '../../components/progress-bar';
import { useElapsed } from '../../hooks/use-elapsed';
import { stalledLine } from '../../lib/waits';
import { useAction } from '../../hooks/use-action';
import { useAsync } from '../../hooks/use-async';
import { costBlocks, costLine } from '../../lib/cost';
import { runResult } from '../../lib/run-summary';
import './find-jobs.css';

const AT_LIMIT = "Every source has used today's polls. They poll again after midnight.";

/** About what scoring a typical scan's new jobs costs; each run's real use is on the Usage page. */
const SCAN_SCORE_TOKENS = 6_000;

/**
 * Get jobs › Scan sources: where a scan starts (SPEC F2: scans only run when the
 * operator starts one). Says what a scan checks and costs before the click, why it
 * can't run when it can't, and what it kept once it's done.
 */
export default function FindJobsPage() {
  const api = useApi();
  const state = useAsync(async () => {
    const [status, sources] = await Promise.all([api.getStatus(), api.listSources()]);
    // Clipped jobs arrive when the operator pastes them; a scan never polls them.
    return { status, sources: sources.filter((s) => s.enabled && s.kind !== 'clip') };
  }, [api]);

  return (
    <div className="find-jobs">
      <AsyncView state={state} what="your sources" rows={4}>
        {({ status, sources }) => <Scan status={status} sources={sources.map((s) => ({ id: s.id, name: s.name, via: s.via }))} />}
      </AsyncView>
    </div>
  );
}

function Scan({ status, sources }: { status: AppStatus; sources: { id: string; name: string; via: string }[] }) {
  const budgetStop = status.budgetStop;
  const atLimit = !!status.sourcesAtLimit;
  const api = useApi();
  const runner = useAction();
  const [result, setResult] = useState<RunSummary>();
  const [blocked, setBlocked] = useState<string>();
  // This scan only: unticking a source doesn't turn it off in Settings.
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [draft, setDraft] = useState(false);
  const [phase, setPhase] = useState<ScanPhase>();
  const [stopping, setStopping] = useState(false);
  useEffect(() => window.applioEvents?.onStatus((s) => setPhase(s.scan?.phase)), []);
  // Scoring is a known small cost; drafting spends up to what is left, so with it on the meter shows that ceiling.
  const filled = draft ? 10 : costBlocks(SCAN_SCORE_TOKENS, status);
  const chosen = sources.filter((s) => !skipped.has(s.id)).map((s) => s.id);
  const toggle = (id: string) => setSkipped((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  const start = async () => {
    // The button stays clickable; a click that can't scan says why instead.
    const why = budgetStop ? "Can't scan until the token budget resets or is raised."
      : sources.length === 0 ? 'Turn on at least one source in Settings first.'
      : chosen.length === 0 ? 'Pick at least one source to scan.'
      : undefined;
    setBlocked(why);
    if (why) return;
    setResult(undefined);
    setPhase(undefined);
    setStopping(false);
    const run = await runner.run('scan for jobs', () => api.runDiscovery({ sourceIds: chosen, draft }), undefined, { quiet: true });
    if (!run) return;
    // The stored summary knows which sources were at their limit; the returned one doesn't.
    setResult((await api.getStatus().catch(() => undefined))?.lastRun ?? run);
  };

  return (
    <>
      {budgetStop ? <Callout tone="failed" title="Can't scan right now.">{budgetStop} <a href="#/usage">See usage and limits</a></Callout> : null}
      {atLimit && !budgetStop ? <Callout tone="needs" title="Nothing new to fetch today.">{AT_LIMIT}</Callout> : null}

      {runner.pending ? (
        <Running phase={phase} draft={draft} stopping={stopping} onStop={() => { setStopping(true); void api.stopScan(); }} />
      ) : result ? (
        <Results run={result} onAgain={() => setResult(undefined)} />
      ) : (
        <section className="card card-flush" aria-label="Start a scan">
          <div className="find-jobs-body">
            <h2 className="section-label">Sources this scan checks</h2>
            {sources.length ? (
              <ul className="list-plain find-jobs-sources" aria-label="Sources this scan checks">
                {sources.map((s) => (
                  <li key={s.id}>
                    <label className="find-jobs-source">
                      <input type="checkbox" checked={!skipped.has(s.id)} onChange={() => toggle(s.id)} />
                      <span>{s.name}</span>
                      <span className="cell-sub">{s.via}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : <p className="cell-sub">No sources are on.</p>}
            <a href="#/settings">Change sources in Settings</a>
            <label className="find-jobs-draft">
              <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
              <span>
                <span className="strong">Also draft strong matches right away</span>
                <span className="cell-sub find-jobs-hint">Off saves tokens: strong matches wait in Matches, one click from a draft.</span>
              </span>
            </label>
          </div>
          {runner.error ? (
            <div className="find-jobs-body">
              <Callout tone="failed" title="The scan stopped." action={{ label: 'Try again', onClick: start }}>{runner.error}</Callout>
            </div>
          ) : null}
          <div className="find-jobs-foot">
            <Blocks filled={filled} total={10} tone="ice" gap={6} className="find-jobs-meter" />
            {draft ? <p className="cell-sub find-jobs-ceiling">Worst case with drafting on: up to everything left today.</p> : null}
            <dl className="find-jobs-cost">
              <div><dt>Fetch and filters</dt><dd>Free</dd></div>
              <div><dt>Scoring</dt><dd>{costLine(SCAN_SCORE_TOKENS, status)}</dd></div>
              <div><dt>Drafting</dt><dd>{draft ? '≈ 30k tokens per strong match, up to what is left today' : 'None now. Draft any match from Matches.'}</dd></div>
            </dl>
            <div className="find-jobs-start">
              {blocked ? <span className="field-error" role="alert">{blocked}</span> : null}
              <Button variant="primary" onClick={start}>Start scan</Button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/** "1:30" from milliseconds. */
const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

const PHASES: { phase: ScanPhase; label: string }[] = [
  { phase: 'fetching', label: 'Fetch posts' },
  { phase: 'filtering', label: 'Remove duplicates and filter (free)' },
  { phase: 'scoring', label: 'Score against your fact bank' },
  { phase: 'drafting', label: 'Draft strong matches' },
];

/** A scan in progress, phase by phase as main reports it, with a stop between phases. */
function Running({ phase, draft, stopping, onStop }: { phase?: ScanPhase; draft: boolean; stopping: boolean; onStop: () => void }) {
  const elapsed = useElapsed(true);
  const slow = stalledLine('scan', elapsed);
  const at = Math.max(0, PHASES.findIndex((p) => p.phase === phase));
  // Only the phases this scan reaches; drafting is listed when asked for, so nothing shows as skipped.
  const steps = PHASES.filter((p) => draft || p.phase !== 'drafting').slice(0, phase ? undefined : 1).map((p, i) => ({
    label: p.label,
    state: i < at ? 'done' as const : i === at ? 'active' as const : 'pending' as const,
    ...(i === at ? { note: 'In progress' } : {}),
  }));
  return (
    <section className="card" aria-label="Scan in progress" aria-busy="true">
      <div className="find-jobs-running">
        <h2 className="find-jobs-title">Scanning</h2>
        <span className="mono cell-sub">{clock(elapsed)} elapsed</span>
        <Button disabled={stopping} onClick={onStop}>Stop scan</Button>
      </div>
      <StepList label="Scan steps" steps={steps} />
      <ProgressBar />
      {slow ? <Callout tone="needs" title={slow.title}>{slow.body}</Callout> : null}
      <p className="cell-sub" role="status">{stopping ? 'Stopping after this step. Everything found so far is kept.' : 'You can leave this page. Results land in Matches.'}</p>
    </section>
  );
}

function Results({ run, onAgain }: { run: RunSummary; onAgain: () => void }) {
  // Drafted jobs and ones Claude asked about wait in the Inbox; only the rest are listed in Matches.
  const waiting = Math.max(0, run.passedFilters - run.drafted - (run.asked ?? 0));
  const counts = [
    [run.found, 'posts fetched'],
    [run.newAfterDedup, 'new'],
    [run.passedFilters, 'passed your filters'],
    [run.drafted, 'drafted'],
  ] as const;
  return (
    <section className="card card-flush" aria-label="Scan results">
      <div className="find-jobs-body">
        <ol className="list-plain find-jobs-funnel" aria-label="What the scan kept">
          {counts.map(([n, label]) => <li key={label}><span className="find-jobs-count mono">{n}</span> {label}</li>)}
        </ol>
        <p role="status">{runResult(run)}</p>
      </div>
      <div className="find-jobs-foot find-jobs-actions">
        <Button onClick={onAgain}>Scan again</Button>
        {waiting > 0 ? (
          <a className="btn btn-primary" href="#/matches/new">Open the {waiting} new match{waiting === 1 ? '' : 'es'}</a>
        ) : run.drafted + (run.asked ?? 0) > 0 ? (
          <a className="btn btn-primary" href="#/inbox">Open the Inbox</a>
        ) : <a className="btn btn-primary" href="#/matches">Open Matches</a>}
      </div>
    </section>
  );
}
