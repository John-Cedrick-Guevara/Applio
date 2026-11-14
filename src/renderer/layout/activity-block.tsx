import { useEffect, useState } from 'react';
import type { AppStatus } from '../../shared/types';
import { useApi } from '../api/api-context';
import { useAsync } from '../hooks/use-async';
import { activityModel } from './activity-model';

/**
 * The rail's activity block: what is running right now, in words, and today's token
 * use as 10 blocks. It always says something, so "is it doing anything?" never needs
 * a guess. Status comes from main's pushes; auto-send details stay in the top bar.
 */
export function ActivityBlock() {
  const api = useApi();
  const state = useAsync(() => api.getStatus(), [api]);
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

  if (!state.data) return null;
  const m = activityModel(state.data, { autoSendThreshold: 0, autonomousSources: 0, now });
  const [text = '', ...rest] = m.running.text.split(' · ');
  const sub = rest.join(' · ');
  const busy = m.running.kind === 'scan' || m.running.kind === 'drafting';
  const on = Math.round(m.budget.pct / 10);

  return (
    <div role="status" aria-live="polite" className="activity-block">
      <a href="#/usage" title={`${text}. ${sub}`} className="activity-block-link">
        <span className="activity-block-icon" aria-hidden="true">
          {busy ? <span className="spinner" /> : <span className={`activity-block-dot activity-block-dot-${m.running.kind === 'stopped' || m.engine ? 'stop' : 'ok'}`} />}
        </span>
        <span className="activity-block-text">
          <strong>{text}</strong>
          <span>{sub}</span>
          <span className="activity-block-tok" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < on ? 'on' : undefined} />)}
          </span>
        </span>
      </a>
    </div>
  );
}
