import type { Job } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { Icon } from '../../components/icons';
import { ScoreBlock } from '../../components/score-block';
import { SourceCredit } from '../../components/source-credit';
import { useAction } from '../../hooks/use-action';
import { CHANNEL_LABEL } from '../../lib/labels';
import { navigate } from '../../lib/router';
import { pendingReason } from '../../lib/job-progress';

interface JobPanelProps {
  job: Job;
  draftThreshold: number;
  /** Why AI is stopped for now (budget used up); disables Draft this one with that reason. */
  budgetStop?: string;
  /** Called after a draft starts or the job is dismissed, so the queue reloads. */
  onChanged: () => void;
}

/**
 * A job with no draft: scored below the threshold, or not scored yet (QA 2026-11-07 #5).
 * Shows why it wasn't drafted and what it is, with Draft this one and Dismiss, so a
 * good match under the threshold is one click from a draft instead of a settings change.
 */
export function JobPanel({ job, draftThreshold, budgetStop, onChanged }: JobPanelProps) {
  const api = useApi();
  const action = useAction();
  const scored = job.status === 'scored';
  const strong = scored && (job.score ?? 0) >= draftThreshold;
  // A strong match's own draft failure says more than "not drafted yet".
  const failedDraft = job.history.findLast((e) => e.note?.startsWith('Not drafted'))?.note;

  const draft = async () => {
    const next = await action.run('start the draft', () => api.draftJob(job.id), 'Drafting started. It shows under Drafting now.');
    if (next) onChanged();
  };

  const dismiss = async () => {
    const next = await action.run('dismiss the job', () => api.skipJob(job.id), `Dismissed ${job.title} at ${job.company}`);
    if (!next) return;
    navigate('/review');
    onChanged();
  };

  return (
    <section className="card card-flush draft-panel" aria-label="Job detail">
      <div className="draft-head">
        <div className="draft-head-text">
          <div className="cell-sub">{job.company} · <SourceCredit job={job} /></div>
          <h2 className="draft-title">{job.title}</h2>
          {job.tags.length ? <p className="draft-facts">{job.tags.join(' · ')}</p> : null}
        </div>
        {job.score !== undefined ? <ScoreBlock score={job.score} note={`Draft at ${draftThreshold}`} /> : null}
      </div>

      <div className="banner banner-warning draft-warning" role="status">
        <span>
          {strong
            ? failedDraft ? `${failedDraft} Draft it again when you're ready.` : `Strong match (${job.score ?? 0}, your draft score is ${draftThreshold}). Not drafted yet: scans only draft when you ask.`
            : scored
            ? `Not drafted: its match score (${job.score ?? 0}) is below your draft score (${draftThreshold}). Draft it anyway if it looks right.`
            : `${pendingReason(job)}. Your next scan picks it up.`}
        </span>
      </div>

      <div className="draft-fit">
        <div>
          <h3 className="section-label">The role</h3>
          <p className="body-text">{job.roleSummary ?? job.descriptionSummary ?? 'Not summarized yet.'}</p>
          {job.url ? <a href={job.url} target="_blank" rel="noreferrer">Original post</a> : null}
        </div>
        <div>
          <h3 className="section-label">Fit</h3>
          <ul className="list-plain fit-list">
            {job.strengths.map((s) => <li key={s}><Icon name="check" strokeWidth={2} className="fit-icon" />{s}</li>)}
            {job.gaps.map((g) => <li key={g} className="fit-gap"><Icon name="minus" strokeWidth={2} className="fit-icon" />{g}</li>)}
          </ul>
        </div>
      </div>

      <div className="draft-footer">
        <div className="draft-footer-meta">
          <span>Apply via <strong>{CHANNEL_LABEL[job.channel]}</strong> · {job.applyTarget}</span>
          {scored ? <span>{budgetStop ?? 'A draft takes about 25–40k tokens and one to two minutes.'}</span> : null}
        </div>
        <div className="row">
          <Button busy={action.pending} onClick={dismiss}>Dismiss</Button>
          {scored ? <Button variant="primary" busy={action.pending} disabled={!!budgetStop} onClick={draft}>Draft this one</Button> : null}
        </div>
      </div>
    </section>
  );
}
