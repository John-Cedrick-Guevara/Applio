import type { Settings } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { Card } from '../../components/card';
import { useAction } from '../../hooks/use-action';

/** Output folder (SPEC F8): where each application's files are written. Picked with the native dialog. */
export function OutputFolderSection({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const api = useApi();
  const action = useAction();
  const dir = settings.outputFolder ?? '';

  const change = async () => {
    const folder = await action.run('choose a folder', () => api.chooseFolder());
    if (!folder) return; // cancelled
    const next = await action.run('save the folder', () => api.saveSettings({ outputFolder: folder }), `New applications will be saved to ${folder}`);
    if (next) onChange(next);
  };

  return (
    <Card title="Output folder" description="Every application gets its own folder with what was sent.">
      <div className="row">
        <label htmlFor="out-dir" className="visually-hidden">Output folder path</label>
        <input id="out-dir" className="input mono out-dir" value={dir || 'Not chosen'} readOnly />
        <Button busy={action.pending} onClick={change}>Change…</Button>
        <Button disabled={!dir} onClick={() => action.run('open the folder', () => api.openOutputFolder())}>Open</Button>
      </div>
      <pre className="folder-tree mono">{`${dir || '<folder>'}/
  2026-11/
    Northwind Labs — Senior Backend Engineer (88%)/
      resume.pdf
      cover-letter.pdf
      job.md        original post + AI summary
      sent.md       what was sent, channel, time, tokens`}</pre>
    </Card>
  );
}
