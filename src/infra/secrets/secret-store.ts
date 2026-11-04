import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

export interface SecretStore {
  /** Saves a secret, or removes it when `value` is empty. @throws SecretStorageUnavailableError */
  set(key: SecretKey, value: string): void;
  has(key: SecretKey): boolean;
  /** For main-process adapters only (Gmail, Telegram, AI); never returned over IPC. */
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
      writeFileSync(file, JSON.stringify(all), { mode: 0o600 });
    },
    has: (key) => key in load(),
    get: (key) => {
      const stored = load()[key];
      return stored === undefined ? undefined : encryptor.decryptString(Buffer.from(stored, 'base64'));
    },
  };
}
