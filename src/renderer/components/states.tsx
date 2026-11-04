import { Button } from './button';

/** Skeleton placeholder; announced once to screen readers as "Loading". */
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="skeleton-stack">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}

/** Failure state with a retry. The detailed error is already in the console. */
export function ErrorState({ what = 'this page', onRetry }: { what?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="state state-error">
      <p>Couldn't load {what}. Check that Applio is running, then retry.</p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}
