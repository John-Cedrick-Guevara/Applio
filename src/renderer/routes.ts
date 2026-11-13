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

export const ROUTES: RouteDef[] = [
  { pattern: '/inbox', view: InboxView },
  { pattern: '/inbox/:id', view: InboxView },
  { pattern: '/matches', view: lazy(() => import('./pages/matches/matches-page')) },
  { pattern: '/handoff/:id', view: lazy(() => import('./pages/handoff/handoff-page')) },
  { pattern: '/applications', view: lazy(() => import('./pages/applications/applications-page')) },
  { pattern: '/profile', view: lazy(() => import('./pages/profile/profile-page')) },
  { pattern: '/usage', view: lazy(() => import('./pages/usage/usage-page')) },
  { pattern: '/settings', view: lazy(() => import('./pages/settings/settings-page')) },
  { pattern: '/add-job', view: lazy(() => import('./pages/add-job/add-job-page')) },
  { pattern: '/find-jobs', view: lazy(() => import('./pages/find-jobs/find-jobs-page')) },
];

export const DEFAULT_PATH = '/inbox';

/** Old paths that moved: links from before the Inbox (bookmarks, notifications) keep working. */
export const REDIRECTS: [from: string, to: string][] = [['/review', '/inbox']];
