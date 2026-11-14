import type { AppStatus } from '../../../shared/types';
import { runLine } from '../../lib/run-summary';

/** Title and last-scan summary. Starting a scan lives in the sidebar's Get jobs button; pausing auto-send in the activity bar. */
export function ReviewHeader({ status }: { status: AppStatus }) {
  return (
    <header className="page-header">
      <div>
        <h1>My <strong>inbox</strong></h1>
        <p role="status">{runLine(status.lastRun)}</p>
      </div>
    </header>
  );
}
