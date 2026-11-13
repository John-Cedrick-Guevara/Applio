import { useId, useState } from 'react';
import type { Autonomy, Draft, Job, SendRecord } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { Button, buttonClass } from '../../components/button';
import { Icon } from '../../components/icons';
import { JobStateCard, Stepper } from '../../components/job-state';
import { ScoreBlock } from '../../components/score-block';
import { useAction } from '../../hooks/use-action';
import { useAsync } from '../../hooks/use-async';
import { useJobsVersion } from '../../hooks/use-jobs-version';
import { formatRelative, formatTokens } from '../../lib/format';
import { CHANNEL_LABEL } from '../../lib/labels';
import type { DocumentOwner } from '../../../shared/templates/application-documents';
import { DraftDocument, type DocTab } from './draft-document';
import { filesState } from '../../lib/job-progress';
import { draftCard, nextLine, type DraftCardKind } from './job-card';
import { jobSteps, modeLabel, primaryAction, sendState, effortLevel } from './review-model';
import { SourceCredit } from '../../components/source-credit';

interface DraftPanelProps {
  jobId: string;
  /** Whether main is working on this job right now (Claude's turn or the PDFs printing). */
  saving: boolean;
  /** The Inbox holds a skip with Undo and opens the next job (redesign v2). */
  onSkip: (job: Job) => void;
  /** Called once a decision is final (a sent record, or marked applied), with what to tell the operator. */
  onDecided: (job: Job, message: string) => void;
  thresholds: { draft: number; auto: number };
  /** Whose name and email go on the documents. */
  owner: DocumentOwner;
  autonomyBySource: Record<string, Autonomy>;
  /** Why an email draft can't send right now (Gmail missing or rejected), from `gmailIssue`. */
  gmailIssue?: { message: string; action: string };
  onJobChange: (job: Job) => void;
}

/** Selected draft: match header, fit, documents and the approve/skip/edit footer. */
export function DraftPanel({ jobId, ...rest }: DraftPanelProps) {
  const api = useApi();
  // Main reports job changes (the PDFs landing, a send, a redraft); reload so this panel never shows a stale state.
  // Existing data stays on screen while it reloads, so an edit in progress isn't lost.
  const jobsChanges = useJobsVersion();
  const state = useAsync(async () => {
    const [job, draft, send] = await Promise.all([api.getJob(jobId), api.getDraft(jobId), api.getSend(jobId)]);
    return { job, draft, send };
  }, [api, jobId, jobsChanges]);

  return (
    <section className="card card-flush draft-panel" aria-label="Draft detail">
      <AsyncView state={state} what="this draft" rows={6}>
        {({ job, draft, send }) => (
          <DraftDetail
            job={job}
            draft={draft}
            send={send}
            {...rest}
            onJob={(next, nextSend) => {
              state.setData((d) => ({ ...d, job: next, send: nextSend }));
              rest.onJobChange(next);
            }}
            onDraft={(next) => state.setData((d) => ({ ...d, draft: next }))}
          />
        )}
      </AsyncView>
    </section>
  );
}

interface DetailProps extends Omit<DraftPanelProps, 'jobId' | 'onJobChange'> {
  job: Job;
  draft: Draft | null;
  send: SendRecord | null;
  onJob: (job: Job, send: SendRecord | null) => void;
  onDraft: (draft: Draft) => void;
}

