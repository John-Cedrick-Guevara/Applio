import { useApi } from '../api/api-context';
import { Icon, Logo, type IconName } from '../components/icons';
import { useAsync } from '../hooks/use-async';
import { usePath } from '../lib/router';
import { newCount } from '../lib/job-lists';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

/** Pages in the primary nav. Each page PR adds its entry here. */
const NAV: NavItem[] = [
  { to: '/review', label: 'Review', icon: 'review' },
  { to: '/matches', label: 'Matches', icon: 'matches' },
  { to: '/find-jobs', label: 'Find jobs', icon: 'search' },
  { to: '/applications', label: 'Applications', icon: 'applications' },
  { to: '/profile', label: 'Profile', icon: 'profile' },
  { to: '/usage', label: 'Usage & limits', icon: 'usage' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

/** True for the item's own path and anything beneath it (`/jobs/j1` keeps Review active). */
const isActive = (path: string, to: string) => path === to || path.startsWith(`${to}/`);

/**
 * Primary navigation. The Review badge counts drafts waiting on the operator
 * and refreshes on every navigation so it reflects actions taken elsewhere.
 */
export function Sidebar() {
  const api = useApi();
  const path = usePath();
  const { data: pending } = useAsync(() => api.listJobs({ statuses: ['drafted', 'approved'] }), [api, path]);
  // Matches first seen since the last scan, so a scan's results are easy to find.
  const { data: fresh } = useAsync(async () => {
    const [matches, status] = await Promise.all([api.listJobs({ statuses: ['scored', 'found'] }), api.getStatus()]);
    return newCount(matches, status.lastRun?.at);
  }, [api, path]);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo />
        <span>Applio</span>
      </div>
      <a className="sidebar-add" href="#/add-job" aria-current={isActive(path, '/add-job') ? 'page' : undefined}>
        <Icon name="plus" />
        Add job
      </a>
      <nav aria-label="Primary">
        {NAV.map((item) => (
          <a key={item.to} href={`#${item.to}`} className="nav-link" aria-current={isActive(path, item.to) ? 'page' : undefined}>
            <Icon name={item.icon} />
            {item.label}
            {item.icon === 'matches' && fresh ? <span className="nav-new">{fresh} new</span> : null}
            {item.icon === 'review' && pending?.length ? (
              <span className="nav-count" aria-label={`${pending.length} waiting on you`}>
                {pending.length}
              </span>
            ) : null}
          </a>
        ))}
      </nav>
    </aside>
  );
}
