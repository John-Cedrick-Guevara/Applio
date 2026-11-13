import { useEffect, useState } from 'react';
import type { Autonomy, Job } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { Button, buttonClass } from '../../components/button';
import { useToast } from '../../components/toast';
import { useAction } from '../../hooks/use-action';
import { useHeldAction } from '../../hooks/use-held-action';
import { useAsync } from '../../hooks/use-async';
import { useJobsVersion } from '../../hooks/use-jobs-version';
import { navigate, type RouteParams } from '../../lib/router';
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
  const api = useApi();
  const action = useAction();
  const toast = useToast();
  const [sort, setSort] = useState<InboxSort>('score');
  const [autoNext, setAutoNext] = useState(true);
  // Skipped jobs leave the list at once; the skip is held with Undo, and a failed save brings the job back.
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const unhide = (ids: string[]) => setGone((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
  const skips = useHeldAction(async (ids) => {
    for (const id of ids) if (!(await action.run('skip the job', () => api.skipJob(id)))) unhide([id]);
  });

  const tabs = inboxTabs(data.queue.filter((j) => !gone.has(j.id)), data.asking.filter((j) => !isDrafting(j.id) && !gone.has(j.id)), sort);
  // In tab order, so "next" after a decision is the next job in the same tab, then the next tab.
  const ordered = tabs.flatMap((t) => t.jobs);
  const currentId = selectedId ?? ordered[0]?.id;
  const current = ordered.find((j) => j.id === currentId);
  /** The job after this one in tab order, else the one before it. */
  const nextAfter = (id: string) => {
    const i = ordered.findIndex((j) => j.id === id);
    return (ordered[i + 1] ?? ordered[i - 1])?.id;
  };
  const open = (id?: string) => navigate(id ? `/inbox/${id}` : '/inbox');

  const skip = (job: Job) => {
    const next = nextAfter(job.id);
    setGone((prev) => new Set([...prev, job.id]));
    skips.hold([job.id], `Skipped ${job.title} at ${job.company}.`);
    open(next);
  };
  const undo = () => {
    const ids = skips.held?.ids ?? [];
    unhide(ids);
    skips.undo();
    open(ids[0]);
  };
  /** A final decision (sent, or marked applied): say what happened and, if asked, open the next job. */
  const decided = (job: Job, message: string) => {
    if (!autoNext) return;
    toast.show(message, 'success');
    open(nextAfter(job.id));
  };
  // A presses the open job's own Approve button, so every rule on it (disabled reason, suspicious confirm) still applies.
  const approveKey = () => {
    const button = document.getElementById('approve-primary');
    if (button instanceof HTMLButtonElement && !button.disabled) button.click();
  };

  return (
    <>
      <ReviewHeader status={data.status} />
      <div className="split">
        <InboxQueue
          tabs={tabs}
          drafting={drafting}
          {...(currentId ? { currentId } : {})}
          sort={sort}
          onSort={setSort}
          autoNext={autoNext}
          onAutoNext={setAutoNext}
          onApproveKey={approveKey}
          onSkipKey={() => current && skip(current)}
        />
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
            onSkip={skip}
            onDecided={decided}
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
              <a className={buttonClass('secondary')} href="#/get-jobs">Get jobs</a>
              <a className={buttonClass('primary')} href="#/matches">Open Matches</a>
            </div>
          </section>
        )}
      </div>
      {skips.held ? (
        <div className="undo-bar" role="status" aria-label="Undo">
          <span>{skips.held.message}</span>
          <Button size="sm" variant="link" onClick={undo}>Undo</Button>
        </div>
      ) : null}
    </>
  );
}
