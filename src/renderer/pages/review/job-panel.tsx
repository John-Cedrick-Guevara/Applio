import type { Job } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { Icon } from '../../components/icons';
import { ScoreBlock } from '../../components/score-block';
import { SourceCredit } from '../../components/source-credit';
import { useAction } from '../../hooks/use-action';
import { CHANNEL_LABEL } from '../../lib/labels';
import { navigate } from '../../lib/router';
import { JobStateCard, Stepper } from '../../components/job-state';
import { jobSteps } from './review-model';
import { undraftedCard } from './job-card';

interface JobPanelProps {
  job: Job;
  draftThreshold: number;
  /** Why AI is stopped for now (budget used up); disables Draft this one with that reason. */
  budgetStop?: string;
  /** Called after a draft starts or the job is dismissed, so the queue reloads. */
  onChanged: () => void;
}

/**
 * A job with no draft: scored below the draft bar, or not scored yet (QA 2026-11-07 #5).
 * One state card says why it wasn't drafted, with Draft this one and Skip job, so a
 * good match under the threshold is one click from a draft instead of a settings change.
 */
export function JobPanel({ job, draftThreshold, budgetStop, onChanged }: JobPanelProps) {
  const api = useApi();
  const action = useAction();
  const scored = job.status === 'scored';
  const card = undraftedCard(job, { draftBar: draftThreshold, ...(budgetStop ? { budgetStop } : {}) });

  const draft = async () => {
    const next = await action.run('start the draft', () => api.draftJob(job.id), 'Drafting started. It shows under Drafting now.');
    if (next) onChanged();
  };

  const skip = async () => {
    const next = await action.run('skip the job', () => api.skipJob(job.id), `Skipped ${job.title} at ${job.company}`);
    if (!next) return;
    navigate('/inbox');
    onChanged();
  };

  return (
    <section className="card card-flush draft-panel" aria-label="Job detail">
      <div className="draft-steps"><Stepper label="Progress" steps={jobSteps(job)} /></div>
      <div className="draft-head">
        <div className="draft-head-text">
          <div className="cell-sub">{job.company} · <SourceCredit job={job} /></div>
          <h2 className="draft-title">{job.title}</h2>
          {job.tags.length ? <p className="draft-facts">{job.tags.join(' · ')}</p> : null}
        </div>
        {job.score !== undefined ? <ScoreBlock score={job.score} note={`Draft bar ${draftThreshold}`} /> : null}
      </div>

      <JobStateCard card={card} next={scored && !budgetStop ? 'Nothing happens until you draft it: scans only draft when you ask.' : undefined} notes={[]} />

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
          {scored && !budgetStop ? <span>A draft takes about 25–40k tokens and one to two minutes.</span> : null}
        </div>
        <div className="row">
          <Button busy={action.pending} onClick={skip}>Skip job</Button>
          {scored ? <Button variant="primary" busy={action.pending} disabled={!!budgetStop} onClick={draft}>Draft this one</Button> : null}
        </div>
      </div>
    </section>
  );
}
