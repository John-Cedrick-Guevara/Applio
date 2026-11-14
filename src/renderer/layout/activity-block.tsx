import { useEffect, useState } from 'react';
import type { AppStatus } from '../../shared/types';
import { useApi } from '../api/api-context';
import { useAsync } from '../hooks/use-async';
import { shareBlocks } from '../lib/cost';
import { usePath } from '../lib/router';
import { activityModel, autonomousSourceCount, SETTINGS_CHANGED } from './activity-model';

/**
 * The rail's activity block: what is running right now, whether anything sends on its own,
 * and today's token use. It always says something, so "is it doing anything?" never needs a
 * guess. Its link goes where the next step is: Get jobs while a scan runs (Stop scan is
 * there), Settings when the budget or Claude blocks work, else Usage. Status comes from
 * main's pushes; auto-send pause lives in Settings.
 */
export function ActivityBlock() {
  const api = useApi();
  const path = usePath();
  const state = useAsync(async () => {
    const [status, settings, sources] = await Promise.all([api.getStatus(), api.getSettings(), api.listSources()]);
    return { status, autoSendThreshold: settings.autoSendThreshold, autonomousSources: autonomousSourceCount(sources) };
  }, [api, path]);
  // Settings tells the rail when a source or guardrail changed, so "Auto-send on/off" never lags the page it is edited on.
  useEffect(() => {
    const refresh = () => state.reload();
    window.addEventListener(SETTINGS_CHANGED, refresh);
    return () => window.removeEventListener(SETTINGS_CHANGED, refresh);
  }, [state.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  const setStatus = (status: AppStatus) => state.setData((d) => (d ? { ...d, status } : d));
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
    // A failed load says so instead of vanishing, so running work never silently disappears.
    return state.error ? (
      <div className="activity-block">
        <p className="activity-block-error">Couldn't load activity.</p>
        <button type="button" className="btn btn-sm btn-secondary" onClick={state.reload}>Retry</button>
      </div>
    ) : null;
  }
  const { status, autoSendThreshold, autonomousSources } = state.data;
  const m = activityModel(status, { autoSendThreshold, autonomousSources, now });
  const [runText = '', ...rest] = m.running.text.split(' · ');
  // The scan clock is the last part; it ticks every second, so it stays out of the live region.
  const clock = m.running.kind === 'scan' ? rest.pop() : undefined;
  const runSub = rest.join(' · ');
  // A budget stop outranks a running scan in what the rail leads with (the model ranks the scan first for its own line).
  const stopped = !!status.budgetStop;
  const scanNote = status.scan ? ' · A scan is running' : '';
  // The most urgent thing leads; a blocked AI or missing Claude is a link to the fix, not just a colour.
  const lead = m.engine
    ? { text: m.engine, sub: `Open Settings to set it up${scanNote}`, to: '#/settings/conn' }
    : stopped
    ? { text: 'AI paused', sub: `Raise the budget in Settings${scanNote}`, to: '#/settings/guard' }
    : { text: runText, sub: runSub, to: m.running.kind === 'scan' ? '#/get-jobs' : '#/usage' };
  const busy = m.running.kind === 'scan' || m.running.kind === 'drafting';
  const auto = m.auto.text.split(' · ')[0] ?? '';
  // From the raw share: the model's rounded percent would read tiny use as 0 and 99.6% as full.
  const on = shareBlocks(status.tokensToday / Math.max(1, status.dailyTokenBudget), 10);

  return (
    <div role="status" aria-live="polite" className="activity-block">
      <a href={lead.to} title={`${lead.text}. ${lead.sub}. ${auto}.`} className="activity-block-link">
        <span className="activity-block-icon" aria-hidden="true">
          {busy ? <span className="spinner" /> : <span className={`activity-block-dot activity-block-dot-${stopped || m.engine ? 'stop' : m.auto.kind === 'paused' ? 'warn' : 'ok'}`}>{stopped || m.engine || m.auto.kind === 'paused' ? '!' : null}</span>}
        </span>
        <span className="activity-block-text">
          <strong>{lead.text}</strong>
          <span>{lead.sub}</span>
          {clock ? <span className="activity-block-clock" aria-hidden="true">{clock}</span> : null}
          <span className="activity-block-auto">{auto}</span>
          <span className="activity-block-tok" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < on ? 'on' : undefined} />)}
          </span>
        </span>
      </a>
    </div>
  );
}
