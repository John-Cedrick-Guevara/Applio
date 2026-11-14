import type { Job } from '../../../shared/types';
import { Callout, StepList, Stepper } from '../../components/job-state';
import { ProgressBar } from '../../components/progress-bar';
import { useElapsed } from '../../hooks/use-elapsed';
import { stalledLine } from '../../lib/waits';
import { jobSteps } from './review-model';

/** "1:30" from milliseconds. */
const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

/**
 * Shown while Claude drafts a job in the background (one to two minutes). The
 * stages are the two Applio records: Claude's turn, then the PDFs. Elapsed time
 * comes from when main started the draft, so it survives a reload.
 */
export function DraftingPanel({ job, since }: { job?: Job; since?: string }) {
  const start = since ? Date.parse(since) : undefined;
  const ticking = useElapsed(Boolean(since), start);
  // No readable start time: no clock and no slow note, rather than "NaN".
  const elapsed = since && Number.isFinite(start) ? ticking : undefined;
  const slow = elapsed !== undefined ? stalledLine('draft', elapsed) : undefined;

  return (
    <section className="card draft-panel drafting-panel" aria-label="Drafting" aria-busy="true">
      {job ? <Stepper label="Progress" steps={jobSteps(job, { drafting: true })} /> : null}
      {job ? (
        <div>
          <div className="cell-sub">{job.company} · {job.sourceName}</div>
          <h2 className="draft-title">{job.title}</h2>
        </div>
      ) : null}
      <div className="drafting-status">
        <h3 className="drafting-title">Claude is writing the résumé and cover letter</h3>
        <span className="mono cell-sub">{elapsed !== undefined ? `${clock(elapsed)} elapsed · ` : ''}usually 1–2 minutes</span>
      </div>
      <StepList
        label="Drafting steps"
        steps={[
          { label: 'Claude writes the résumé and letter from your fact bank', state: 'active', note: 'In progress' },
          { label: 'Save the PDFs', state: 'pending' },
        ]}
      />
      <ProgressBar />
      {slow ? <Callout tone="needs" title={slow.title}>{slow.body}</Callout> : null}
      <p className="cell-sub">You can leave this page. It moves to Ready to send when the PDFs are saved.</p>
    </section>
  );
}
