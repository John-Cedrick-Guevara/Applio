import { useState } from 'react';
import { nextStatuses } from '../../../shared/status';
import type { InterviewPrep, Job, JobStatus } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { useAction } from '../../hooks/use-action';
import { useAsync } from '../../hooks/use-async';
import { formatShortDate, formatTokens } from '../../lib/format';
import { CHANNEL_LABEL } from '../../lib/labels';
import { followUpDraft, followUpProblem, timeline, type DisplayStatus } from './applications-model';
import { StatusBadge } from './status-badge';
import { SourceCredit } from '../../components/source-credit';

interface DetailProps {
  job: Job;
  status: DisplayStatus;
  followUpDays: number;
  now: Date;
  /** The operator's name from Settings, which signs follow-ups. */
  ownerName: string;
  onJob: (job: Job) => void;
}

/** Side panel: timeline, what was sent, and the next useful action (prep or follow-up). */
export function ApplicationDetail({ job, status, followUpDays, now, ownerName, onJob }: DetailProps) {
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
      {panel === 'follow' ? <FollowUpPanel job={job} ownerName={ownerName} onCancel={() => setPanel(null)} onSent={(next) => { setPanel(null); onJob(next); }} /> : null}

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

/**
 * Exactly what went out (SPEC F7), read only from the send log: recipient, subject,
 * body and attachments as stored. Editing the draft later never changes it. An
 * application the operator made outside Applio says so instead.
 */
function WhatWasSent({ job }: { job: Job }) {
  const api = useApi();
  const { data: send, loading } = useAsync(() => api.getSend(job.id), [api, job.id]);
  const files = useAction();
  const [full, setFull] = useState(false);
  if (loading) return null;

  if (send?.state !== 'sent') {
    return (
      <div>
        <h3 className="section-label">What was sent</h3>
        <div className="sent-box">
          <p className="sent-body">You applied to this one yourself, outside Applio, so it has no record of what was sent. The documents you were given are in the job folder.</p>
        </div>
      </div>
    );
  }
  const isEmail = send.channel === 'email';
  const long = send.body.split('\n').length > 6;
  return (
    <div>
      <h3 className="section-label">What was sent</h3>
      <div className="sent-box">
        <dl className="sent-meta cell-sub">
          <div><dt>{isEmail ? 'To' : 'Form'}</dt><dd className="mono">{send.to}</dd></div>
          {isEmail ? <div><dt>Subject</dt><dd>{send.subject}</dd></div> : null}
          <div><dt>Sent</dt><dd>{formatShortDate(send.at)} · {CHANNEL_LABEL[send.channel]}</dd></div>
        </dl>
        <p className={full || !long ? 'sent-body sent-body-full' : 'sent-body sent-body-clamped'}>{send.body}</p>
        {long ? <Button size="sm" variant="link" onClick={() => setFull((f) => !f)}>{full ? 'Show less' : 'Show all'}</Button> : null}
        <div className="row" aria-label="Attachments">
          {send.attachments.map((f) => (
            <button key={f} type="button" className="file-chip mono" title={`Open ${f}`} onClick={() => files.run('open the file', () => api.openDraftFile(job.id, /letter|cover|proposal/i.test(f) ? 'letter' : 'resume'))}>
              {f}
            </button>
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
function FollowUpPanel({ job, ownerName, onCancel, onSent }: { job: Job; ownerName: string; onCancel: () => void; onSent: (job: Job) => void }) {
  const api = useApi();
  const action = useAction();
  const [text, setText] = useState(() => followUpDraft(job, ownerName));
  const problem = followUpProblem(text, ownerName);

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
        <Button variant="primary" size="sm" busy={action.pending} disabled={!!problem} aria-describedby={problem ? 'follow-problem' : undefined} onClick={send}>Send follow-up</Button>
      </div>
      {problem ? (
        <p id="follow-problem" className="field-hint">
          {problem} {problem.startsWith('Add your name') ? <a href="#/settings">Open Settings</a> : null}
        </p>
      ) : null}
    </div>
  );
}
