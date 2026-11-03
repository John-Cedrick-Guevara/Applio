import { Suspense, useEffect } from 'react';
import { Sidebar } from './layout/sidebar';
import { matchRoute, navigate, usePath } from './lib/router';
import { DEFAULT_PATH, ROUTES } from './routes';

/** Finds the first route matching the current path. */
function resolve(path: string) {
  for (const route of ROUTES) {
    const params = matchRoute(route.pattern, path);
    if (params) return { route, params };
  }
  return null;
}

/** App frame: sidebar + the routed page. Unknown paths redirect to the pipeline. */
export function App() {
  const path = usePath();
  const match = resolve(path);

  useEffect(() => {
    if (!match) navigate(DEFAULT_PATH);
  }, [match]);

  return (
    <div className="app">
      <Sidebar />
      <main className="app-main">
        <div className="app-content">
          {match ? (
            <Suspense fallback={<p className="muted">Loading…</p>}>
              <match.route.view key={path} params={match.params} />
            </Suspense>
          ) : null}
        </div>
      </main>
    </div>
  );
}
