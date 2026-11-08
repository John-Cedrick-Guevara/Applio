// @vitest-environment node
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSecretStore, type Encryptor } from './secret-store';

/** Stands in for Electron safeStorage: reversible, and visibly not plain text. */
const fakeEncryptor = (available = true): Encryptor => ({
  isEncryptionAvailable: () => available,
  encryptString: (s) => Buffer.from(`enc:${[...s].reverse().join('')}`),
  decryptString: (b) => [...b.toString().slice(4)].reverse().join(''),
});

let dir = '';
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const tempFile = () => {
  dir = mkdtempSync(join(tmpdir(), 'applio-secrets-'));
  return join(dir, 'secrets.json');
};

describe('secret store', () => {
  it('stores a secret encrypted and reads it back', () => {
    const file = tempFile();
    const store = createSecretStore(fakeEncryptor(), file);
    store.set('telegramBotToken', '123:secret-token');
    expect(store.get('telegramBotToken')).toBe('123:secret-token');
    expect(readFileSync(file, 'utf8')).not.toContain('123:secret-token');
  });

  it("says plainly when the keychain won't decrypt a saved secret, with the fix", () => {
    const file = tempFile();
    createSecretStore(fakeEncryptor(), file).set('gmailAppPassword', 'abcd efgh');
    const locked = createSecretStore({ ...fakeEncryptor(), decryptString: () => { throw new Error('Error while decrypting the ciphertext provided to safeStorage.decryptString. Decryption is not available.'); } }, file);
    expect(() => locked.get('gmailAppPassword')).toThrow("Applio can't read your saved Gmail app password from the macOS keychain. Choose Always Allow when macOS asks, or save it again in Settings.");
  });

  it('reports which secrets are set, and keeps them across restarts', () => {
    const file = tempFile();
    createSecretStore(fakeEncryptor(), file).set('gmailAppPassword', 'abcd efgh');
    const reopened = createSecretStore(fakeEncryptor(), file);
    expect(reopened.has('gmailAppPassword')).toBe(true);
    expect(reopened.has('anthropicApiKey')).toBe(false);
  });

  it('removes a secret when set to an empty value', () => {
    const store = createSecretStore(fakeEncryptor(), tempFile());
    store.set('anthropicApiKey', 'sk-ant-1');
    store.set('anthropicApiKey', '');
    expect(store.has('anthropicApiKey')).toBe(false);
  });

  it('keeps the file readable by the operator only', () => {
    const file = tempFile();
    createSecretStore(fakeEncryptor(), file).set('anthropicApiKey', 'sk-ant-1');
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('tightens an existing file to owner-only on the next save', () => {
    const file = tempFile();
    writeFileSync(file, '{}');
    chmodSync(file, 0o644);
    createSecretStore(fakeEncryptor(), file).set('anthropicApiKey', 'sk-ant-1');
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('replaces the file in one step, leaving no temporary file behind', () => {
    const file = tempFile();
    const store = createSecretStore(fakeEncryptor(), file);
    store.set('anthropicApiKey', 'sk-ant-1');
    store.set('gmailAppPassword', 'abcd');
    expect(readdirSync(dir)).toEqual(['secrets.json']);
    expect(store.has('anthropicApiKey') && store.has('gmailAppPassword')).toBe(true);
  });

  it('refuses to save when the OS keychain is unavailable, never falling back to plain text', () => {
    const file = tempFile();
    const store = createSecretStore(fakeEncryptor(false), file);
    expect(() => store.set('anthropicApiKey', 'sk-ant-1')).toThrow(/keychain isn't available/);
    expect(() => readFileSync(file)).toThrow();
  });
});
