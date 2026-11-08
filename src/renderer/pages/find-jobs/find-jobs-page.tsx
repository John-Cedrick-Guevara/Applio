import { useEffect, useState } from 'react';
import type { RunSummary } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { Button } from '../../components/button';
import { Callout, StepList } from '../../components/job-state';
import { PageHeader } from '../../components/page-header';
import { useAction } from '../../hooks/use-action';
import { useAsync } from '../../hooks/use-async';
import { runResult } from '../../lib/run-summary';
import './find-jobs.css';

const AT_LIMIT = "Every source has used today's polls. They poll again after midnight.";

/**
 * Find jobs: the one place a scan starts (SPEC F2: scans only run when the
 * operator starts one). Says what a scan checks and costs before the click, why it
 * can't run when it can't, and what it kept once it's done.
 */
export default function FindJobsPage() {
  const api = useApi();
  const state = useAsync(async () => {
    const [status, sources] = await Promise.all([api.getStatus(), api.listSources()]);
    return { status, sources: sources.filter((s) => s.enabled) };
  }, [api]);

  return (
    <div className="find-jobs">
      <PageHeader title="Find jobs" description="Applio only scans when you start one, here or from the tray." />
      <AsyncView state={state} what="your sources" rows={4}>
        {({ status, sources }) => <Scan budgetStop={status.budgetStop} atLimit={!!status.sourcesAtLimit} sources={sources.map((s) => ({ id: s.id, name: s.name, via: s.via }))} />}
      </AsyncView>
    </div>
  );
}

function Scan({ budgetStop, atLimit, sources }: { budgetStop?: string; atLimit: boolean; sources: { id: string; name: string; via: string }[] }) {
  const api = useApi();
  const runner = useAction();
  const [result, setResult] = useState<RunSummary>();
  const [blocked, setBlocked] = useState<string>();

  const start = async () => {
    // The button stays clickable; a click that can't scan says why instead.
    const why = budgetStop ? "Can't scan until the token budget resets or is raised."
      : sources.length === 0 ? 'Turn on at least one source in Settings first.'
      : undefined;
    setBlocked(why);
    if (why) return;
    setResult(undefined);
    const run = await runner.run('scan for jobs', () => api.runDiscovery(), undefined, { quiet: true });
    if (!run) return;
    // The stored summary knows which sources were at their limit; the returned one doesn't.
    setResult((await api.getStatus().catch(() => undefined))?.lastRun ?? run);
  };

  return (
    <>
      {budgetStop ? <Callout tone="failed" title="Can't scan right now.">{budgetStop} <a href="#/usage">See usage and limits</a></Callout> : null}
      {atLimit && !budgetStop ? <Callout tone="needs" title="Nothing new to fetch today.">{AT_LIMIT}</Callout> : null}

      {runner.pending ? <Running /> : result ? (
        <Results run={result} onAgain={() => setResult(undefined)} />
      ) : (
        <section className="card card-flush" aria-label="Start a scan">
          <div className="find-jobs-body">
            <h2 className="section-label">Sources this scan checks</h2>
            {sources.length ? (
              <ul className="list-plain find-jobs-sources" aria-label="Sources this scan checks">
                {sources.map((s) => <li key={s.id}><span>{s.name}</span><span className="cell-sub">{s.via}</span></li>)}
              </ul>
            ) : <p className="cell-sub">No sources are on.</p>}
            <a href="#/settings">Change sources in Settings</a>
          </div>
          {runner.error ? (
            <div className="find-jobs-body">
              <Callout tone="failed" title="The scan stopped." action={{ label: 'Try again', onClick: start }}>{runner.error}</Callout>
            </div>
          ) : null}
          <div className="find-jobs-foot">
            <dl className="find-jobs-cost">
              <div><dt>Fetch and filters</dt><dd>Free</dd></div>
              <div><dt>Scoring</dt><dd>A few thousand tokens</dd></div>
              <div><dt>Drafting</dt><dd>About 25–40k tokens per strong match</dd></div>
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

/** A scan in progress. One honest stage until main reports phases (roadmap PR-6). */
function Running() {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <section className="card" aria-label="Scan in progress" aria-busy="true">
      <div className="find-jobs-running">
        <h2 className="find-jobs-title">Scanning</h2>
        <span className="mono cell-sub">{clock(now - startedAt)} elapsed</span>
      </div>
      <StepList label="Scan steps" steps={[{ label: 'Fetch, filter, score and draft strong matches', state: 'active', note: 'In progress' }]} />
      <p className="cell-sub">You can leave this page. Results land in Review.</p>
    </section>
  );
}

function Results({ run, onAgain }: { run: RunSummary; onAgain: () => void }) {
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
        <a className="btn btn-primary" href="#/review">Open Review</a>
      </div>
    </section>
  );
}
