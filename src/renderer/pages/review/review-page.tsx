import { useEffect, useMemo, useState } from 'react';
import type { Autonomy, Job } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { buttonClass } from '../../components/button';
import { useAsync } from '../../hooks/use-async';
import { useJobsVersion } from '../../hooks/use-jobs-version';
import type { RouteParams } from '../../lib/router';
import { DraftPanel } from './draft-panel';
import { DraftingPanel } from './drafting-panel';
import { JobPanel } from './job-panel';
import { QuestionsPanel } from './questions-panel';
import { ReviewHeader } from './review-header';
import { InboxQueue } from './inbox-queue';
import { gmailIssue, inboxTabs, type InboxSort } from './review-model';
import './review.css';

/** Everything Review needs, loaded together so the split view renders in one pass. Covers every status in `REVIEW_STATUSES`. */
async function loadReview(api: ReturnType<typeof useApi>) {
  const [drafted, approved, scored, found, settings, profile, sources, status, openQuestions] = await Promise.all([
    api.listJobs({ statuses: ['drafted'] }),
    // Approved but not out yet (a refused send, a form handed back, a handoff to finish): still the operator's to act on.
    api.listJobs({ statuses: ['approved'] }),
    api.listJobs({ statuses: ['scored'] }),
    api.listJobs({ statuses: ['found'] }),
    api.getSettings(),
    api.getProfile(),
    api.listSources(),
    api.getStatus(),
    api.listQuestions(),
  ]);
  const questions = new Map(openQuestions.map((q) => [q.jobId, q.questions]));
  return {
    queue: [...approved, ...drafted],
    // Claude asked before drafting these; they wait for the operator (SPEC F4).
    asking: scored.filter((j) => questions.has(j.id)),
    questions,
    sections: profile.factGroups.map((g) => g.name),
    // Jobs without a draft yet: Claude may be drafting any of them, and Matches links to them here.
    undrafted: [...scored, ...found],
    thresholds: { draft: settings.draftThreshold, auto: settings.autoSendThreshold },
    gmailIssue: gmailIssue(settings),
    owner: { name: settings.fullName, email: settings.gmailAddress, contact: profile.contact, groups: profile.factGroups },
    autonomyBySource: Object.fromEntries(sources.map((s) => [s.id, s.autonomy])) as Record<string, Autonomy>,
    status,
  };
}

/**
 * Inbox (redesign v2): only jobs waiting on a decision, one tab at a time, with the
 * selected job beside the list. Undrafted jobs live in Matches but still open here.
 * The selection lives in the URL (`#/inbox/:id`) so back/forward and deep links work.
 */
export default function ReviewPage({ params }: { params: RouteParams }) {
  const api = useApi();
  const jobsChanges = useJobsVersion();
  const state = useAsync(() => loadReview(api), [api, jobsChanges]);

  /** Swaps an updated job into the queue (approved, skipped, edited). */
  const updateJob = (job: Job) => state.setData((d) => ({ ...d, queue: d.queue.map((j) => (j.id === job.id ? job : j)) }));

  return (
    <AsyncView state={state} what="the review queue" rows={6}>
      {(data) => (
        <ReviewLayout
          data={data}
          selectedId={params.id}
          onJobChange={updateJob}
          onRunComplete={state.reload}
        />
      )}
    </AsyncView>
  );
}

interface LayoutProps {
  data: Awaited<ReturnType<typeof loadReview>>;
  selectedId?: string;
  onJobChange: (job: Job) => void;
  onRunComplete: () => void;
}

function ReviewLayout({ data, selectedId, onJobChange, onRunComplete }: LayoutProps) {
  // Which jobs Claude is drafting right now, kept live from main's status pushes.
  const [draftingIds, setDraftingIds] = useState<string[]>(data.status.drafting ?? []);
  const [draftingSince, setDraftingSince] = useState(data.status.draftingSince ?? {});
  useEffect(() => window.applioEvents?.onStatus((s) => {
    setDraftingIds(s.drafting ?? []);
    setDraftingSince(s.draftingSince ?? {});
  }), []);
  const drafting = data.undrafted.filter((j) => draftingIds.includes(j.id));
  const isDrafting = (id: string) => draftingIds.includes(id);
  const [sort, setSort] = useState<InboxSort>('score');
  const tabs = inboxTabs(data.queue, data.asking.filter((j) => !isDrafting(j.id)), sort);
  // In tab order, so "next" after a decision is the next job in the same tab, then the next tab.
  const ordered = tabs.flatMap((t) => t.jobs);
  const currentId = selectedId ?? ordered[0]?.id;
  const nextId = useMemo(() => {
    const i = ordered.findIndex((j) => j.id === currentId);
    return ordered.slice(i + 1).find((j) => j.status === 'drafted')?.id;
  }, [ordered, currentId]);

  return (
    <>
      <ReviewHeader status={data.status} />
      <div className="split">
        <InboxQueue tabs={tabs} drafting={drafting} {...(currentId ? { currentId } : {})} sort={sort} onSort={setSort} />
        {currentId && isDrafting(currentId) && !data.queue.some((j) => j.id === currentId) ? (
          <DraftingPanel job={drafting.find((j) => j.id === currentId)} since={draftingSince[currentId]} />
        ) : currentId && data.questions.has(currentId) ? (
          <QuestionsPanel
            key={currentId}
            job={data.asking.find((j) => j.id === currentId)!}
            questions={data.questions.get(currentId)!}
            sections={data.sections}
            onAnswered={onRunComplete}
          />
        ) : currentId && data.undrafted.some((j) => j.id === currentId) ? (
          <JobPanel
            key={currentId}
            job={data.undrafted.find((j) => j.id === currentId)!}
            draftThreshold={data.thresholds.draft}
            {...(data.status.budgetStop ? { budgetStop: data.status.budgetStop } : {})}
            onChanged={onRunComplete}
          />
        ) : currentId ? (
          <DraftPanel
            key={currentId}
            jobId={currentId}
            nextId={nextId}
            thresholds={data.thresholds}
            owner={data.owner}
            autonomyBySource={data.autonomyBySource}
            gmailIssue={data.gmailIssue}
            onJobChange={onJobChange}
          />
        ) : (
          <section className="card review-empty" aria-label="Draft detail">
            <h2>Nothing needs a decision</h2>
            <p className="muted">Drafts land here when they're ready. Draft a match, or find new jobs.</p>
            <div className="row">
              <a className={buttonClass('secondary')} href="#/find-jobs">Find jobs</a>
              <a className={buttonClass('primary')} href="#/matches">Open Matches</a>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