function DraftDetail({ job, draft, send, saving, onSkip, onDecided, thresholds, owner, autonomyBySource, gmailIssue, onJob, onDraft }: DetailProps) {
  const api = useApi();
  const action = useAction();
  // Its own action, so a failed send's message stays on screen and never reads as a skip or edit error.
  const sending = useAction();
  const [tab, setTab] = useState<DocTab>('letter');
  const [editing, setEditing] = useState(false);
  // A suspicious post needs a second, explicit click to send (QA 2026-11-07 #7).
  const [confirming, setConfirming] = useState(false);
  const blockId = useId();
  const primary = primaryAction(job);
  const state = sendState(job, send);
  const waiting = job.status === 'drafted';
  const needsGmail = job.channel === 'email' ? gmailIssue : undefined;
  const files = filesState(job, saving);
  const foundAt = job.history[0]?.at ?? job.postedAt;
  // One card for where the job stands; the rest of what applies folds under More notes.
  const { card, notes } = draftCard({ job, draft, send, saving, ...(waiting && sending.error ? { sendError: sending.error } : {}), ...(needsGmail ? { gmailIssue: needsGmail } : {}) });

  /** Approves (or retries) and then re-reads the job and its send log, so what's shown is what happened, success or not. */
  const approve = async () => {
    await sending.run('send the application', () => api.approveDraft(job.id), undefined, { quiet: true });
    try {
      const [next, nextSend] = await Promise.all([api.getJob(job.id), api.getSend(job.id)]);
      onJob(next, nextSend);
      // Only a sent record is a decision that moves on; a refused send stays here with Retry.
      const result = sendState(next, nextSend);
      if (result.kind === 'sent') onDecided(next, result.line);
    } catch (err) {
      // The send's own result is already on screen; a failed re-read only leaves the old view, so it's logged, not shown.
      console.error('[review] failed to reload the job after sending', err);
    }
  };

  const markApplied = async () => {
    const next = await action.run('mark it applied', () => api.markApplied(job.id));
    if (!next) return;
    onJob(next, send);
    onDecided(next, 'Marked as applied.');
  };

  // Reprints only: the draft is already saved, so this costs no tokens.
  const saveFiles = async () => {
    const next = await action.run('save the PDFs', () => api.saveDraftFiles(job.id), 'PDFs saved');
    if (next) onJob(next, send);
  };

  /** Why Approve is off, said beside it (never a silent disabled button). */
  const approveBlock = files.kind !== 'ready' ? 'Approve turns on once the PDFs are saved.'
    : draft?.check?.placeholders?.length ? 'Replace the placeholders in the letter first.'
    : undefined;

  const redraft = async () => {
    const next = await action.run('redraft', () => api.redraft(job.id), 'Redrafting from your current profile. It shows under Drafting now.');
    if (next) onJob(next, send);
  };

  return (
    <>
      <div className="draft-steps"><Stepper label="Progress" steps={jobSteps(job, { send, saving })} /></div>
      <div className="draft-head">
        <div className="draft-head-text">
          <div className="cell-sub">{job.company} · <SourceCredit job={job} /> · found {formatRelative(foundAt)}</div>
          <h2 className="draft-title">{job.title}</h2>
          {job.tags.length ? <p className="draft-facts">{job.tags.join(' · ')}</p> : null}
        </div>
        {job.score !== undefined ? (
          <ScoreBlock score={job.score} highAt={thresholds.auto} note={`Draft bar ${thresholds.draft} · Auto-send at ${thresholds.auto}`} />
        ) : null}
      </div>

      <JobStateCard card={card} next={nextLine(job, send)} notes={notes}>
        <CardActions
          kind={card.kind}
          job={job}
          folder={state.kind === 'sent' ? state.folder : undefined}
          busy={action.pending || sending.pending}
          onRetrySend={approve}
          onSaveFiles={saveFiles}
          onRedraft={redraft}
          onEditLetter={() => { setTab('letter'); setEditing(true); }}
          onMarkApplied={markApplied}
          onSkip={() => onSkip(job)}
          onOpenFolder={() => action.run('open the folder', () => api.openJobFolder(job.id))}
        />
      </JobStateCard>

      <div className="draft-fit">
        <div>
          <h3 className="section-label">The role</h3>
          <p className="body-text">{job.roleSummary}</p>
        </div>
        <div>
          <h3 className="section-label">Fit</h3>
          <ul className="list-plain fit-list">
            {job.strengths.map((s) => (
              <li key={s}><Icon name="check" strokeWidth={2} className="fit-icon" />{s}</li>
            ))}
            {job.gaps.map((g) => (
              <li key={g} className="fit-gap"><Icon name="minus" strokeWidth={2} className="fit-icon" />{g}</li>
            ))}
          </ul>
        </div>
      </div>

      {draft?.keywords ? (
        <div className="draft-keywords">
          <h3 className="section-label">Keywords · Effort: {effortLevel(job.score ?? 0)}</h3>
          <ul className="tag-row list-plain" aria-label="Keywords you can claim">
            {draft.keywords.claimed.map((k) => <li key={k.keyword} className="tag">{k.keyword}</li>)}
          </ul>
          {draft.keywords.gaps.length ? (
            <ul className="tag-row list-plain keyword-gaps" aria-label="Keyword gaps">
              {draft.keywords.gaps.map((g) => <li key={g} className="tag tag-warning">{g}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      {draft ? (
        <DraftDocument
          job={job}
          draft={draft}
          owner={owner}
          tab={tab}
          onTab={(t) => {
            setTab(t);
            setEditing(false);
          }}
          editing={editing}
          onEditDone={(next) => {
            setEditing(false);
            if (next) onDraft(next);
          }}
        />
      ) : null}

      <div className="draft-footer">
        {waiting && confirming && !sending.pending ? (
          <div className="banner banner-danger" role="alert">
            <span>Send to {job.applyTarget} even though this post looks suspicious?</span>
            <div className="row">
              <Button size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button size="sm" variant="danger" onClick={() => { setConfirming(false); void approve(); }}>Send anyway</Button>
            </div>
          </div>
        ) : null}
        <div className="draft-footer-meta">
          <span>Apply via <strong>{CHANNEL_LABEL[job.channel]}</strong> · {job.applyTarget}</span>
          <span>Mode <strong>{modeLabel(job, autonomyBySource[job.sourceId] ?? 'draft')}</strong></span>
          <span className="mono">{formatTokens(job.tokensUsed)} tokens</span>
        </div>
        {waiting && approveBlock && !primary.handoff && !needsGmail ? <span id={blockId} className="cell-sub draft-block">{approveBlock}</span> : null}
        {waiting ? (
          <div className="row">
            <Button busy={action.pending || sending.pending} onClick={() => onSkip(job)}>Skip job</Button>
            <Button disabled={!draft} onClick={() => { setTab('letter'); setEditing(true); }}>Edit</Button>
            {primary.handoff ? (
              <a className={buttonClass('primary')} href={`#/handoff/${job.id}`}>{primary.label}</a>
            ) : needsGmail ? (
              <a className={buttonClass('primary')} href="#/settings">{needsGmail.action}</a>
            ) : (
              <Button id="approve-primary" variant="primary" busy={sending.pending} disabled={!!approveBlock} aria-describedby={approveBlock ? blockId : undefined} onClick={job.suspicious && !confirming ? () => setConfirming(true) : approve}>{sending.pending ? (job.channel === 'email' ? 'Sending…' : 'Submitting…') : primary.label}</Button>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

interface CardActionsProps {
  kind: DraftCardKind;
  job: Job;
  folder?: string;
  busy: boolean;
  onRetrySend: () => void;
  onSaveFiles: () => void;
  onRedraft: () => void;
  onEditLetter: () => void;
  onMarkApplied: () => void;
  onSkip: () => void;
  onOpenFolder: () => void;
}

/**
 * The action that moves the card's state on. Approve, Edit and Skip stay in the
 * footer; the card carries recovery (Retry, Redraft, Retry saving PDFs) and the
 * next step after a decision. Nothing here is inferred from the status alone.
 */
function CardActions({ kind, job, folder, busy, onRetrySend, onSaveFiles, onRedraft, onEditLetter, onMarkApplied, onSkip, onOpenFolder }: CardActionsProps) {
  const email = job.channel === 'email';
  switch (kind) {
    case 'send-error':
    case 'not-sent':
      return (
        <>
          <Button size="sm" variant="primary" busy={busy} onClick={onRetrySend}>{busy ? (email ? 'Sending…' : 'Submitting…') : email ? 'Retry send' : 'Retry form'}</Button>
          {email ? <a href="#/settings">Check Gmail settings</a> : kind === 'not-sent' ? <Button size="sm" busy={busy} onClick={onMarkApplied}>I finished it myself</Button> : null}
        </>
      );
    case 'files-failed':
      return <Button size="sm" busy={busy} onClick={onSaveFiles}>Retry saving PDFs</Button>;
    case 'placeholders':
      return <Button size="sm" onClick={onEditLetter}>Edit letter</Button>;
    case 'stale':
      return <Button size="sm" busy={busy} onClick={onRedraft}>Redraft (≈ 25–40k tokens)</Button>;
    case 'unconfirmed':
      return (
        <>
          <Button size="sm" variant="primary" busy={busy} onClick={onMarkApplied}>Mark as applied</Button>
          <Button size="sm" busy={busy} onClick={onSkip}>I didn't apply</Button>
        </>
      );
    case 'handed-off':
      return <a className={buttonClass('primary', 'sm')} href={`#/handoff/${job.id}`}>Open handoff</a>;
    case 'sent':
      return (
        <>
          {folder ? <Button size="sm" variant="link" onClick={onOpenFolder}>Open folder</Button> : null}
          <a href="#/applications">View in Applications</a>
        </>
      );
    case 'applied':
      return <a href="#/applications">View in Applications</a>;
    default:
      return null;
  }
}
