import type { Settings } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Card } from '../../components/card';
import { Toggle } from '../../components/form';
import { useAction } from '../../hooks/use-action';

/** Whether Applio starts with the computer. Scans have no schedule: they run when the operator starts one (SPEC F2). */
export function StartupSection({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const api = useApi();
  const action = useAction();
  const save = async (patch: Partial<Settings>) => {
    const next = await action.run('change launch at login', () => api.saveSettings(patch), 'Saved');
    if (next) onChange(next);
  };

  return (
    <Card flush title="Startup" description="Applio scans for jobs only when you start a scan.">
      <div className="settings-row">
        <Toggle
          label="Open Applio at login"
          description="Starts in the tray, so replies and follow-ups are tracked without opening the window."
          checked={settings.launchAtLogin}
          onChange={(on) => save({ launchAtLogin: on })}
        />
      </div>
    </Card>
  );
}
