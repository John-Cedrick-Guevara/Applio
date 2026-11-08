import { useEffect } from 'react';
import { useApi } from '../api/api-context';
import { useAsync } from '../hooks/use-async';
import { formatClock, formatTokens } from '../lib/format';
import { usePath } from '../lib/router';

/**
 * Sidebar status: engine readiness, next scheduled run and today's token use.
 * Main pushes each change (scheduler AC-5). Browser dev has no push, so it
 * also reloads on navigation.
 */
export function EngineCard() {
  const api = useApi();
  const path = usePath();
  const { data: status, setData } = useAsync(() => api.getStatus(), [api, path]);
  useEffect(() => window.applioEvents?.onStatus(setData), [setData]);
  if (!status) return null;

  const state = status.budgetStop ? 'Paused · daily budget used' : status.paused ? 'Paused' : status.engineReady ? 'Ready' : 'Needs setup';
  const tone = status.budgetStop ? 'stop' : status.paused || !status.engineReady ? 'warn' : 'ok';
  // Whole thousands past 10k, so "226.9k / 500k" doesn't run past the card.
  const tokens = (n: number) => formatTokens(n >= 10_000 && n < 1_000_000 ? Math.round(n / 1000) * 1000 : n);
  const pct = Math.min(100, Math.round((status.tokensToday / Math.max(1, status.dailyTokenBudget)) * 100));

  return (
    <div className="engine-card" aria-label="Engine status">
      <div className="engine-row">
        <span className={`engine-dot engine-dot-${tone}`} aria-hidden="true" />
        <span className="engine-name">{status.engine === 'claude-code' ? 'Claude Code' : 'Anthropic API'}</span>
        <span className="engine-state">{state}</span>
      </div>
      {status.budgetStop ? (
        <div className="engine-line">
          <span className="cell-sub">AI waits until tomorrow.</span>
          <a href="#/settings">Raise budget</a>
        </div>
      ) : null}
      <div className="engine-line">
        <span>Next run</span>
        <span className="mono">{status.paused || !status.nextRunAt ? 'Paused' : formatClock(status.nextRunAt)}</span>
      </div>
      <div>
        <div className="engine-line">
          <span>Tokens today</span>
          <span className="mono">{tokens(status.tokensToday)} / {tokens(status.dailyTokenBudget)}</span>
        </div>
        <div className={pct >= 80 ? 'engine-meter engine-meter-warn' : 'engine-meter'} role="meter" aria-label="Tokens used today" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
