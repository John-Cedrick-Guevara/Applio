import type { AppStatus } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { useToast } from '../../components/toast';
import { useAction } from '../../hooks/use-action';
import { runLine, runResult } from './review-model';

interface ReviewHeaderProps {
  status: AppStatus;
  onStatusChange: (status: AppStatus) => void;
  onRunComplete: () => void;
}

/** Title, last-run summary, pause/resume and Run now (SPEC F2, F6). */
export function ReviewHeader({ status, onStatusChange, onRunComplete }: ReviewHeaderProps) {
  const api = useApi();
  const pause = useAction();
  const runner = useAction();
  const toast = useToast();

  const togglePause = async () => {
    const next = await pause.run(status.paused ? 'resume automation' : 'pause automation', () => api.setAutomationPaused(!status.paused));
    if (next) onStatusChange(next);
  };

  const runNow = async () => {
    const run = await runner.run('run discovery', () => api.runDiscovery());
    if (!run) return;
    // The stored summary knows which sources were at their limit; the returned one doesn't.
    const latest = (await api.getStatus().catch(() => undefined))?.lastRun ?? run;
    toast.show(runResult(latest), latest.found === 0 && latest.atLimit ? 'info' : 'success');
    onRunComplete();
  };

  const line = runner.pending ? 'Running now · fetching sources, then dedup and filters…' : runLine(status.lastRun);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Review</h1>
          <p role="status">{line}</p>
        </div>
        <div className="page-actions">
          <Button busy={pause.pending} onClick={togglePause}>
            {status.paused ? 'Resume automation' : 'Pause automation'}
          </Button>
          <Button variant="strong" busy={runner.pending} disabled={status.paused} onClick={runNow}>
            {runner.pending ? 'Running…' : 'Run now'}
          </Button>
        </div>
      </header>
      {status.paused ? (
        <div className="banner banner-warning">
          <span>Automation is paused. Scheduled runs and auto-sends are off; drafts below still work.</span>
          <Button size="sm" className="banner-action" busy={pause.pending} onClick={togglePause}>Resume</Button>
        </div>
      ) : null}
    </>
  );
}
