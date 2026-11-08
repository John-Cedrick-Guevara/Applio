import type { AppStatus } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button, buttonClass } from '../../components/button';
import { Icon } from '../../components/icons';
import { useAction } from '../../hooks/use-action';
import { runLine } from '../../lib/run-summary';

interface ReviewHeaderProps {
  status: AppStatus;
  onStatusChange: (status: AppStatus) => void;
}

/** Title, last-scan summary, pause/resume auto-send, and the way to start a scan (SPEC F2, F6). */
export function ReviewHeader({ status, onStatusChange }: ReviewHeaderProps) {
  const api = useApi();
  const pause = useAction();

  const togglePause = async () => {
    const next = await pause.run(status.paused ? 'resume auto-send' : 'pause auto-send', () => api.setAutomationPaused(!status.paused));
    if (next) onStatusChange(next);
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Review</h1>
          <p role="status">{runLine(status.lastRun)}</p>
        </div>
        <div className="page-actions">
          <Button busy={pause.pending} onClick={togglePause}>
            {status.paused ? 'Resume auto-send' : 'Pause auto-send'}
          </Button>
          <a className={buttonClass('strong')} href="#/find-jobs"><Icon name="search" />Find jobs</a>
        </div>
      </header>
      {status.paused ? (
        <div className="banner banner-warning">
          <span>Auto-send is paused. Nothing goes out on its own; scans and drafts still work.</span>
          <Button size="sm" className="banner-action" busy={pause.pending} onClick={togglePause}>Resume</Button>
        </div>
      ) : null}
    </>
  );
}
