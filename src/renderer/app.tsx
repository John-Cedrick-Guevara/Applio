import { Suspense, useEffect } from 'react';
import { Sidebar } from './layout/sidebar';
import { matchRoute, navigate, usePath } from './lib/router';
import { DEFAULT_PATH, REDIRECTS, ROUTES } from './routes';

/** Finds the first route matching the current path. */
function resolve(path: string) {
  for (const route of ROUTES) {
    const params = matchRoute(route.pattern, path);
    if (params) return { route, params };
  }
  return null;
}

/**
 * Remount key for a route: its path without params, so `/inbox` → `/inbox/j2`
 * keeps the page (and its loaded data) while `/inbox` → `/applications` resets it.
 */
const pageKey = (pattern: string) => pattern.replace(/\/:.*$/, '');

/** App frame: sidebar, the activity bar, then the routed page. Unknown paths redirect to the pipeline. */
export function App() {
  const path = usePath();
  const match = resolve(path);

  useEffect(() => {
    if (match) return;
    const moved = REDIRECTS.find(([from]) => path === from || path.startsWith(`${from}/`));
    navigate(moved ? moved[1] + path.slice(moved[0].length) : DEFAULT_PATH);
  }, [match, path]);

  return (
    <div className="app">
      <Sidebar />
      <main className="app-main">
        <div className="app-content">
          {match ? (
            <Suspense fallback={<p className="muted">Loading…</p>}>
              <match.route.view key={pageKey(match.route.pattern)} params={match.params} />
            </Suspense>
          ) : null}
        </div>
      </main>
    </div>
  );
}
