import { useApi } from '../api/api-context';
import { Icon, Logo, type IconName } from '../components/icons';
import { useAsync } from '../hooks/use-async';
import { useJobsVersion } from '../hooks/use-jobs-version';
import { usePath } from '../lib/router';
import { newCount } from '../lib/job-lists';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

/** Pages in the primary nav. Each page PR adds its entry here. */
const NAV: NavItem[] = [
  { to: '/inbox', label: 'Inbox', icon: 'review' },
  { to: '/matches', label: 'Matches', icon: 'matches' },
  { to: '/applications', label: 'Applications', icon: 'applications' },
  { to: '/profile', label: 'Profile', icon: 'profile' },
  { to: '/usage', label: 'Usage & limits', icon: 'usage' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

/** True for the item's own path and anything beneath it (`/inbox/j1` keeps Inbox active). */
const isActive = (path: string, to: string) => path === to || path.startsWith(`${to}/`);

/**
 * Primary navigation. The Inbox badge counts exactly the Inbox's decisions and
 * refreshes on every navigation so it reflects actions taken elsewhere.
 */
export function Sidebar() {
  const api = useApi();
  const path = usePath();
  // Reloads on navigation and whenever main reports a job changed (a saved skip, a send), so the badge never lags the list.
  const jobsChanges = useJobsVersion();
  // Every decision in the Inbox: drafts and unsent approvals, plus Claude's open questions.
  const { data: pending } = useAsync(async () => {
    const [jobs, questions] = await Promise.all([api.listJobs({ statuses: ['drafted', 'approved'] }), api.listQuestions()]);
    return jobs.length + questions.length;
  }, [api, path, jobsChanges]);
  // Matches first seen since the last scan, so a scan's results are easy to find.
  const { data: fresh } = useAsync(async () => {
    const [matches, status] = await Promise.all([api.listJobs({ statuses: ['scored', 'found'] }), api.getStatus()]);
    return newCount(matches, status.lastRun?.at);
  }, [api, path, jobsChanges]);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo />
        <span>Applio</span>
      </div>
      <a className="sidebar-add" href="#/get-jobs" aria-current={isActive(path, '/get-jobs') ? 'page' : undefined}>
        <Icon name="plus" />
        Get jobs
      </a>
      <nav aria-label="Primary">
        {NAV.map((item) => (
          <a key={item.to} href={`#${item.to}`} className="nav-link" aria-current={isActive(path, item.to) ? 'page' : undefined}>
            <Icon name={item.icon} />
            {item.label}
            {item.icon === 'matches' && fresh ? <span className="nav-new">{fresh} new</span> : null}
            {item.icon === 'review' && pending ? (
              <span className="nav-count" aria-label={`${pending} need a decision`}>
                {pending}
              </span>
            ) : null}
          </a>
        ))}
      </nav>
    </aside>
  );
}
