import { useEffect, useState } from 'react';
import type { Job } from '../../../shared/types';
import { Callout, StepList, Stepper } from '../../components/job-state';
import { jobSteps } from './review-model';

/** Past this, the panel says drafting is slow; it still ends in a draft or a note. */
const SLOW_MS = 3 * 60_000;

/** "1:30" from milliseconds. */
const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

/**
 * Shown while Claude drafts a job in the background (one to two minutes). The
 * stages are the two Applio records: Claude's turn, then the PDFs. Elapsed time
 * comes from when main started the draft, so it survives a reload.
 */
export function DraftingPanel({ job, since }: { job?: Job; since?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = since ? Math.max(0, now - Date.parse(since)) : undefined;

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
      {elapsed !== undefined && elapsed > SLOW_MS ? (
        <Callout tone="needs" title="Taking longer than usual.">It still ends with a draft, or a note here saying what went wrong.</Callout>
      ) : null}
      <div className="skeleton-stack" aria-hidden="true">
        <div className="skeleton skeleton-line" style={{ width: '40%' }} />
        <div className="skeleton skeleton-line" style={{ width: '95%' }} />
        <div className="skeleton skeleton-line" style={{ width: '88%' }} />
      </div>
      <p className="cell-sub">You can leave this page. It moves to Ready to send when the PDFs are saved.</p>
    </section>
  );
}
