import { useState } from 'react';
import type { Usage, UsagePeriod } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { useAsync } from '../../hooks/use-async';
import { formatTokens } from '../../lib/format';
import { DayChart, StepBars } from './token-charts';
import { QuotaTable } from './quota-table';
import './usage.css';

/** Usage & limits (prototype screen 5, SPEC F10): what was spent and what's left on every free tier. */
export default function UsagePage() {
  const api = useApi();
  const [period, setPeriod] = useState<UsagePeriod>('today');
  const usage = useAsync(() => api.getUsage(period), [api, period]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Usage &amp; limits</h1>
          <p>Nothing runs past a hard stop until you raise the limit.</p>
        </div>
        <div className="tabs period-toggle" role="group" aria-label="Period">
          {(['today', 'month'] as const).map((p) => (
            <button key={p} type="button" className="tab" aria-pressed={period === p} onClick={() => setPeriod(p)}>
              {p === 'today' ? 'Today' : 'This month'}
            </button>
          ))}
        </div>
      </header>
      <AsyncView state={usage} what="usage" rows={5}>
        {(u) => <UsageBody usage={u} />}
      </AsyncView>
    </>
  );
}

function UsageBody({ usage }: { usage: Usage }) {
  const { summary, period } = usage;
  const today = period === 'today';
  const pct = Math.round((summary.tokens / summary.tokenBudget) * 100);
  const b = summary.sentBreakdown;

  return (
    <>
      <div className="tiles">
        <Tile label="Claude tokens" value={formatTokens(summary.tokens)} of={`/ ${formatTokens(summary.tokenBudget)}`} note={`${pct}% of ${today ? 'daily' : 'monthly'} budget`} />
        <Tile
          label="Applications sent"
          value={String(summary.sent)}
          of={summary.sentLimit ? `/ ${summary.sentLimit}` : ''}
          note={`${b.autonomous} auto · ${b.approved} approved · ${b.manual} manual`}
        />
        <Tile label="Avg tokens per application" value={formatTokens(summary.avgTokensPerApplication)} note={summary.avgNote} />
        <Tile
          label="Saved by answer bank"
          value={`~${formatTokens(summary.savedByAnswerBank.tokens)}`}
          of="tokens, estimated"
          note={`${summary.savedByAnswerBank.answersReused} answers reused`}
        />
      </div>

      <QuotaTable quotas={usage.quotas} />

      <div className="usage-row">
        <section className="card usage-half">
          <div className="card-header">
            <div>
              <h2>Where tokens went</h2>
              <p>{today ? 'Today, by pipeline step' : 'This month, by pipeline step'}</p>
            </div>
          </div>
          <StepBars steps={usage.tokensByStep} />
        </section>
        <section className="card usage-half">
          <div className="card-header">
            <div>
              <h2>Last 7 days</h2>
              <p>Claude tokens per day, against your {formatTokens(usage.dailyTokenBudget)} daily budget</p>
            </div>
          </div>
          <DayChart days={usage.tokensByDay} budget={usage.dailyTokenBudget} />
        </section>
      </div>
    </>
  );
}

function Tile({ label, value, of, note }: { label: string; value: string; of?: string; note: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">
        <span className="mono">{value}</span>
        {of ? <span className="tile-of">{of}</span> : null}
      </div>
      <div className="cell-sub">{note}</div>
    </div>
  );
}
