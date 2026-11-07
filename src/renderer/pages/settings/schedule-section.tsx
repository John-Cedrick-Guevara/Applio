import type { Settings } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Card } from '../../components/card';
import { Toggle } from '../../components/form';
import { useAction } from '../../hooks/use-action';

const HOURS = [4, 5, 6] as const;

/** Discovery schedule (SPEC F2) and whether Applio starts with the computer. */
export function ScheduleSection({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const api = useApi();
  const action = useAction();
  const save = async (what: string, patch: Partial<Settings>) => {
    const next = await action.run(what, () => api.saveSettings(patch), 'Saved');
    if (next) onChange(next);
  };

  return (
    <Card flush title="Schedule" description="Applio runs discovery while it's open or in the tray, and catches up after sleep.">
      <div className="settings-row">
        <div className="settings-row-text">
          <label htmlFor="run-every" className="settings-row-name">Run discovery every</label>
        </div>
        <select
          id="run-every"
          className="select schedule-select"
          value={settings.discoveryIntervalHours}
          onChange={(e) => save('change the schedule', { discoveryIntervalHours: Number(e.target.value) })}
        >
          {HOURS.map((h) => <option key={h} value={h}>{h} hours</option>)}
        </select>
      </div>
      <div className="settings-row">
        <Toggle
          label="Open Applio at login"
          description="Starts in the tray, so discovery runs without opening the window."
          checked={settings.launchAtLogin}
          onChange={(on) => save('change launch at login', { launchAtLogin: on })}
        />
      </div>
    </Card>
  );
}
