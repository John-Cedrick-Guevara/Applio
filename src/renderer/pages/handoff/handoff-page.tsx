import { useState } from 'react';
import { connectsCost } from '../../../shared/connects';
import type { Draft, Job } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { Button } from '../../components/button';
import { CopyButton } from '../../components/copy-button';
import { FileIcon, Icon } from '../../components/icons';
import { useAction } from '../../hooks/use-action';
import { useAsync } from '../../hooks/use-async';
import { formatClock, formatTokens } from '../../lib/format';
import { EMPLOYMENT_LABEL } from '../../lib/labels';
import type { RouteParams } from '../../lib/router';
import './handoff.css';
import { SourceCredit } from '../../components/source-credit';

/**
 * Manual handoff (prototype screen 2, SPEC F5): for channels Applio never
 * submits on, everything is ready to copy and the operator applies, then logs it.
 */
export default function HandoffPage({ params }: { params: RouteParams }) {
  const api = useApi();
  const id = params.id ?? '';
  const state = useAsync(async () => {
    const [job, draft, settings] = await Promise.all([api.getJob(id), api.getDraft(id), api.getSettings()]);
    const assisted = (job.channel === 'platform' || job.channel === 'custom') && settings.assistedFill[job.channel];
    return { job, draft, assisted };
  }, [api, id]);

  return (
    <AsyncView state={state} what="this handoff" rows={5}>
      {({ job, draft, assisted }) => <Handoff key={job.id} job={job} draft={draft} assisted={assisted} onJob={(next) => state.setData((d) => ({ ...d, job: next }))} />}
    </AsyncView>
  );
}

function Handoff({ job, draft, assisted, onJob }: { job: Job; draft: Draft | null; assisted: boolean; onJob: (job: Job) => void }) {
  const api = useApi();
  const os = useAction();
  const fill = useAction();
  const [filled, setFilled] = useState<{ filled: number; missing: string[] } | null>(null);
  const connects = job.platform === 'Upwork' ? connectsCost(job.description) : undefined;
  const platform = job.platform ?? 'the site';
  const letterWord = draft?.kind === 'proposal' ? 'Proposal' : 'Cover letter';
  // Steps are numbered as rendered, so a skipped one (no screening questions) leaves no gap.
  let step = 0;
  const next = () => ++step;

  return (
    <>
      <header>
        <a href={`#/inbox/${job.id}`} className="back-link">← Inbox · Hand off</a>
        <h1 className="handoff-title">Apply to <strong>{job.company}</strong> on {platform}</h1>
        <p className="muted handoff-lede">
          {assisted
            ? `Applio can fill the form in its own window, signed in as you. You check it and click Submit. Applio never submits on ${platform}.`
            : `Assisted fill is off for ${platform}, so you apply yourself. Everything is ready to copy. Applio never submits on ${platform}.`}
        </p>
        {draft?.check?.stale ? (
          <div className="banner banner-warning" role="status">
            <span>
              <strong>Made from an older profile.</strong> Your facts, contact details or notes changed since this was drafted. Redraft it in the <a href={`#/inbox/${job.id}`}>Inbox</a> before you copy it.
            </span>
          </div>
        ) : null}
        {job.platform === 'Upwork' ? (
          <p className="handoff-lede strong">
            {connects !== undefined ? `This proposal costs ${connects} Connects on Upwork.` : 'Upwork charges Connects for every proposal. Check the cost on the job page before you submit.'}
          </p>
        ) : null}
      </header>

      <section className="handoff-strip" aria-label="Job">
        {job.score !== undefined ? <span className="handoff-strip-score" aria-label={`Match ${job.score}`}>{job.score}</span> : null}
        <div className="handoff-strip-text">
          <h2 className="aside-title">{job.title}</h2>
          <div className="cell-sub">{job.company} · <SourceCredit job={job} /> · {EMPLOYMENT_LABEL[job.employmentType]} · {job.applyTarget}{job.salary ? ` · ${job.salary}` : ''}</div>
          {job.roleSummary ? <p className="body-text">{job.roleSummary}</p> : null}
        </div>
        <span className="cell-sub">{formatTokens(job.tokensUsed)} tokens used</span>
      </section>

      <div className="handoff-layout">
        <ol className="list-plain handoff-steps">
          {assisted ? (
            <Step n={next()} title="Fill the form in Applio" sub={`The first time, sign in to ${platform} in the window that opens.`}>
              <Button
                variant="primary"
                busy={fill.pending}
                onClick={async () => {
                  const result = await fill.run('fill the form', () => api.assistFill(job.id));
                  if (result) setFilled(result);
                }}
              >
                Fill it in Applio
              </Button>
              {filled ? (
                <div className="stack-sm">
                  <p className="body-text">Filled {filled.filled} fields. Check them in the window, then click Submit yourself.</p>
                  {filled.missing.length > 0 ? (
                    <>
                      <p className="cell-sub">Still for you:</p>
                      <ul className="list-plain">{filled.missing.map((m) => <li key={m}>{m}</li>)}</ul>
                    </>
                  ) : null}
                </div>
              ) : null}
            </Step>
          ) : (
            <Step n={next()} title="Open the job" sub="Opens in your browser, where you are already signed in.">
              <Button onClick={() => os.run('open the job', () => api.openExternal(job.url))}>
                Open on {platform}
                <Icon name="external" size={14} strokeWidth={1.8} />
              </Button>
            </Step>
          )}

          <Step n={next()} title="Upload your tailored resume">
            <div className="handoff-box handoff-file">
              <FileIcon />
              <div className="handoff-file-text">
                <div className="handoff-file-name">resume.pdf</div>
                <div className="mono cell-sub path-wrap">{job.folderPath ?? 'Not saved yet'}/</div>
              </div>
              <Button disabled={!job.folderPath} onClick={() => os.run('open the folder', () => api.openJobFolder(job.id))}>Show in folder</Button>
            </div>
          </Step>

          {draft && draft.answers.length > 0 ? (
            <Step n={next()} title="Answer the screening questions">
              <div className="stack-sm">
                {draft.answers.map((a, i) => (
                  <div key={a.question} className="handoff-box handoff-answer">
                    <div className="handoff-answer-text">
                      <div className="cell-sub">{a.question}</div>
                      <div className="handoff-answer-body">{a.answer}</div>
                      <span className={a.origin === 'bank' ? 'badge badge-neutral' : 'badge badge-accent'}>
                        {a.origin === 'bank' ? 'Answer bank' : `New · written by AI · ${formatTokens(a.tokens)} tokens · saved to answer bank`}
                      </span>
                    </div>
                    <CopyButton text={a.answer} what={`answer ${i + 1}`} />
                  </div>
                ))}
              </div>
            </Step>
          ) : null}

          {draft ? (
            <Step n={next()} title={<>{letterWord} <span className="step-aside">· if the form asks</span></>} action={<CopyButton text={draft.coverLetter} what={letterWord.toLowerCase()} />}>
              <p className="pre handoff-letter">{draft.coverLetter}</p>
            </Step>
          ) : null}

          <li className="card handoff-step">
            <DoneStep n={next()} job={job} platform={platform} onJob={onJob} />
          </li>
        </ol>

        {assisted ? null : (
          <section className="handoff-tip">
            <div className="handoff-tip-title">Want this filled for you?</div>
            <p>Turn on assisted fill for {job.channel === 'custom' ? 'company career sites' : `${platform} and other platforms`}. Applio opens the form in its own window and fills it in. You still click Submit.</p>
            <a href="#/settings">Channel settings</a>
          </section>
        )}
      </div>
    </>
  );
}

