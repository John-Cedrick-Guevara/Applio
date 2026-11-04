import type { Usage, UsageStep } from '../../../shared/types';
import { formatShortDate, formatTokens } from '../../lib/format';

const STEP_LABEL: Record<UsageStep, string> = {
  tailor: 'Tailoring resume + cover letter',
  score: 'Scoring and summaries',
  answers: 'Form answers (new only)',
  prep: 'Interview prep',
  'follow-up': 'Follow-up drafts',
};

/** Horizontal bars per pipeline step, scaled to the largest. */
export function StepBars({ steps }: { steps: Usage['tokensByStep'] }) {
  const max = Math.max(1, ...steps.map((s) => s.tokens));
  return (
    <ul className="list-plain step-bars">
      {steps.map((s) => (
        <li key={s.step}>
          <div className="spread step-line">
            <span>{STEP_LABEL[s.step]}</span>
            <span className="mono cell-secondary">{formatTokens(s.tokens)}</span>
          </div>
          <div className="meter" aria-hidden="true">
            <div className="meter-fill" style={{ width: `${(s.tokens / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const CHART_HEIGHT = 140;

/**
 * Column chart of the last 7 days against the daily budget line. Plain markup
 * with one accessible description — no chart library for seven bars.
 */
export function DayChart({ days, budget }: { days: Usage['tokensByDay']; budget: number }) {
  const label = (d: { date: string }, i: number) => (i === days.length - 1 ? 'Today' : formatShortDate(`${d.date}T12:00:00Z`));
  const description = `Tokens per day: ${days.map((d, i) => `${label(d, i)} ${formatTokens(d.tokens)}`).join(', ')}`;

  return (
    <div className="day-chart" role="img" aria-label={description}>
      <span className="budget-line" aria-hidden="true" />
      <span className="budget-label" aria-hidden="true">{formatTokens(budget)}</span>
      {days.map((d, i) => (
        <div key={d.date} className="day-col" aria-hidden="true">
          <span className="mono day-value">{formatTokens(d.tokens)}</span>
          <div
            className={i === days.length - 1 ? 'day-bar day-bar-today' : 'day-bar'}
            style={{ height: Math.round(Math.min(1, d.tokens / budget) * CHART_HEIGHT) }}
          />
          <span className="day-label">{label(d, i)}</span>
        </div>
      ))}
    </div>
  );
}
