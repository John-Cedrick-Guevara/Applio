import { useState } from 'react';
import type { Autonomy, Draft, Job } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { Button, buttonClass } from '../../components/button';
import { Icon } from '../../components/icons';
import { ScoreBlock } from '../../components/score-block';
import { useAction } from '../../hooks/use-action';
import { useAsync } from '../../hooks/use-async';
import { formatRelative, formatTokens } from '../../lib/format';
import { CHANNEL_LABEL } from '../../lib/labels';
import { navigate } from '../../lib/router';
import { DraftDocument, type DocTab } from './draft-document';
import { modeLabel, primaryAction, sentLine } from './review-model';
import { SourceCredit } from '../../components/source-credit';

interface DraftPanelProps {
  jobId: string;
  nextId?: string;
  thresholds: { draft: number; auto: number };
  autonomyBySource: Record<string, Autonomy>;
  onJobChange: (job: Job) => void;
}

/** Selected draft: match header, fit, documents and the approve/skip/edit footer. */
export function DraftPanel({ jobId, ...rest }: DraftPanelProps) {
  const api = useApi();
  const state = useAsync(async () => {
    const [job, draft] = await Promise.all([api.getJob(jobId), api.getDraft(jobId)]);
    return { job, draft };
  }, [api, jobId]);

  return (
    <section className="card card-flush draft-panel" aria-label="Draft detail">
      <AsyncView state={state} what="this draft" rows={6}>
        {({ job, draft }) => (
          <DraftDetail
            job={job}
            draft={draft}
            {...rest}
            onJob={(next) => {
              state.setData((d) => ({ ...d, job: next }));
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
  onJob: (job: Job) => void;
  onDraft: (draft: Draft) => void;
}

function DraftDetail({ job, draft, nextId, thresholds, autonomyBySource, onJob, onDraft }: DetailProps) {
  const api = useApi();
  const action = useAction();
  const [tab, setTab] = useState<DocTab>('letter');
  const [editing, setEditing] = useState(false);
  const primary = primaryAction(job);
  const waiting = job.status === 'drafted';
  const foundAt = job.history[0]?.at ?? job.postedAt;

  const approve = async () => {
    const next = await action.run('approve the draft', () => api.approveDraft(job.id));
    if (next) onJob(next);
  };

  const skip = async () => {
    const next = await action.run('skip the job', () => api.skipJob(job.id));
    if (!next) return;
    onJob(next);
    if (nextId) navigate(`/review/${nextId}`);
  };

  return (
    <>
      <div className="draft-head">
        <div className="draft-head-text">
          <div className="cell-sub">{job.company} · <SourceCredit job={job} /> · found {formatRelative(foundAt)}</div>
          <h2 className="draft-title">{job.title}</h2>
          <div className="tag-row">
            {job.tags.map((t) => <span key={t} className="tag">{t}</span>)}
          </div>
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

      {draft ? (
        <DraftDocument
          job={job}
          draft={draft}
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

      {!waiting && job.status !== 'skipped' ? (
        <div className="banner banner-success draft-sent">
          <span>{sentLine(job)}</span>
          <a href="#/applications">View in Applications</a>
        </div>
      ) : null}

      <div className="draft-footer">
        <div className="draft-footer-meta">
          <span>Apply via <strong>{CHANNEL_LABEL[job.channel]}</strong> · {job.applyTarget}</span>
          <span>Mode <strong>{modeLabel(job, autonomyBySource[job.sourceId] ?? 'draft')}</strong></span>
          <span className="mono">{formatTokens(job.tokensUsed)} tokens</span>
        </div>
        {waiting ? (
          <div className="row">
            <Button variant="ghost" busy={action.pending} onClick={skip}>Skip</Button>
            <Button disabled={!draft} onClick={() => { setTab('letter'); setEditing(true); }}>Edit</Button>
            {primary.handoff ? (
              <a className={buttonClass('primary')} href={`#/handoff/${job.id}`}>{primary.label}</a>
            ) : (
              <Button variant="primary" busy={action.pending} onClick={approve}>{primary.label}</Button>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
