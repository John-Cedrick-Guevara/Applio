import { useState } from 'react';
import { useApi } from '../api/api-context';
import { Icon, Logo, type IconName } from '../components/icons';
import { useAsync } from '../hooks/use-async';
import { useJobsVersion } from '../hooks/use-jobs-version';
import { usePath } from '../lib/router';
import { newCount } from '../lib/job-lists';
import { DEFAULT_PATH } from '../routes';
import { ActivityBlock } from './activity-block';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

/** Pages in the primary nav, then the pair pinned to the bottom. Each page PR adds its entry here. */
const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/inbox', label: 'Inbox', icon: 'review' },
  { to: '/matches', label: 'Matches', icon: 'matches' },
  { to: '/get-jobs', label: 'Get jobs', icon: 'search' },
  { to: '/applications', label: 'Applications', icon: 'applications' },
  { to: '/profile', label: 'Profile', icon: 'profile' },
];
const NAV_BOTTOM: NavItem[] = [
  { to: '/usage', label: 'Usage & limits', icon: 'usage' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

const STORAGE_KEY = 'applio.rail';

/** True for the item's own path and anything beneath it (`/inbox/j1` keeps Inbox active). */
const isActive = (path: string, to: string) => path === to || path.startsWith(`${to}/`);

/** The remembered rail state; open when nothing is stored or storage is blocked. */
function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'closed';
  } catch {
    return true;
  }
}

/**
 * Primary navigation: a dark rail, 232px open or 72px collapsed (remembered). The Inbox
 * badge counts exactly the Inbox's decisions and refreshes on every navigation so it
 * reflects actions taken elsewhere.
 */
export function Sidebar() {
  const api = useApi();
  const path = usePath();
  const [open, setOpen] = useState(readOpen);
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

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'open' : 'closed');
    } catch {
      /* Blocked storage only costs the memory of the choice. */
    }
  };

  const link = (item: NavItem) => {
    const inbox = item.to === '/inbox';
    const matches = item.to === '/matches';
    // Collapsed, the visible label is hidden, so the name must carry the counts too; open, the content already does.
    const count = inbox && pending ? `${pending} need a decision` : matches && fresh ? `${fresh} new` : '';
    const name = open || !count ? undefined : `${item.label}, ${count}`;
    return (
      <a
        key={item.to}
        href={`#${item.to}`}
        className="nav-link"
        title={item.label}
        aria-label={name ?? (open ? undefined : item.label)}
        aria-current={isActive(path, item.to) ? 'page' : undefined}
      >
        <Icon name={item.icon} size={20} />
        <span className="nav-label">{item.label}</span>
        {matches && fresh ? <span className="nav-new">{fresh}<span className="nav-new-word"> new</span></span> : null}
        {inbox && pending ? (
          <span className="nav-count" aria-label={`${pending} need a decision`}>
            {pending}
          </span>
        ) : null}
      </a>
    );
  };

  return (
    <aside className="sidebar" data-collapsed={open ? 'false' : 'true'}>
      <div className="sidebar-head">
        <a className="sidebar-brand" href={`#${DEFAULT_PATH}`} aria-label="Applio, home" title="Applio">
          <Logo />
          <span className="sidebar-word">applio</span>
        </a>
        <button type="button" className="rail-toggle" aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'} title={open ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={open} onClick={toggle}>
          <Icon name={open ? 'chevronLeft' : 'chevronRight'} size={18} />
        </button>
      </div>
      <nav aria-label="Primary">
        {NAV.map(link)}
        <span className="nav-spacer" />
        {NAV_BOTTOM.map(link)}
      </nav>
      <ActivityBlock />
    </aside>
  );
}
