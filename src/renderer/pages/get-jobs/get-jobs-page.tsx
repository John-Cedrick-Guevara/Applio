import { PageHeader } from '../../components/page-header';
import { navigate, type RouteParams } from '../../lib/router';
import AddJobPage from '../add-job/add-job-page';
import FindJobsPage from '../find-jobs/find-jobs-page';
import './get-jobs.css';

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
      <PageHeader title={<>Get <strong>jobs</strong></>} description="Applio never looks for jobs on its own. Scan your sources, or paste one you found." />
      <div className="tabs" role="tablist" aria-label="How to get jobs">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="tab" aria-selected={t.id === active} onClick={() => navigate(t.path)}>
            {t.label}
          </button>
        ))}
      </div>
      {/* Both stay mounted, so a running scan or a half-pasted post survives a look at the other tab. */}
      <div role="tabpanel" aria-label="Scan sources" hidden={active !== 'scan'}>
        <FindJobsPage />
      </div>
      <div role="tabpanel" aria-label="Paste a job" hidden={active !== 'paste'}>
        <AddJobPage />
      </div>
    </div>
  );
}
