import { useEffect, useState } from 'react';
import type { AppStatus } from '../../shared/types';
import { useApi } from '../api/api-context';
import { Button } from '../components/button';
import { useAction } from '../hooks/use-action';
import { useAsync } from '../hooks/use-async';
import { usePath } from '../lib/router';
import { activityModel } from './activity-model';

/**
 * The bar above every page (redesign v2): what's running, whether anything sends on
 * its own, and today's budget. Status comes from main's pushes; the auto-send score
 * and sources aren't pushed, so they reload on navigation and after Pause/Resume.
 */
export function ActivityBar() {
  const api = useApi();
  const path = usePath();
  const pause = useAction();
  const stop = useAction();
  const state = useAsync(async () => {
    const [status, settings, sources] = await Promise.all([api.getStatus(), api.getSettings(), api.listSources()]);
    return { status, autoSendThreshold: settings.autoSendThreshold, autonomousSources: sources.filter((s) => s.enabled && s.autonomy === 'autonomous').length };
  }, [api, path]);
  const setStatus = (status: AppStatus) => state.setData((d) => ({ ...d, status }));
  useEffect(() => window.applioEvents?.onStatus(setStatus), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ticks once a second only while a scan runs, for its elapsed time.
  const scanning = !!state.data?.status.scan;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!scanning) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [scanning]);

  if (!state.data) {
    // A failed load says so in the bar's place, so running work never silently disappears.
    return state.error ? (
      <section className="activity-bar activity-bar-stop" aria-label="Activity">
        <span className="activity-running">Couldn't load what Applio is doing.</span>
        <div className="activity-actions"><Button size="sm" onClick={state.reload}>Retry</Button></div>
      </section>
    ) : null;
  }
  const { status } = state.data;
  const m = activityModel(status, { autoSendThreshold: state.data.autoSendThreshold, autonomousSources: state.data.autonomousSources, now });

  const togglePause = async () => {
    const next = await pause.run(status.paused ? 'resume auto-send' : 'pause auto-send', () => api.setAutomationPaused(!status.paused));
    if (next) setStatus(next);
  };

  return (
    <section className={`activity-bar activity-bar-${m.budget.tone === 'stop' || m.engine ? 'stop' : m.auto.kind === 'paused' ? 'warn' : 'ok'}`} aria-label="Activity">
      <details className="activity-details">
        <summary className="activity-summary">
          <span className="activity-running">
            {m.running.kind === 'scan' || m.running.kind === 'drafting' ? <span className="spinner" aria-hidden="true" /> : <span className={`engine-dot engine-dot-${m.budget.tone === 'stop' ? 'stop' : 'ok'}`} aria-hidden="true" />}
            {m.running.text}
          </span>
          <span className="activity-auto">{m.auto.text}</span>
          <span className="activity-budget">
            Tokens today <span className="mono">{m.budget.text}</span>
            <span className={`activity-meter activity-meter-${m.budget.tone}`} role="meter" aria-label="Tokens used today" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.budget.pct}>
              <span style={{ width: `${m.budget.pct}%` }} />
            </span>
          </span>
        </summary>
        <div className="activity-panel">
          <h2 className="section-label">Running now</h2>
          {m.running.kind === 'scan' || status.drafting?.length ? (
            <ul className="list-plain activity-list" aria-label="Running now">
              {status.scan ? <li><a href="#/get-jobs">{m.running.text.replace(/^Scanning/, 'Open the scan:')}</a></li> : null}
              {status.drafting?.length ? <li><a href="#/inbox">{status.drafting.length} draft{status.drafting.length === 1 ? '' : 's'} in progress, open Inbox</a></li> : null}
            </ul>
          ) : <p className="cell-sub">Nothing is running. Scans only run when you start one.</p>}
          <p className="activity-rule">
            {m.auto.kind === 'on'
              ? `Drafts from Autonomous sources at ${state.data.autoSendThreshold}+ go out on their own, by email or ATS form. Everything else waits for you.`
              : m.auto.kind === 'paused' ? 'Nothing goes out on its own while paused. Scans and drafts still work.'
              : 'No source is set to Autonomous, so every draft waits for your approval.'}{' '}
            <a href="#/settings">Change in Settings</a>
          </p>
          <p className="cell-sub">{status.budgetStop ?? `${m.budget.pct}% of today's token budget used.`} <a href="#/usage">See usage and limits</a></p>
        </div>
      </details>
      <div className="activity-actions">
        {m.engine ? <a href="#/settings" className="activity-alert">{m.engine}</a> : null}
        {status.budgetStop ? <a href="#/settings">Raise budget</a> : null}
        {status.scan ? <Button size="sm" busy={stop.pending} onClick={() => stop.run('stop the scan', () => api.stopScan())}>Stop scan</Button> : null}
        <Button size="sm" busy={pause.pending} onClick={togglePause}>{status.paused ? 'Resume auto-send' : 'Pause auto-send'}</Button>
      </div>
    </section>
  );
}
