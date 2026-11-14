import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { RouteParams } from './lib/router';

export interface RouteDef {
  pattern: string;
  view: LazyExoticComponent<ComponentType<{ params: RouteParams }>>;
}

/**
 * Route table. Views are lazy-loaded so startup only parses the shell and the
 * first page; each page module default-exports its view. Page PRs add entries.
 */
// One view shared by both inbox routes, so selecting a job only changes params.
const InboxView = lazy(() => import('./pages/review/review-page'));
const MatchesView = lazy(() => import('./pages/matches/matches-page'));
const GetJobsView = lazy(() => import('./pages/get-jobs/get-jobs-page'));
const SettingsView = lazy(() => import('./pages/settings/settings-page'));

export const ROUTES: RouteDef[] = [
  { pattern: '/dashboard', view: lazy(() => import('./pages/dashboard/dashboard-page')) },
  { pattern: '/inbox', view: InboxView },
  { pattern: '/inbox/:id', view: InboxView },
  { pattern: '/matches', view: MatchesView },
  { pattern: '/matches/:view', view: MatchesView },
  { pattern: '/get-jobs', view: GetJobsView },
  { pattern: '/get-jobs/:tab', view: GetJobsView },
  { pattern: '/handoff/:id', view: lazy(() => import('./pages/handoff/handoff-page')) },
  { pattern: '/applications', view: lazy(() => import('./pages/applications/applications-page')) },
  { pattern: '/profile', view: lazy(() => import('./pages/profile/profile-page')) },
  { pattern: '/usage', view: lazy(() => import('./pages/usage/usage-page')) },
  { pattern: '/settings', view: SettingsView },
  { pattern: '/settings/:tab', view: SettingsView },
];

export const DEFAULT_PATH = '/dashboard';

/** Old paths that moved: links from before the Inbox (bookmarks, notifications) keep working. */
export const REDIRECTS: [from: string, to: string][] = [['/review', '/inbox'], ['/find-jobs', '/get-jobs'], ['/add-job', '/get-jobs/paste']];
