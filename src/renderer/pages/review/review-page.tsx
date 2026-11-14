import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Autonomy, Job } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { Button, buttonClass } from '../../components/button';
import { SidePanel } from '../../components/side-panel';
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
  // Nothing opens by itself: the panel shows only the job named in the URL.
  const currentId = selectedId;
  const current = ordered.find((j) => j.id === currentId);
  // A link to a job that is no longer a decision (sent, skipped, gone) closes instead of opening an empty panel.
  const known = !!currentId && [...data.queue, ...data.asking, ...data.undrafted].some((j) => j.id === currentId);
  useEffect(() => {
    if (currentId && !known) navigate('/inbox');
  }, [currentId, known]);
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
    toast.show(message, 'success');
    if (autoNext) open(nextAfter(job.id));
  };
  // A presses the open job's own Approve button, so every rule on it (disabled reason, suspicious confirm) still applies.
  const approveKey = () => {
    const button = document.getElementById('approve-primary');
    if (button instanceof HTMLButtonElement && !button.disabled) button.click();
  };

  // A and S act on the open job, but never while the operator is typing in a field. On the document so they
  // work right after the panel opens, when focus is on its first button.
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    const t = e.target as HTMLElement;
    // A held key repeats; one press must decide one job.
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || t.closest('input:not([type=checkbox]), textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'a' || e.key === 'A') approveKey();
    else if ((e.key === 's' || e.key === 'S') && current) skip(current);
  };
  const panelOpen = !!currentId;
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => keys.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panelOpen]);
  /** Previous/next within the tab the open job sits in. */
  const tab = tabs.find((t) => t.jobs.some((j) => j.id === currentId));
  const at = tab ? tab.jobs.findIndex((j) => j.id === currentId) : -1;
  const position = tab && at >= 0 ? { index: at + 1, total: tab.jobs.length, onPrev: () => open(tab.jobs[at - 1]?.id), onNext: () => open(tab.jobs[at + 1]?.id) } : undefined;
  const heading = current?.title ?? drafting.find((j) => j.id === currentId)?.title ?? data.undrafted.find((j) => j.id === currentId)?.title ?? 'Job';

  const detail = !currentId || !known ? null : isDrafting(currentId) && !data.queue.some((j) => j.id === currentId) ? (
    <DraftingPanel job={drafting.find((j) => j.id === currentId)} since={draftingSince[currentId]} />
  ) : data.questions.has(currentId) ? (
    <QuestionsPanel
      key={currentId}
      job={data.asking.find((j) => j.id === currentId)!}
      questions={data.questions.get(currentId)!}
      sections={data.sections}
      onAnswered={onRunComplete}
    />
  ) : data.undrafted.some((j) => j.id === currentId) ? (
    <JobPanel
      key={currentId}
      job={data.undrafted.find((j) => j.id === currentId)!}
      draftThreshold={data.thresholds.draft}
      {...(data.status.budgetStop ? { budgetStop: data.status.budgetStop } : {})}
      onChanged={onRunComplete}
    />
  ) : (
    <DraftPanel
      key={currentId}
      jobId={currentId}
      saving={isDrafting(currentId)}
      onSkip={skip}
      onDecided={decided}
      thresholds={data.thresholds}
      owner={data.owner}
      autonomyBySource={data.autonomyBySource}
      gmailIssue={data.gmailIssue}
      onJobChange={onJobChange}
    />
  );

  return (
    <>
      <ReviewHeader status={data.status} />
      {ordered.length === 0 && drafting.length === 0 ? (
        <section className="card review-empty" aria-label="Draft detail">
          <h2>Nothing needs a decision</h2>
          <p className="muted">Drafts land here when they're ready. Draft a match, or find new jobs.</p>
          <div className="row">
            <a className={buttonClass('secondary')} href="#/get-jobs">Get jobs</a>
            <a className={buttonClass('primary')} href="#/matches">Open Matches</a>
          </div>
        </section>
      ) : (
        <InboxQueue tabs={tabs} drafting={drafting} {...(currentId ? { currentId } : {})} sort={sort} onSort={setSort} />
      )}
      {detail ? (
        <SidePanel title={heading} titleHidden fallbackFocus="a.inbox-row" onClose={() => open()} position={position}>
          <div className="inbox-panel">
            {detail}
            <label className="inbox-next"><input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} />Open the next job after I decide</label>
            <span className="cell-sub inbox-panel-keys">A approve · S skip · Esc close</span>
          </div>
        </SidePanel>
      ) : null}
      {/* On the body: the panel makes the page inert, and Undo must stay reachable while the next job is open. */}
      {skips.held ? createPortal(
        <div className="undo-bar" role="status" aria-label="Undo">
          <span>{skips.held.message}</span>
          <Button size="sm" variant="link" onClick={undo}>Undo</Button>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
