import type { AppStatus } from '../../../shared/types';
import { buttonClass } from '../../components/button';
import { Icon } from '../../components/icons';
import { runLine } from '../../lib/run-summary';

/** Title, last-scan summary and the way to start a scan (SPEC F2). Pausing auto-send lives in the activity bar. */
export function ReviewHeader({ status }: { status: AppStatus }) {
  return (
    <header className="page-header">
      <div>
        <h1>Inbox</h1>
        <p role="status">{runLine(status.lastRun)}</p>
      </div>
      <div className="page-actions">
        <a className={buttonClass('strong')} href="#/get-jobs"><Icon name="search" />Get jobs</a>
      </div>
    </header>
  );
}
