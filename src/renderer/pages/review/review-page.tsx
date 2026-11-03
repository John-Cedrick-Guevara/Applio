import type { AppStatus } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { useAsync } from '../../hooks/use-async';
import type { RouteParams } from '../../lib/router';
import { ReviewHeader } from './review-header';
import { ReviewQueue } from './review-queue';
import './review.css';

/** Everything the queue needs, loaded together so it renders in one pass. */
async function loadReview(api: ReturnType<typeof useApi>) {
  const [drafted, scored, settings, status] = await Promise.all([
    api.listJobs({ statuses: ['drafted'] }),
    api.listJobs({ statuses: ['scored'] }),
    api.getSettings(),
    api.getStatus(),
  ]);
  return {
    queue: [...drafted].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    belowThreshold: scored.filter((j) => (j.score ?? 0) < settings.draftThreshold).length,
    draftThreshold: settings.draftThreshold,
    status,
  };
}

/**
 * Review (prototype screen 1): drafts waiting on the operator, best match
 * first. The selection lives in the URL (`#/review/:id`) so back/forward and
 * deep links work.
 */
export default function ReviewPage({ params }: { params: RouteParams }) {
  const api = useApi();
  const state = useAsync(() => loadReview(api), [api]);

  const updateStatus = (status: AppStatus) => state.setData((d) => ({ ...d, status }));

  return (
    <AsyncView state={state} what="the review queue" rows={6}>
      {(data) => <ReviewLayout data={data} selectedId={params.id} onStatusChange={updateStatus} onRunComplete={state.reload} />}
    </AsyncView>
  );
}

interface LayoutProps {
  data: Awaited<ReturnType<typeof loadReview>>;
  selectedId?: string;
  onStatusChange: (status: AppStatus) => void;
  onRunComplete: () => void;
}

function ReviewLayout({ data, selectedId, onStatusChange, onRunComplete }: LayoutProps) {
  const currentId = selectedId ?? data.queue[0]?.id;
  return (
    <>
      <ReviewHeader status={data.status} onStatusChange={onStatusChange} onRunComplete={onRunComplete} />
      <div className="split">
        {data.queue.length > 0 ? (
          <ReviewQueue jobs={data.queue} currentId={currentId} belowThreshold={data.belowThreshold} draftThreshold={data.draftThreshold} />
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
