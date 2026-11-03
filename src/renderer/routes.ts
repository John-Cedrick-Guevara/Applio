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
// One view shared by both review routes, so selecting a draft only changes params.
const ReviewView = lazy(() => import('./pages/review/review-page'));

export const ROUTES: RouteDef[] = [
  { pattern: '/review', view: ReviewView },
  { pattern: '/review/:id', view: ReviewView },
  { pattern: '/handoff/:id', view: lazy(() => import('./pages/handoff/handoff-page')) },
  { pattern: '/applications', view: lazy(() => import('./pages/applications/applications-page')) },
];

export const DEFAULT_PATH = '/review';
