import type { ReactNode } from 'react';
import { Button } from './button';
import { Icon } from './icons';

/** busy = in progress, done = finished, needs = waiting on the operator, failed = broke. */
export type Tone = 'busy' | 'done' | 'needs' | 'failed' | 'neutral';

/** The mark beside a state's words, so no state is told by color alone. */
function ToneMark({ tone }: { tone: Tone }) {
  if (tone === 'busy') return <span className="spinner" aria-hidden="true" />;
  if (tone === 'done') return <Icon name="check" size={12} strokeWidth={2.4} aria-hidden="true" />;
  if (tone === 'needs' || tone === 'failed') return <span className="tone-bang" aria-hidden="true">!</span>;
  return null;
}

/** A job's status in a list row. Status only: plain facts (salary, location) stay text. */
export function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`status-chip status-chip-${tone}`}>
      <ToneMark tone={tone} />
      {children}
    </span>
  );
}

const CALLOUT_CLASS: Record<Exclude<Tone, 'neutral'>, string> = { busy: 'callout-info', done: 'callout-done', needs: 'callout-needs', failed: 'callout-failed' };

/**
 * One state message: a bold lead, at most one more sentence, and the action that
 * moves it on. Failures are alerts so screen readers interrupt for them.
 */
export function Callout({ tone, title, children, action }: {
  tone: Exclude<Tone, 'neutral'>;
  title: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void; busy?: boolean };
}) {
  return (
    <div role={tone === 'failed' ? 'alert' : 'status'} className={`callout ${CALLOUT_CLASS[tone]}`}>
      <ToneMark tone={tone} />
      <span className="callout-text"><strong>{title}</strong>{children ? <> {children}</> : null}</span>
      {action ? <Button size="sm" className="callout-action" busy={action.busy} onClick={action.onClick}>{action.label}</Button> : null}
    </div>
  );
}

export type StepState = 'done' | 'current' | 'blocked' | 'failed' | 'todo';
const STEP_WORDS: Record<StepState, string> = { done: 'done', current: 'in progress', blocked: 'needs you', failed: 'failed', todo: 'not yet' };

/** Where a job is in the pipeline (Found → Sent). The step it's on carries `aria-current`. */
export function Stepper({ label, steps }: { label: string; steps: { label: string; state: StepState }[] }) {
  return (
    <ol className="stepper" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s.label} className={`stepper-step stepper-${s.state}`} aria-label={`${s.label}: ${STEP_WORDS[s.state]}`} aria-current={s.state === 'todo' || s.state === 'done' ? undefined : 'step'}>
          <span className="stepper-dot" aria-hidden="true">
            {s.state === 'done' ? <Icon name="check" size={12} strokeWidth={2.4} /> : s.state === 'failed' || s.state === 'blocked' ? '!' : i + 1}
          </span>
          <span className="stepper-label" aria-hidden="true">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

/** The stages of one long task (drafting, a scan): done, the one running, and what's left. */
export function StepList({ label, steps }: { label: string; steps: { label: string; state: 'done' | 'active' | 'pending'; note?: string }[] }) {
  return (
    <ul className="step-list" aria-label={label}>
      {steps.map((s) => (
        <li key={s.label} className={`step-list-row step-list-${s.state}`}>
          {s.state === 'done' ? <Icon name="check" size={18} strokeWidth={2.2} aria-hidden="true" /> : s.state === 'active' ? <span className="spinner" aria-hidden="true" /> : <span className="step-list-pending" aria-hidden="true" />}
          <span className="step-list-label">{s.label}</span>
          <span className="step-list-note">{s.note ?? (s.state === 'done' ? 'Done' : '')}</span>
        </li>
      ))}
    </ul>
  );
}
