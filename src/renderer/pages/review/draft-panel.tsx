import { useId, useState } from 'react';
import type { Autonomy, Draft, Job, SendRecord } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { Button, buttonClass } from '../../components/button';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { Icon } from '../../components/icons';
import { Callout, Stepper } from '../../components/job-state';
import { ScoreBlock } from '../../components/score-block';
import { useAction } from '../../hooks/use-action';
import { useAsync } from '../../hooks/use-async';
import { useJobsVersion } from '../../hooks/use-jobs-version';
import { formatClock, formatRelative, formatTokens } from '../../lib/format';
import { CHANNEL_LABEL } from '../../lib/labels';
import { navigate } from '../../lib/router';
import type { DocumentOwner } from '../../../shared/templates/application-documents';
import { DraftDocument, type DocTab } from './draft-document';
import { filesState } from '../../lib/job-progress';
import { jobSteps, modeLabel, primaryAction, sendState, effortLevel, type SendState } from './review-model';
import { SourceCredit } from '../../components/source-credit';

interface DraftPanelProps {
  jobId: string;
  nextId?: string;
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

function DraftDetail({ job, draft, send, nextId, thresholds, owner, autonomyBySource, gmailIssue, onJob, onDraft }: DetailProps) {
  const api = useApi();
  const action = useAction();
  // Its own action, so a failed send's message stays on screen and never reads as a skip or edit error.
  const sending = useAction();
  const [tab, setTab] = useState<DocTab>('letter');
  const [editing, setEditing] = useState(false);
  // A suspicious post needs a second, explicit click to send (QA 2026-11-07 #7).
  const [confirming, setConfirming] = useState(false);
  const [askingSkip, setAskingSkip] = useState(false);
  const blockId = useId();
  const primary = primaryAction(job);
  const state = sendState(job, send);
  const waiting = job.status === 'drafted';
  const needsGmail = job.channel === 'email' ? gmailIssue : undefined;
  const files = filesState(job);
  const foundAt = job.history[0]?.at ?? job.postedAt;

  /** Approves (or retries) and then re-reads the job and its send log, so what's shown is what happened, success or not. */
  const approve = async () => {
    await sending.run('send the application', () => api.approveDraft(job.id), undefined, { quiet: true });
    try {
      const [next, nextSend] = await Promise.all([api.getJob(job.id), api.getSend(job.id)]);
      onJob(next, nextSend);
    } catch (err) {
      // The send's own result is already on screen; a failed re-read only leaves the old view, so it's logged, not shown.
      console.error('[review] failed to reload the job after sending', err);
    }
  };

  const markApplied = async () => {
    const next = await action.run('mark it applied', () => api.markApplied(job.id), 'Marked as applied');
    if (next) onJob(next, send);
  };

  const skip = async () => {
    setAskingSkip(false);
    const next = await action.run('skip the job', () => api.skipJob(job.id), `Skipped ${job.title} at ${job.company}`);
    if (!next) return;
    onJob(next, send);
    if (nextId) navigate(`/review/${nextId}`);
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
      {waiting && draft?.check?.stale ? (
        <div className="banner banner-warning draft-warning" role="status">
          <span>
            <strong>Made from an older profile.</strong> Your facts, contact details or notes for Claude changed since this was drafted, so it may say something no longer true.
          </span>
          <Button size="sm" busy={action.pending} onClick={redraft}>Redraft (≈ 25–40k tokens)</Button>
        </div>
      ) : null}
      {job.suspicious ? (
        <div className="banner banner-danger draft-warning" role="alert">
          <span>
            <strong>This post looks like it's trying to manipulate automated tools.</strong> {job.suspicious} Verify the company is real before sending. Applio only ever sends to {job.applyTarget}.
          </span>
        </div>
      ) : null}
      <div className="draft-steps"><Stepper label="Progress" steps={jobSteps(job, { send })} /></div>
      <div className="draft-head">
        <div className="draft-head-text">
          <div className="cell-sub">{job.company} · <SourceCredit job={job} /> · found {formatRelative(foundAt)}</div>
          <h2 className="draft-title">{job.title}</h2>
          {job.tags.length ? <p className="draft-facts">{job.tags.join(' · ')}</p> : null}
        </div>
        {job.score !== undefined ? (
          <ScoreBlock score={job.score} highAt={thresholds.auto} note={`Draft at ${thresholds.draft} · Auto at ${thresholds.auto}`} />
        ) : null}
      </div>

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
        {/* Where the application stands sits beside Approve, so the result of a click shows where the click was. */}
        <SendBanner
          state={state}
          channel={job.channel}
          busy={sending.pending || action.pending}
          onRetry={approve}
          onMarkApplied={markApplied}
          onSkip={skip}
          onOpenFolder={() => action.run('open the folder', () => api.openJobFolder(job.id))}
          handoffHref={`#/handoff/${job.id}`}
        />
        {waiting && sending.error ? (
          <div className="banner banner-danger" role="alert">
            <span><strong>Not sent.</strong> {sending.error} Nothing went out, and the draft is still here.</span>
          </div>
        ) : null}
        {waiting && confirming && !sending.pending ? (
          <div className="banner banner-danger" role="alert">
            <span>Send to {job.applyTarget} even though this post looks suspicious?</span>
            <div className="row">
              <Button size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button size="sm" variant="danger" onClick={() => { setConfirming(false); void approve(); }}>Send anyway</Button>
            </div>
          </div>
        ) : null}
        {waiting && files.kind === 'saving' ? <Callout tone="busy" title="Saving the résumé and letter PDFs.">Approve comes on in a moment.</Callout> : null}
        {waiting && files.kind === 'failed' ? (
          <Callout tone="failed" title="PDFs didn't save:" action={{ label: 'Retry saving PDFs', onClick: saveFiles, busy: action.pending }}>
            {files.reason.replace(/^Couldn't save the files: /, '')}. The draft is safe, and retrying costs no tokens.
          </Callout>
        ) : null}
        {waiting && needsGmail ? (
          <div className="banner banner-warning">
            <span>{needsGmail.message}</span>
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
            <Button busy={action.pending || sending.pending} onClick={() => setAskingSkip(true)}>Skip job</Button>
            <Button disabled={!draft} onClick={() => { setTab('letter'); setEditing(true); }}>Edit</Button>
            {primary.handoff ? (
              <a className={buttonClass('primary')} href={`#/handoff/${job.id}`}>{primary.label}</a>
            ) : needsGmail ? (
              <a className={buttonClass('primary')} href="#/settings">{needsGmail.action}</a>
            ) : (
              <Button variant="primary" busy={sending.pending} disabled={!!approveBlock} aria-describedby={approveBlock ? blockId : undefined} onClick={job.suspicious && !confirming ? () => setConfirming(true) : approve}>{sending.pending ? (job.channel === 'email' ? 'Sending…' : 'Submitting…') : primary.label}</Button>
            )}
          </div>
        ) : null}
      </div>
      {askingSkip ? (
        <ConfirmDialog title={`Skip job "${job.title}" at ${job.company}?`} confirmLabel="Skip job" onConfirm={skip} onCancel={() => setAskingSkip(false)}>
          It leaves your queue and nothing is sent.
        </ConfirmDialog>
      ) : null}
    </>
  );
}

interface SendBannerProps {
  state: SendState;
  channel: Job['channel'];
  busy: boolean;
  onRetry: () => void;
  onMarkApplied: () => void;
  onSkip: () => void;
  onOpenFolder: () => void;
  handoffHref: string;
}

/**
 * The one line that says where this application stands after the operator's
 * decision, with the next step for each state. Nothing here is inferred from
 * the status alone: Sent needs a sent record (`sendState`).
 */
function SendBanner({ state, channel, busy, onRetry, onMarkApplied, onSkip, onOpenFolder, handoffHref }: SendBannerProps) {
  switch (state.kind) {
    case 'waiting':
    case 'skipped':
      return null;
    case 'sent':
      return (
        <div className="banner banner-success draft-sent" role="status">
          <span>{state.line}{state.folder ? <> Saved to <strong>{state.folder}</strong>.</> : null}</span>
          <div className="row">
            {state.folder ? <Button size="sm" variant="link" onClick={onOpenFolder}>Open folder</Button> : null}
            <a href="#/applications">View in Applications</a>
          </div>
        </div>
      );
    case 'not-sent':
      return (
        <div className="banner banner-danger draft-sent" role="alert">
          <span><strong>{channel === 'email' ? 'Not sent.' : 'Not submitted.'}</strong> {state.reason}</span>
          <div className="row">
            {channel === 'email' ? <a href="#/settings">Check Gmail settings</a> : <Button size="sm" busy={busy} onClick={onMarkApplied}>I finished it myself</Button>}
            <Button size="sm" variant="primary" busy={busy} onClick={onRetry}>{busy ? (channel === 'email' ? 'Sending…' : 'Submitting…') : channel === 'email' ? 'Retry send' : 'Retry form'}</Button>
          </div>
        </div>
      );
    case 'unconfirmed':
      return (
        <div className="banner banner-warning draft-sent" role="alert">
          <span>
            A send started at {formatClock(state.at)} but never confirmed, so Applio can't tell whether it went out.{' '}
            {channel === 'email' ? "Check Gmail's Sent folder." : 'Check the form window and your email.'}
          </span>
          <div className="row">
            <Button size="sm" busy={busy} onClick={onSkip}>I didn't apply</Button>
            <Button size="sm" variant="primary" busy={busy} onClick={onMarkApplied}>Mark as applied</Button>
          </div>
        </div>
      );
    case 'handoff':
      return (
        <div className="banner banner-warning draft-sent">
          <span>Approved. This one is applied to by hand, so it waits for you in the handoff.</span>
          <a className={buttonClass('primary', 'sm')} href={handoffHref}>Open handoff</a>
        </div>
      );
    case 'applied-manually':
      return (
        <div className="banner banner-success draft-sent" role="status">
          <span>You applied to this one yourself, outside Applio.</span>
          <a href="#/applications">View in Applications</a>
        </div>
      );
  }
}
