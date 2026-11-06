import { useState } from 'react';
import { nextStatuses } from '../../../shared/status';
import type { InterviewPrep, Job, JobStatus } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { useAction } from '../../hooks/use-action';
import { useAsync } from '../../hooks/use-async';
import { formatShortDate, formatTokens } from '../../lib/format';
import { CHANNEL_LABEL } from '../../lib/labels';
import { sentAt, timeline, type DisplayStatus } from './applications-model';
import { StatusBadge } from './status-badge';
import { SourceCredit } from '../../components/source-credit';

interface DetailProps {
  job: Job;
  status: DisplayStatus;
  followUpDays: number;
  now: Date;
  onJob: (job: Job) => void;
}

/** Side panel: timeline, what was sent, and the next useful action (prep or follow-up). */
export function ApplicationDetail({ job, status, followUpDays, now, onJob }: DetailProps) {
  const api = useApi();
  const os = useAction();
  const [panel, setPanel] = useState<'prep' | 'follow' | null>(null);
  const events = timeline(job, followUpDays, now);
  const canPrep = status === 'Replied' || status === 'Interview' || status === 'Offer';

  return (
    <aside className="card app-detail" aria-label="Application detail">
      <div>
        <div className="cell-sub">{job.company} · <SourceCredit job={job} /></div>
        <h2 className="app-detail-title">{job.title}</h2>
        <StatusBadge status={status} />
      </div>

      <div>
        <h3 className="section-label">Timeline</h3>
        <ol className="list-plain timeline">
          {events.map((e, i) => (
            <li key={`${e.title}-${i}`} className={i === events.length - 1 ? 'is-last' : undefined}>
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <div className="timeline-title">{e.title}</div>
                <div className="cell-sub">{e.meta}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <WhatWasSent job={job} />

      {panel === 'prep' ? <PrepPanel jobId={job.id} /> : null}
      {panel === 'follow' ? <FollowUpPanel job={job} onCancel={() => setPanel(null)} onSent={(next) => { setPanel(null); onJob(next); }} /> : null}

      <div className="row">
        {canPrep ? (
          <Button variant="primary" onClick={() => setPanel(panel === 'prep' ? null : 'prep')}>
            {panel === 'prep' ? 'Hide prep' : 'Interview prep'}
          </Button>
        ) : null}
        {status === 'Follow-up due' && panel !== 'follow' ? (
          <Button variant="primary" onClick={() => setPanel('follow')}>Draft follow-up</Button>
        ) : null}
        <Button disabled={!job.folderPath} onClick={() => os.run('open the folder', () => api.openJobFolder(job.id))}>Open folder</Button>
      </div>
      <StatusCorrection job={job} onJob={onJob} />
    </aside>
  );
}

const STATUS_WORD: Partial<Record<JobStatus, string>> = { applied: 'Applied', replied: 'Replied', interview: 'Interview', offer: 'Offer', rejected: 'Rejected', ghosted: 'No reply' };

/** For a reply Applio didn't catch: move the application on yourself, within the status rules (SPEC F7). */
function StatusCorrection({ job, onJob }: { job: Job; onJob: (job: Job) => void }) {
  const api = useApi();
  const action = useAction();
  const moves = nextStatuses(job.status).filter((s) => STATUS_WORD[s]);
  if (moves.length === 0) return null;
  const move = async (status: JobStatus) => {
    const next = await action.run('change the status', () => api.setStatus(job.id, status, 'Corrected by you'), `Marked ${STATUS_WORD[status]}`);
    if (next) onJob(next);
  };
  return (
    <div className="field">
      <label htmlFor={`correct-${job.id}`}>Correct status</label>
      <select id={`correct-${job.id}`} className="select" value="" disabled={action.pending} onChange={(e) => e.target.value && move(e.target.value as JobStatus)}>
        <option value="">Choose…</option>
        {moves.map((s) => <option key={s} value={s}>{STATUS_WORD[s]}</option>)}
      </select>
    </div>
  );
}

/** Exactly what went out (SPEC F7): email subject and opening, or the form summary, plus saved files. */
function WhatWasSent({ job }: { job: Job }) {
  const api = useApi();
  const { data: draft } = useAsync(() => api.getDraft(job.id), [api, job.id]);
  const sent = sentAt(job);
  const isEmail = job.channel === 'email';
  const aiAnswers = draft?.answers.filter((a) => a.origin === 'ai').length ?? 0;

  return (
    <div>
      <h3 className="section-label">What was sent</h3>
      <div className="sent-box">
        <div className="cell-sub">
          {isEmail ? `Subject: Application — ${job.title} — [Your Name]` : `${CHANNEL_LABEL[job.channel]} · ${sent ? formatShortDate(sent) : ''}`}
        </div>
        <p className="sent-body">
          {isEmail
            ? `${draft?.coverLetter.replace(/\s+/g, ' ').slice(0, 180) ?? ''}…`
            : `Form answers, resume and cover letter as submitted. ${draft?.answers.length ?? 0} answers, ${aiAnswers} written new by AI.`}
        </p>
        <div className="row">
          {['resume.pdf', draft?.kind === 'proposal' ? 'proposal.md' : 'cover-letter.pdf', 'sent.md'].map((f) => (
            <span key={f} className="file-chip mono">{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Generated interview prep; costs tokens, so it loads only when opened. */
function PrepPanel({ jobId }: { jobId: string }) {
  const api = useApi();
  const prep = useAsync<InterviewPrep>(() => api.getInterviewPrep(jobId), [api, jobId]);
  if (!prep.data) return <p className="cell-sub" role="status">{prep.error ? "Couldn't generate prep. Try again." : 'Preparing…'}</p>;
  const p = prep.data;

  return (
    <div className="side-panel">
      <div className="spread">
        <span className="side-panel-title">Interview prep</span>
        <span className="cell-sub mono">{formatTokens(p.tokens)} tokens</span>
      </div>
      <PrepList title="What you told them" items={p.told} />
      <PrepList title="Likely questions" items={p.likelyQuestions} />
      <PrepList title="Ask them" items={p.askThem} />
    </div>
  );
}

function PrepList({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <div className="section-label prep-heading">{title}</div>
      <ul className="prep-list">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </>
  );
}

/** Follow-up editor; sending is always the operator's explicit action (SPEC F7). */
function FollowUpPanel({ job, onCancel, onSent }: { job: Job; onCancel: () => void; onSent: (job: Job) => void }) {
  const api = useApi();
  const action = useAction();
  const sent = sentAt(job);
  const [text, setText] = useState(
    `Hi ${job.company} team,\n\nFollowing up on my application for the ${job.title} role, sent ${sent ? formatShortDate(sent) : 'recently'}. I am still very interested and happy to share more detail on any of my work.\n\nBest,\n[Your Name]`,
  );

  const send = async () => {
    const next = await action.run('send the follow-up', () => api.sendFollowUp(job.id, text), 'Follow-up sent from your Gmail · logged to the timeline');
    if (next) onSent(next);
  };

  return (
    <div className="side-panel stack-sm">
      <label htmlFor="follow-text" className="field-label">Follow-up to {job.company}</label>
      <textarea id="follow-text" className="textarea" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="form-actions">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="sm" busy={action.pending} disabled={!text.trim()} onClick={send}>Send follow-up</Button>
      </div>
    </div>
  );
}
