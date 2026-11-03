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
export const ROUTES: RouteDef[] = [
  { pattern: '/review', view: lazy(() => import('./pages/review/review-page')) },
  { pattern: '/review/:id', view: lazy(() => import('./pages/review/review-page')) },
];

export const DEFAULT_PATH = '/review';
