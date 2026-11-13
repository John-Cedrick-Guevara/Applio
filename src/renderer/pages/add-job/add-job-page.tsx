import { useEffect, useState } from 'react';
import type { Job, JobPreview, JobStatus } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button, buttonClass } from '../../components/button';
import { Callout, StepList, Stepper, type StepState } from '../../components/job-state';
import { ScoreBlock } from '../../components/score-block';
import { useAction } from '../../hooks/use-action';
import { useAsync } from '../../hooks/use-async';
import { useJobsVersion } from '../../hooks/use-jobs-version';
import { formatTokens } from '../../lib/format';
import { filesState, pendingReason } from '../../lib/job-progress';
import { REVIEW_STATUSES } from '../../lib/job-lists';
import { AUTONOMY_LABEL, LIFECYCLE, STATUS_LABEL } from '../../lib/labels';
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

  // The same five stages as everywhere else: New (pasted) → Matched (checked) → Drafted → Ready → Sent.
  // The draft's own state comes from DraftProgress; a checked match and a ready draft wait on the operator.
  const [draftDone, setDraftDone] = useState(false);
  const stage = added ? (draftDone ? 3 : 2) : preview || analyze.pending ? 1 : 0;
  const steps = LIFECYCLE.map((label, i): { label: string; state: StepState } => ({
    label,
    state: i < stage ? 'done' : i > stage ? 'todo' : (preview && !added) || draftDone ? 'blocked' : 'current',
  }));

  return (
    <div className="add-job">
      <header className="page-header">
        <div>
          <h1>Add a job</h1>
          <p>Paste the whole post from anywhere: LinkedIn, a Facebook group, Discord, an email. Or paste a link to a company's own job page. Applio reads it, scores it and works out how to apply.</p>
        </div>
      </header>

      <Stepper label="Steps" steps={steps} />

      {preview ? null : <section className="card">
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
          <Button variant="strong" busy={analyze.pending} disabled={!!budgetStop} onClick={run}>{analyze.pending ? 'Checking the match…' : 'Check the match'}</Button>
        </div>
      </section>}

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
        <PreviewCard
          preview={preview}
          draftThreshold={settings?.draftThreshold ?? 75}
          added={added}
          onAdded={(job) => { setDraftDone(false); setAdded(job); }}
          onEdit={() => setPreview(null)}
          onDiscard={reset}
          onDraftDone={setDraftDone}
        />
      ) : null}
    </div>
  );
}

interface PreviewProps {
  preview: JobPreview;
  draftThreshold: number;
  added: Job | null;
  onAdded: (job: Job) => void;
  /** Back to the post, keeping what was pasted. */
  onEdit: () => void;
  /** Clears everything for the next job. */
  onDiscard: () => void;
  onDraftDone: (done: boolean) => void;
}

/** Where the job Applio already has lives: Review until it's out, Applications after. */
const existingHref = ({ jobId, status }: { jobId: string; status: JobStatus }) =>
  (REVIEW_STATUSES as readonly JobStatus[]).includes(status) ? `#/inbox/${jobId}` : '#/applications';

/** What was parsed and how Applio will apply; nothing is saved until "Add to review queue". */
function PreviewCard({ preview, draftThreshold, added, onAdded, onEdit, onDiscard, onDraftDone }: PreviewProps) {
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
          {preview.tags.length ? <p className="preview-tags-line">{preview.tags.join(' · ')}</p> : null}
        </div>
        <ScoreBlock score={preview.score} note={above ? `At or above your draft bar (${draftThreshold})` : `Below your draft bar (${draftThreshold})`} />
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
        <DraftProgress job={added} onDone={onDraftDone} onAnother={onDiscard} />
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
          <Button onClick={onEdit}>Edit the post</Button>
          <Button variant="primary" busy={action.pending} onClick={add}>Add and draft</Button>
        </div>
      )}
    </section>
  );
}

/** "0:42" from milliseconds. */
const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

/**
 * The added job's draft, followed live on this page: main's status pushes say
 * while Claude drafts (and since when), and the job record says when the PDFs land
 * or why they didn't. Never inferred: each state reads a record.
 */
function DraftProgress({ job, onDone, onAnother }: { job: Job; onDone: (done: boolean) => void; onAnother: () => void }) {
  const api = useApi();
  const version = useJobsVersion();
  const { data: current } = useAsync(() => api.getJob(job.id), [api, job.id, version]);
  const [drafting, setDrafting] = useState<{ ids: string[]; since: Record<string, string> }>({ ids: [], since: {} });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => window.applioEvents?.onStatus((s) => setDrafting({ ids: s.drafting ?? [], since: s.draftingSince ?? {} })), []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const shown = current ?? job;
  const busy = drafting.ids.includes(job.id);
  const files = shown.status === 'drafted' ? filesState(shown) : undefined;
  const ready = !busy && files?.kind === 'ready';
  useEffect(() => onDone(ready), [ready, onDone]);
  const since = drafting.since[job.id];

  return (
    <section className="preview-progress" aria-label="Draft progress">
      {busy ? (
        <>
          <div className="spread">
            <strong>Drafting</strong>
            <span className="mono cell-sub">{since ? `${clock(Math.max(0, now - Date.parse(since)))} elapsed · ` : ''}usually 1–2 minutes</span>
          </div>
          <StepList label="Drafting steps" steps={[{ label: 'Claude is writing the résumé and letter from your fact bank', state: 'active', note: 'In progress' }, { label: 'Save the PDFs', state: 'pending' }]} />
        </>
      ) : ready ? (
        <Callout tone="done" title="Ready to review.">The résumé and letter are saved and wait for your approval.</Callout>
      ) : files?.kind === 'failed' ? (
        <Callout tone="failed" title="PDFs didn't save.">Retry from Review; it costs no tokens.</Callout>
      ) : files?.kind === 'saving' ? (
        <Callout tone="busy" title="Saving the résumé and letter PDFs." />
      ) : shown.status === 'scored' ? (
        <Callout tone="needs" title="Not drafted yet.">{pendingReason(shown)}</Callout>
      ) : (
        <Callout tone="busy" title="Added." >Claude starts drafting in a moment.</Callout>
      )}
      <div className="row preview-progress-actions">
        <Button onClick={onAnother}>Add another job</Button>
        <a className={buttonClass(ready ? 'primary' : 'secondary')} href={`#/inbox/${job.id}`}>{ready ? 'Review and approve' : 'Open in Inbox'}</a>
      </div>
    </section>
  );
}
