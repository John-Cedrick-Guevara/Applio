import { useEffect, useState } from 'react';
import type { Settings, Source } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { PageHeader } from '../../components/page-header';
import { TabList, TabPanel } from '../../components/tabs';
import { useAsync } from '../../hooks/use-async';
import { navigate, type RouteParams } from '../../lib/router';
import { AutoSendSection } from './auto-send-section';
import { ChannelsSection } from './channels-section';
import { ConnectionsSection } from './connections-section';
import { GuardrailsSection } from './guardrails-section';
import { OutputFolderSection } from './output-folder-section';
import { StartupSection } from './startup-section';
import { SourcesSection } from './sources-section';
import './settings.css';

type Tab = 'sources' | 'channels' | 'guard' | 'conn' | 'files';

const TAB_LIST: { id: Tab; label: string }[] = [
  { id: 'sources', label: 'Sources' },
  { id: 'channels', label: 'Channels' },
  { id: 'guard', label: 'Guardrails' },
  { id: 'conn', label: 'Connections' },
  { id: 'files', label: 'Files' },
];

/** Settings (v5): one tab per kind of setting. Every control saves on change; secrets go to the keychain. */
export default function SettingsPage({ params }: { params: RouteParams }) {
  const api = useApi();
  // `/settings/:tab` opens a tab, so a link like "Raise budget" lands where the setting is.
  const linked = TAB_LIST.find((t) => t.id === params.tab)?.id ?? 'sources';
  const [tab, setTab] = useState<Tab>(linked);
  useEffect(() => setTab(linked), [linked]);
  // An unknown tab in the link is corrected, so the address never disagrees with the page.
  useEffect(() => {
    if (params.tab && !TAB_LIST.some((t) => t.id === params.tab)) navigate('/settings');
  }, [params.tab]);
  // Choosing a tab puts it in the link, so following a link to the tab you were on still changes the address.
  const choose = (id: Tab) => {
    setTab(id);
    navigate(`/settings/${id}`);
  };
  const state = useAsync(async () => {
    const [settings, sources, status] = await Promise.all([api.getSettings(), api.listSources(), api.getStatus()]);
    return { settings, sources, paused: status.paused };
  }, [api]);

  const setSettings = (settings: Settings) => state.setData((d) => ({ ...d, settings }));
  const setPaused = (paused: boolean) => state.setData((d) => ({ ...d, paused }));
  const setSource = (source: Source) => state.setData((d) => ({ ...d, sources: d.sources.map((s) => (s.id === source.id ? source : s)) }));

  return (
    <div className="settings">
      <PageHeader title={<>My <strong>settings</strong></>} description="Changes save automatically." />
      <AsyncView state={state} what="settings" rows={6}>
        {({ settings, sources, paused }) => (
          <>
            <TabList label="Settings sections" idPrefix="settings" tabs={TAB_LIST} value={tab} onChange={choose} />
            <TabPanel idPrefix="settings" id="sources" active={tab === 'sources'}>
              <SourcesSection sources={sources} onChange={setSource} />
            </TabPanel>
            <TabPanel idPrefix="settings" id="channels" active={tab === 'channels'}>
              <ChannelsSection settings={settings} onChange={setSettings} />
            </TabPanel>
            <TabPanel idPrefix="settings" id="guard" active={tab === 'guard'}>
              <AutoSendSection paused={paused} autoSendThreshold={settings.autoSendThreshold} autonomousSources={sources.filter((s) => s.enabled && s.autonomy === 'autonomous').length} onChange={setPaused} />
              <GuardrailsSection settings={settings} onChange={setSettings} />
            </TabPanel>
            <TabPanel idPrefix="settings" id="conn" active={tab === 'conn'}>
              <ConnectionsSection settings={settings} onChange={setSettings} />
            </TabPanel>
            <TabPanel idPrefix="settings" id="files" active={tab === 'files'}>
              <StartupSection settings={settings} onChange={setSettings} />
              <OutputFolderSection settings={settings} onChange={setSettings} />
            </TabPanel>
          </>
        )}
      </AsyncView>
    </div>
  );
}
