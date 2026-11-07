import type { Job } from '../../../shared/types';

/**
 * Shown while Claude drafts a job in the background (one to two minutes). Shaped
 * like the draft that replaces it, so nothing jumps when it lands.
 */
export function DraftingPanel({ job }: { job?: Job }) {
  return (
    <section className="card draft-panel drafting-panel" aria-label="Drafting" aria-busy="true">
      {job ? (
        <div>
          <div className="cell-sub">{job.company} · {job.sourceName}</div>
          <h2 className="draft-title">{job.title}</h2>
        </div>
      ) : null}
      <p className="row drafting-status" role="status">
        <span className="spinner" aria-hidden="true" />
        Claude is writing the résumé and cover letter from your fact bank. This usually takes one to two minutes; you can leave this page.
      </p>
      <div className="skeleton-stack" aria-hidden="true">
        <div className="skeleton skeleton-line" style={{ width: '40%' }} />
        <div className="skeleton skeleton-line" style={{ width: '95%' }} />
        <div className="skeleton skeleton-line" style={{ width: '88%' }} />
        <div className="skeleton skeleton-line" style={{ width: '92%' }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    </section>
  );
}
