import { useMemo } from 'react';
import type { AppStatus, Autonomy, Job } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { useAsync } from '../../hooks/use-async';
import type { RouteParams } from '../../lib/router';
import { DraftPanel } from './draft-panel';
import { ReviewHeader } from './review-header';
import { ReviewQueue } from './review-queue';
import './review.css';

/** Everything Review needs, loaded together so the split view renders in one pass. */
async function loadReview(api: ReturnType<typeof useApi>) {
  const [drafted, scored, found, settings, sources, status] = await Promise.all([
    api.listJobs({ statuses: ['drafted'] }),
    api.listJobs({ statuses: ['scored'] }),
    api.listJobs({ statuses: ['found'] }),
    api.getSettings(),
    api.listSources(),
    api.getStatus(),
  ]);
  return {
    queue: [...drafted].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    // Unscored jobs and strong matches whose draft failed: the next run retries both.
    waiting: [...scored.filter((j) => (j.score ?? 0) >= settings.draftThreshold), ...found],
    below: scored.filter((j) => (j.score ?? 0) < settings.draftThreshold).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    thresholds: { draft: settings.draftThreshold, auto: settings.autoSendThreshold },
    owner: { name: settings.fullName, email: settings.gmailAddress },
    autonomyBySource: Object.fromEntries(sources.map((s) => [s.id, s.autonomy])) as Record<string, Autonomy>,
    status,
  };
}

/**
 * Review (prototype screen 1): drafts waiting on the operator, best match
 * first, with the selected draft beside the queue. The selection lives in the
 * URL (`#/review/:id`) so back/forward and deep links work.
 */
export default function ReviewPage({ params }: { params: RouteParams }) {
  const api = useApi();
  const state = useAsync(() => loadReview(api), [api]);

  /** Swaps an updated job into the queue (approved, skipped, edited). */
  const updateJob = (job: Job) => state.setData((d) => ({ ...d, queue: d.queue.map((j) => (j.id === job.id ? job : j)) }));
  const updateStatus = (status: AppStatus) => state.setData((d) => ({ ...d, status }));

  return (
    <AsyncView state={state} what="the review queue" rows={6}>
      {(data) => (
        <ReviewLayout
          data={data}
          selectedId={params.id}
          onJobChange={updateJob}
          onStatusChange={updateStatus}
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
  onStatusChange: (status: AppStatus) => void;
  onRunComplete: () => void;
}

function ReviewLayout({ data, selectedId, onJobChange, onStatusChange, onRunComplete }: LayoutProps) {
  const currentId = selectedId ?? data.queue[0]?.id;
  const nextId = useMemo(() => {
    const i = data.queue.findIndex((j) => j.id === currentId);
    return data.queue.slice(i + 1).find((j) => j.status === 'drafted')?.id;
  }, [data.queue, currentId]);

  return (
    <>
      <ReviewHeader status={data.status} onStatusChange={onStatusChange} onRunComplete={onRunComplete} />
      <div className="split">
        <ReviewQueue jobs={data.queue} currentId={currentId} below={data.below} waiting={data.waiting} draftThreshold={data.thresholds.draft} />
        {currentId ? (
          <DraftPanel
            key={currentId}
            jobId={currentId}
            nextId={nextId}
            thresholds={data.thresholds}
            owner={data.owner}
            autonomyBySource={data.autonomyBySource}
            onJobChange={onJobChange}
          />
        ) : (
          <section className="card review-empty" aria-label="Draft detail">
            <h2>Nothing waiting on you</h2>
            <p className="muted">New drafts land here after each run. Add a job yourself any time.</p>
            <a href="#/add-job">Add a job</a>
          </section>
        )}
      </div>
    </>
  );
}
