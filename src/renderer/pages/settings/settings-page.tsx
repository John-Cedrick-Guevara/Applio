import type { Settings, Source } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { PageHeader } from '../../components/page-header';
import { useAsync } from '../../hooks/use-async';
import { ChannelsSection } from './channels-section';
import { ConnectionsSection } from './connections-section';
import { GuardrailsSection } from './guardrails-section';
import { OutputFolderSection } from './output-folder-section';
import { SourcesSection } from './sources-section';
import './settings.css';

/** Settings (prototype screen 6). Every control saves on change; secrets go to the keychain. */
export default function SettingsPage() {
  const api = useApi();
  const state = useAsync(async () => {
    const [settings, sources] = await Promise.all([api.getSettings(), api.listSources()]);
    return { settings, sources };
  }, [api]);

  const setSettings = (settings: Settings) => state.setData((d) => ({ ...d, settings }));
  const setSource = (source: Source) => state.setData((d) => ({ ...d, sources: d.sources.map((s) => (s.id === source.id ? source : s)) }));

  return (
    <div className="settings">
      <PageHeader title="Settings" description="Changes save automatically." />
      <AsyncView state={state} what="settings" rows={6}>
        {({ settings, sources }) => (
          <>
            <SourcesSection sources={sources} onChange={setSource} />
            <ChannelsSection settings={settings} onChange={setSettings} />
            <GuardrailsSection settings={settings} onChange={setSettings} />
            <OutputFolderSection settings={settings} onChange={setSettings} />
            <ConnectionsSection settings={settings} onChange={setSettings} />
          </>
        )}
      </AsyncView>
    </div>
  );
}
