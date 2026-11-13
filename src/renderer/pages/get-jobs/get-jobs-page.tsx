import { PageHeader } from '../../components/page-header';
import { navigate, type RouteParams } from '../../lib/router';
import AddJobPage from '../add-job/add-job-page';
import FindJobsPage from '../find-jobs/find-jobs-page';

const TABS = [
  { id: 'scan', label: 'Scan sources', path: '/get-jobs' },
  { id: 'paste', label: 'Paste a job', path: '/get-jobs/paste' },
] as const;

/**
 * Get jobs (redesign v2): the one place jobs come in, by scanning sources or
 * pasting a post. The tab lives in the URL so links can open either one.
 */
export default function GetJobsPage({ params }: { params: RouteParams }) {
  const active = params.tab === 'paste' ? 'paste' : 'scan';
  return (
    <div className="get-jobs">
      <PageHeader title="Get jobs" description="Applio never looks for jobs on its own. Scan your sources, or paste one you found." />
      <div className="tabs" role="tablist" aria-label="How to get jobs">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="tab" aria-selected={t.id === active} onClick={() => navigate(t.path)}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={active === 'paste' ? 'Paste a job' : 'Scan sources'}>
        {active === 'paste' ? <AddJobPage /> : <FindJobsPage />}
      </div>
    </div>
  );
}
