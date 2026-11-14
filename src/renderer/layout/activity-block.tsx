import { useEffect, useState } from 'react';
import type { AppStatus } from '../../shared/types';
import { useApi } from '../api/api-context';
import { useAsync } from '../hooks/use-async';
import { usePath } from '../lib/router';
import { activityModel } from './activity-model';

/**
 * The rail's activity block: what is running right now, in words, and today's token
 * use as 10 blocks. It always says something, so "is it doing anything?" never needs
 * a guess. Status comes from main's pushes; auto-send details stay in the top bar.
 */
export function ActivityBlock() {
  const api = useApi();
  const path = usePath();
  const state = useAsync(() => api.getStatus(), [api, path]);
  const setStatus = (status: AppStatus) => state.setData(status);
  useEffect(() => window.applioEvents?.onStatus(setStatus), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ticks once a second only while a scan runs, for its elapsed time.
  const scanning = !!state.data?.scan;
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
  const m = activityModel(state.data, { autoSendThreshold: 0, autonomousSources: 0, now });
  const [text = '', ...rest] = m.running.text.split(' · ');
  // The scan clock is the last part; it ticks every second, so it stays out of the live region.
  const clock = m.running.kind === 'scan' ? rest.pop() : undefined;
  const sub = rest.join(' · ');
  const busy = m.running.kind === 'scan' || m.running.kind === 'drafting';
  // Any use fills a block, and the last fills only at the limit, so the bar never reads empty or exhausted early.
  const on = m.budget.pct <= 0 ? 0 : m.budget.pct >= 100 ? 10 : Math.min(9, Math.ceil(m.budget.pct / 10));

  return (
    <div role="status" aria-live="polite" className="activity-block">
      <a href="#/usage" title={`${text}. ${sub}`} className="activity-block-link">
        <span className="activity-block-icon" aria-hidden="true">
          {busy ? <span className="spinner" /> : <span className={`activity-block-dot activity-block-dot-${m.running.kind === 'stopped' || m.engine ? 'stop' : 'ok'}`} />}
        </span>
        <span className="activity-block-text">
          <strong>{text}</strong>
          <span>{sub}</span>
          {clock ? <span className="activity-block-clock" aria-hidden="true">{clock}</span> : null}
          <span className="activity-block-tok" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < on ? 'on' : undefined} />)}
          </span>
        </span>
      </a>
    </div>
  );
}
