import { describe, expect, it } from 'vitest';
import type { SecretKey, Source } from '../../shared/types';
import { createSettingsService, type SettingsPorts } from './settings-service';

/** In-memory ports — the SQLite and keychain adapters have their own tests. */
const fakes = () => {
  const kv = new Map<string, unknown>();
  const sources: Source[] = [];
  const secrets = new Map<SecretKey, string>();
  const ports: SettingsPorts = {
    kv: { get: (k) => structuredClone(kv.get(k)), set: (k, v) => void kv.set(k, structuredClone(v)) },
    sources: {
      list: () => structuredClone(sources),
      get: (id) => structuredClone(sources.find((s) => s.id === id)),
      save: (s) => {
        const i = sources.findIndex((x) => x.id === s.id);
        if (i >= 0) sources[i] = structuredClone(s);
        else sources.push(structuredClone(s));
      },
    },
    secrets: { set: (k, v) => (v ? secrets.set(k, v) : secrets.delete(k)), has: (k) => secrets.has(k) },
  };
  return { ports, secrets };
};

describe('settings service', () => {
  it('starts with the default guardrails and nothing secret set', () => {
    const settings = createSettingsService(fakes().ports).getSettings();
    expect(settings).toMatchObject({
      draftThreshold: 75, autoSendThreshold: 85, maxPerChannelPerDay: 10, dailyTokenBudget: 150_000,
      assistedFill: { platform: false, custom: false }, outputFolder: '~/Applio',
    });
    expect(settings.secretsSet).toEqual({ anthropicApiKey: false, gmailAppPassword: false, telegramBotToken: false });
  });

  it('seeds the default sources once, on first launch', () => {
    const { ports } = fakes();
    createSettingsService(ports).listSources();
    const second = createSettingsService(ports);
    expect(second.listSources().map((s) => s.id)).toEqual(['remoteok', 'remotive', 'himalayas', 'wwr', 'jobicy', 'arbeitnow', 'ats', 'hn', 'upwork', 'clip', 'jsearch']);
  });

  it('adds a newly shipped default source to an existing install, keeping its other choices', () => {
    const { ports } = fakes();
    ports.sources.save({ id: 'remoteok', name: 'RemoteOK', kind: 'board', enabled: false, autonomy: 'notify', via: 'Public JSON API' });
    const ids = createSettingsService(ports).listSources();
    expect(ids.find((s) => s.id === 'remoteok')).toMatchObject({ enabled: false, autonomy: 'notify' });
    expect(ids.find((s) => s.id === 'arbeitnow')).toMatchObject({ enabled: true, autonomy: 'draft' });
  });

  it('keeps a saved patch and leaves other settings alone', () => {
    const service = createSettingsService(fakes().ports);
    service.saveSettings({ draftThreshold: 70, blocklist: ['Initech'] });
    expect(service.getSettings()).toMatchObject({ draftThreshold: 70, autoSendThreshold: 85, blocklist: ['Initech'] });
  });

  it('refuses a monthly token budget below the daily one', () => {
    const service = createSettingsService(fakes().ports);
    expect(() => service.saveSettings({ monthlyTokenBudget: 1000 })).toThrow('The monthly token budget must be at least the daily one (150,000).');
    expect(service.getSettings().monthlyTokenBudget).toBe(3_000_000);
  });

  it('refuses an auto-send threshold below the draft threshold', () => {
    const service = createSettingsService(fakes().ports);
    expect(() => service.saveSettings({ autoSendThreshold: 60 })).toThrow('Auto-send must be at least the draft score (75).');
    expect(service.getSettings().autoSendThreshold).toBe(85);
  });

  it('stores a secret in the secret store and only reports that it is set', () => {
    const { ports, secrets } = fakes();
    const service = createSettingsService(ports);
    const settings = service.setSecret('telegramBotToken', '123:token');
    expect(secrets.get('telegramBotToken')).toBe('123:token');
    expect(settings.secretsSet.telegramBotToken).toBe(true);
    expect(JSON.stringify(service.getSettings())).not.toContain('123:token');
  });

  it('starts every source below Autonomous, so nothing is sent on its own until the operator chooses it', () => {
    const service = createSettingsService(fakes().ports);
    expect(service.listSources().filter((s) => s.autonomy === 'autonomous')).toEqual([]);
  });

  it('changes a source and keeps platform sources capped below autonomous', () => {
    const service = createSettingsService(fakes().ports);
    expect(service.updateSource('remoteok', { enabled: false }).enabled).toBe(false);
    expect(() => service.updateSource('upwork', { autonomy: 'autonomous' })).toThrow('Upwork is never autonomous');
    expect(() => service.updateSource('nope', { enabled: true })).toThrow('Source nope not found');
  });
});
