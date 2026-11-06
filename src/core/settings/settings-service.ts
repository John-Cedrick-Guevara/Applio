import type { ApplioApi } from '../../shared/api';
import { DEFAULT_SETTINGS, DEFAULT_SOURCES } from '../../shared/defaults';
import { AppError } from '../../shared/errors';
import type { SecretKey, Settings, Source } from '../../shared/types';

/** Ports this service needs; `src/infra` implements them (SQLite, OS keychain). */
export interface SettingsPorts {
  kv: { get(key: string): unknown; set(key: string, value: unknown): void };
  sources: { list(): Source[]; get(id: string): Source | undefined; save(source: Source): void };
  secrets: { set(key: SecretKey, value: string): void; has(key: SecretKey): boolean };
}

/** A settings change that breaks a guardrail rule; the message says which. */
export class InvalidSettingsError extends AppError {
  constructor(message: string) {
    super('INVALID_SETTINGS', message);
  }
}

type SettingsMethods = 'getSettings' | 'saveSettings' | 'setSecret' | 'listSources' | 'updateSource';
/** The API methods this service answers, synchronously; the backend wraps them in promises. */
export type SettingsService = { [M in SettingsMethods]: (...args: Parameters<ApplioApi[M]>) => Awaited<ReturnType<ApplioApi[M]>> };

const KEY = 'settings';
const SECRET_KEYS: readonly SecretKey[] = ['anthropicApiKey', 'gmailAppPassword', 'telegramBotToken'];

/**
 * Settings, sources and secrets (SPEC F2, F6). Stored values override the
 * defaults key by key, so a fresh install reads as the defaults. `secretsSet`
 * is always derived from the secret store, never stored.
 */
export function createSettingsService({ kv, sources, secrets }: SettingsPorts): SettingsService {
  // Seed any default source this install doesn't have yet: all of them on first launch, and
  // sources added in later versions afterwards. Existing sources keep the operator's choices.
  const known = new Set(sources.list().map((s) => s.id));
  DEFAULT_SOURCES.filter((s) => !known.has(s.id)).forEach((s) => sources.save(s));

  /** Only what the operator changed; defaults fill the rest, so a later default change still reaches them. */
  const changed = () => (kv.get(KEY) as Partial<Settings> | undefined) ?? {};
  const stored = () => ({ ...DEFAULT_SETTINGS, ...changed() });

  const getSettings = (): Settings => ({
    ...stored(),
    secretsSet: Object.fromEntries(SECRET_KEYS.map((k) => [k, secrets.has(k)])) as Settings['secretsSet'],
  });

  return {
    getSettings,

    saveSettings: (patch) => {
      const next = { ...stored(), ...patch };
      if (next.autoSendThreshold < next.draftThreshold) {
        throw new InvalidSettingsError(`Auto-send must be at least the draft score (${next.draftThreshold}).`);
      }
      if (next.monthlyTokenBudget < next.dailyTokenBudget) {
        throw new InvalidSettingsError(`The monthly token budget must be at least the daily one (${next.dailyTokenBudget.toLocaleString('en-US')}).`);
      }
      kv.set(KEY, { ...changed(), ...patch });
      return getSettings();
    },

    setSecret: (key, value) => {
      // Copying from @BotFather or Google often brings a space or line break along, which breaks every request.
      secrets.set(key, value.trim());
      return getSettings();
    },

    listSources: () => sources.list(),

    updateSource: (id, patch) => {
      const source = sources.get(id);
      if (!source) throw new AppError('NOT_FOUND', `Source ${id} not found`);
      if (patch.autonomy === 'autonomous' && source.maxAutonomy && source.maxAutonomy !== 'autonomous') {
        throw new InvalidSettingsError(`${source.name} is never autonomous`);
      }
      const next = { ...source, ...patch };
      sources.save(next);
      return next;
    },
  };
}
