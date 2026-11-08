import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AppError } from '../../shared/errors';
import type { SecretKey } from '../../shared/types';

/** The slice of Electron's `safeStorage` this store uses; faked in tests. */
export interface Encryptor {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

/** The OS keychain can't encrypt, so the secret isn't saved anywhere. */
export class SecretStorageUnavailableError extends AppError {
  constructor() {
    super('SECRET_STORAGE_UNAVAILABLE', "Your system keychain isn't available, so Applio didn't save this. Unlock or set up the keychain and try again.");
  }
}

const SECRET_LABEL: Record<SecretKey, string> = { gmailAppPassword: 'Gmail app password', telegramBotToken: 'Telegram bot token', anthropicApiKey: 'Anthropic API key' };

/**
 * A saved secret the keychain won't decrypt: access was denied, or the app's signature
 * changed since it was saved (each local build of the installed app is a new signature).
 */
export class SecretUnreadableError extends AppError {
  constructor(key: SecretKey, options?: ErrorOptions) {
    super('SECRET_UNREADABLE', `Applio can't read your saved ${SECRET_LABEL[key]} from the macOS keychain. Choose Always Allow when macOS asks, or save it again in Settings.`, options);
  }
}

export interface SecretStore {
  /** Saves a secret, or removes it when `value` is empty. @throws SecretStorageUnavailableError */
  set(key: SecretKey, value: string): void;
  has(key: SecretKey): boolean;
  /** For main-process adapters only (Gmail, Telegram, AI); never returned over IPC. @throws SecretUnreadableError */
  get(key: SecretKey): string | undefined;
}

/**
 * Secrets encrypted with the OS keychain (Electron `safeStorage`) and kept in
 * one owner-only file outside the Applio folder. Never in SQLite, logs, or the
 * output folder (CLAUDE.md §3). If encryption is unavailable, saving fails
 * instead of falling back to plain text.
 */
export function createSecretStore(encryptor: Encryptor, file: string): SecretStore {
  const load = (): Partial<Record<SecretKey, string>> => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});

  return {
    set: (key, value) => {
      if (!encryptor.isEncryptionAvailable()) throw new SecretStorageUnavailableError();
      const all = load();
      if (value) all[key] = encryptor.encryptString(value).toString('base64');
      else delete all[key];
      mkdirSync(dirname(file), { recursive: true });
      // Write a temp file and rename it over the old one, so a crash mid-write can't lose every saved secret.
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify(all), { mode: 0o600 });
      chmodSync(tmp, 0o600); // the mode option only applies when the file is created
      renameSync(tmp, file);
    },
    has: (key) => key in load(),
    get: (key) => {
      const stored = load()[key];
      if (stored === undefined) return undefined;
      try {
        return encryptor.decryptString(Buffer.from(stored, 'base64'));
      } catch (err) {
        throw new SecretUnreadableError(key, { cause: err });
      }
    },
  };
}
