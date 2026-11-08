import { useState } from 'react';
import type { Job, JobPreview, JobStatus } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button, buttonClass } from '../../components/button';
import { ScoreBlock } from '../../components/score-block';
import { useAction } from '../../hooks/use-action';
import { useAsync } from '../../hooks/use-async';
import { formatTokens } from '../../lib/format';
import { REVIEW_STATUSES } from '../../lib/job-lists';
import { AUTONOMY_LABEL, STATUS_LABEL } from '../../lib/labels';
import { EXAMPLES, inputError } from './add-job-model';
import './add-job.css';

type Mode = 'text' | 'link';

/**
 * Add job (prototype screen 7): paste a post or link from anywhere; Applio
 * reads it, scores it and works out how to apply before it joins the queue.
 */
export default function AddJobPage() {
  const api = useApi();
  const analyze = useAction();
  const { data: settings } = useAsync(() => api.getSettings(), [api]);
  // Analysis spends tokens, so a used-up budget disables it up front, with the reason, instead of failing on click.
  const { data: status } = useAsync(() => api.getStatus(), [api]);
  const budgetStop = status?.budgetStop;
  const [mode, setMode] = useState<Mode>('text');
  const [values, setValues] = useState<Record<Mode, string>>({ text: '', link: '' });
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<JobPreview | null>(null);
  const [added, setAdded] = useState<Job | null>(null);

  const setValue = (v: string) => {
    setValues((vs) => ({ ...vs, [mode]: v }));
    setError(null);
  };

  const run = async () => {
    const problem = inputError(mode, values[mode]);
    if (problem) return setError(problem);
    setPreview(null);
    setAdded(null);
    const result = await analyze.run('analyze the job', () => api.analyzeJob({ kind: mode, value: values[mode].trim() }));
    if (result) setPreview(result);
  };

  const reset = () => {
    setPreview(null);
    setAdded(null);
    setValues({ text: '', link: '' });
  };

  return (
    <div className="add-job">
      <header className="page-header">
        <div>
          <h1>Add a job</h1>
          <p>Paste the whole post from anywhere: LinkedIn, a Facebook group, Discord, an email. Or paste a link to a company's own job page. Applio reads it, scores it and works out how to apply.</p>
        </div>
      </header>

      <section className="card">
        <div className="spread">
          <div className="tabs" role="tablist" aria-label="Input type">
            {(['text', 'link'] as const).map((m) => (
              <button key={m} type="button" role="tab" className="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }}>
                {m === 'text' ? 'Paste text' : 'Paste link'}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setValue(EXAMPLES[mode])}>Use an example</Button>
        </div>

        {mode === 'link' ? (
          <div className="field">
            <label htmlFor="job-link">Job link</label>
            <input id="job-link" className="input input-lg" type="url" placeholder="https://" aria-describedby="job-link-hint" value={values.link} onChange={(e) => setValue(e.target.value)} />
            <p id="job-link-hint" className="cell-sub">A company careers page or a Greenhouse, Lever, Ashby or Workable link. Applio doesn't open LinkedIn, Indeed, JobStreet, Upwork or Facebook; paste those posts as text.</p>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="job-text">Job post</label>
            <textarea id="job-text" className="textarea job-text" value={values.text} onChange={(e) => setValue(e.target.value)} />
          </div>
        )}

        <div className="spread">
          {error ? (
            <span className="field-error" role="alert">{error}</span>
          ) : budgetStop ? (
            <span className="field-error">{budgetStop} <a href="#/settings">Raise budget</a></span>
          ) : (
            <span className="cell-sub">Reading and scoring uses about 8k tokens.</span>
          )}
          <Button variant="strong" busy={analyze.pending} disabled={!!budgetStop} onClick={run}>{analyze.pending ? 'Analyzing…' : 'Analyze job'}</Button>
        </div>
      </section>

      {analyze.pending ? (
        <section className="card" role="status" aria-busy="true">
          <div className="analyzing row"><span className="spinner" aria-hidden="true" />Claude is reading and scoring the post against your fact bank. This usually takes 20–40 seconds.</div>
          {/* Shaped like the result card, so nothing jumps when it arrives. */}
          <div className="skeleton-stack" aria-hidden="true">
            <div className="skeleton skeleton-line" style={{ width: '30%' }} />
            <div className="skeleton skeleton-title" style={{ width: '55%' }} />
            <div className="skeleton skeleton-line" style={{ width: '90%' }} />
            <div className="skeleton skeleton-line" style={{ width: '75%' }} />
          </div>
        </section>
      ) : null}

      {preview ? (
        <PreviewCard preview={preview} draftThreshold={settings?.draftThreshold ?? 75} added={added} onAdded={setAdded} onDiscard={reset} />
      ) : null}
    </div>
  );
}

interface PreviewProps {
  preview: JobPreview;
  draftThreshold: number;
  added: Job | null;
  onAdded: (job: Job) => void;
  onDiscard: () => void;
}

/** Where the job Applio already has lives: Review until it's out, Applications after. */
const existingHref = ({ jobId, status }: { jobId: string; status: JobStatus }) =>
  (REVIEW_STATUSES as readonly JobStatus[]).includes(status) ? `#/review/${jobId}` : '#/applications';

/** What was parsed and how Applio will apply; nothing is saved until "Add to review queue". */
function PreviewCard({ preview, draftThreshold, added, onAdded, onDiscard }: PreviewProps) {
  const api = useApi();
  const action = useAction();
  const above = preview.score >= draftThreshold;

  const add = async () => {
    const job = await action.run('add the job', () => api.addJob(preview));
    if (job) onAdded(job);
  };

  return (
    <section className="card card-flush" aria-label="Parsed job">
      <div className="preview-head">
        <div className="preview-text">
          <div className="cell-sub">{preview.company} · {preview.sourceName}</div>
          <h2 className="preview-title">{preview.title}</h2>
          <div className="tag-row">{preview.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
        </div>
        <ScoreBlock score={preview.score} note={above ? `Above draft threshold (${draftThreshold})` : `Below draft threshold (${draftThreshold})`} />
      </div>
      <p className="preview-summary body-text">{preview.summary}</p>
      <dl className="preview-facts">
        <div><dt>Apply channel</dt><dd className="strong">{preview.channelLabel}</dd></div>
        <div><dt>How Applio applies</dt><dd>{preview.route}</dd></div>
        <div>
          <dt>Highest autonomy</dt>
          <dd><span className={preview.maxAutonomy === 'autonomous' ? 'badge badge-success' : 'badge badge-warning'}>{AUTONOMY_LABEL[preview.maxAutonomy]}</span></dd>
        </div>
        <div><dt>Tokens used</dt><dd className="mono">{formatTokens(preview.tokensUsed)}</dd></div>
      </dl>
      {added ? (
        <div className="banner banner-success preview-done" role="status">
          <span>Added. Claude is drafting the résumé and cover letter in the background (one to two minutes). Follow it in Review under Drafting now.</span>
          <span className="row">
            <Button size="sm" onClick={onDiscard}>Add another</Button>
            <a href={`#/review/${added.id}`}>Go to Review</a>
          </span>
        </div>
      ) : preview.duplicate ? (
        <div className="banner banner-warning preview-done" role="status">
          <span>You already have this job in Applio ({STATUS_LABEL[preview.duplicate.status]}). Adding it again would make a second application.</span>
          <span className="row">
            <Button size="sm" onClick={onDiscard}>Discard</Button>
            <a className={buttonClass('primary', 'sm')} href={existingHref(preview.duplicate)}>Open existing</a>
          </span>
        </div>
      ) : (
        <div className="preview-actions">
          <Button onClick={onDiscard}>Discard</Button>
          <Button variant="primary" busy={action.pending} onClick={add}>Add to review queue</Button>
        </div>
      )}
    </section>
  );
}