/** Numbered step card. */
function Step({ n, title, sub, action, children }: { n: number; title: React.ReactNode; sub?: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="card handoff-step">
      <div className="step-head">
        <span className="step-num" aria-hidden="true">{n}</span>
        <div className="step-title-wrap">
          <div className="step-title">{title}</div>
          {sub ? <div className="cell-sub">{sub}</div> : null}
        </div>
        {action}
        {!action && children && n === 1 ? children : null}
      </div>
      {children && n !== 1 ? <div className="step-body">{children}</div> : null}
    </li>
  );
}

/** Final step: log the outcome so it lands in Applications (SPEC F5 "Mark as applied"). */
function DoneStep({ n, job, platform, onJob }: { n: number; job: Job; platform: string; onJob: (job: Job) => void }) {
  const api = useApi();
  const action = useAction();
  const [outcome, setOutcome] = useState<'applied' | 'skipped' | null>(null);

  const finish = async (kind: 'applied' | 'skipped') => {
    const next = await action.run(kind === 'applied' ? 'log the application' : 'skip the job', () =>
      kind === 'applied' ? api.markApplied(job.id) : api.skipJob(job.id),
    );
    if (!next) return;
    onJob(next);
    setOutcome(kind);
  };

  if (outcome) {
    const at = job.history.at(-1)?.at;
    return (
      <div className="spread handoff-done" role="status">
        <div className="row">
          <Icon name="doneCircle" size={20} strokeWidth={2} className="done-icon" />
          <span>
            {outcome === 'applied'
              ? `Logged as applied via ${job.applyTarget}${at ? ` at ${formatClock(new Date().toISOString())}` : ''}.`
              : 'Marked as not applied. The job stays in Applications as Skipped.'}
          </span>
        </div>
        <a href="#/applications">View in Applications</a>
      </div>
    );
  }

  return (
    <div className="step-head">
      <span className="step-num" aria-hidden="true">{n}</span>
      <div className="step-title-wrap">
        <div className="step-title">Done on {platform}?</div>
        <div className="cell-sub">Logs what you sent to Applications and starts reply tracking.</div>
      </div>
      <Button busy={action.pending} onClick={() => finish('skipped')}>I didn't apply</Button>
      <Button variant="primary" busy={action.pending} onClick={() => finish('applied')}>Mark as applied</Button>
    </div>
  );
}
