import type { Settings } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Card } from '../../components/card';
import { Toggle } from '../../components/form';
import { useAction } from '../../hooks/use-action';

const CHANNELS = [
  { name: 'Email', auto: true, desc: 'Sends the cover letter and resume PDF from your Gmail.' },
  { name: 'Standard ATS forms', auto: true, desc: 'Greenhouse, Lever, Ashby, Workable. Filled and submitted in Applio’s own window. A CAPTCHA pauses it and hands the job to you.' },
  { id: 'platform', name: 'Platform apply', auto: false, desc: 'LinkedIn Easy Apply, Indeed, JobStreet, Upwork. Off: manual handoff, where Applio prepares everything and you apply yourself. On: Applio fills the form in your signed-in session and you click Submit.' },
  { id: 'custom', name: 'Company career sites', auto: false, desc: 'Workday, iCIMS and custom forms. Best-effort fill when on; manual handoff when off.' },
] as const;

/** Apply channels (SPEC F5): each channel's autonomy ceiling, plus assisted fill for the manual ones. */
export function ChannelsSection({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const api = useApi();
  const action = useAction();

  const setAssist = async (id: 'platform' | 'custom', on: boolean) => {
    const next = await action.run('update assisted fill', () => api.saveSettings({ assistedFill: { ...settings.assistedFill, [id]: on } }));
    if (next) onChange(next);
  };

  return (
    <Card flush title="Apply channels" description="Applio detects the channel from each job's apply link.">
      {CHANNELS.map((c) => (
        <div key={c.name} className="settings-row settings-row-top">
          <div className="settings-row-text wide">
            <div className="row">
              <span className="settings-row-name">{c.name}</span>
              <span className={c.auto ? 'badge badge-success' : 'badge badge-warning'}>{c.auto ? 'Up to Autonomous' : 'Up to Draft → Approve'}</span>
            </div>
            <div className="cell-sub settings-desc">{c.desc}</div>
          </div>
          {'id' in c ? (
            <div className="row">
              <span className="cell-secondary">{settings.assistedFill[c.id] ? 'Assisted fill' : 'Manual handoff'}</span>
              <Toggle hideLabel label={`Assisted fill for ${c.name}`} checked={settings.assistedFill[c.id]} onChange={(on) => setAssist(c.id, on)} />
            </div>
          ) : null}
        </div>
      ))}
    </Card>
  );
}
