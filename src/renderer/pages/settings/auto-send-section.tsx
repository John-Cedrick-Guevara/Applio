import { useApi } from '../../api/api-context';
import { Card } from '../../components/card';
import { Toggle } from '../../components/form';
import { useAction } from '../../hooks/use-action';

/**
 * Pause auto-send (SPEC F6). Scans and drafts still run when the operator starts them; only
 * sends that would go out on their own wait, so every draft needs a click while it is on.
 */
export function AutoSendSection({ paused, autoSendThreshold, autonomousSources, onChange }: { paused: boolean | undefined; autoSendThreshold: number; autonomousSources: number; onChange: (paused: boolean) => void }) {
  const api = useApi();
  const action = useAction();
  const toggle = async (on: boolean) => {
    const next = await action.run(on ? 'pause auto-send' : 'resume auto-send', () => api.setAutomationPaused(on));
    if (next) onChange(next.paused);
  };
  const rule = autonomousSources > 0
    ? `Drafts from Autonomous sources at ${autoSendThreshold}+ go out on their own, by email or ATS form. Everything else waits for your approval.`
    : 'No source is set to Autonomous, so every draft already waits for your approval.';

  return (
    <Card flush title="Auto-send" description={rule}>
      <div className="settings-row">
        <Toggle
          label="Pause auto-send"
          description={paused === undefined ? "Couldn't read whether auto-send is paused. Reopen Settings to try again." : paused ? 'Nothing goes out on its own while this is on. Scans and drafts still work when you start them.' : 'Turn on to hold every send for your click, without changing any source. Scans and drafts keep working.'}
          checked={paused ?? false}
          disabled={action.pending || paused === undefined}
          onChange={toggle}
        />
      </div>
    </Card>
  );
}
