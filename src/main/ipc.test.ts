// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: { senderFrame: { url: string } }, ...args: unknown[]) => Promise<unknown>;
const handlers = vi.hoisted(() => new Map<string, Handler>());
vi.mock('electron', () => ({ ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn) } }));

import type { ApplioApi } from '../shared/api';
import { createMockApi } from '../shared/mock/mock-api';
import { registerApiHandlers } from './ipc';

const fromApp = { senderFrame: { url: 'file:///app/index.html' } };
const call = (method: keyof ApplioApi, ...args: unknown[]) => (handlers.get(`applio:${method}`) as Handler)(fromApp, ...args);

let api: ApplioApi;
beforeEach(() => {
  handlers.clear();
  api = createMockApi({ latencyMs: 0 });
  registerApiHandlers(api, undefined);
});

describe('IPC handlers', () => {
  it('passes valid calls through to the backend', async () => {
    const job = await call('getJob', 'j1');
    expect(job).toMatchObject({ id: 'j1' });
  });

  it('rejects invalid arguments with a readable message before reaching the backend', async () => {
    const getJob = vi.spyOn(api, 'getJob');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(call('getJob', '')).rejects.toThrow("Applio couldn't do that: argument 1: id can't be empty");
    expect(getJob).not.toHaveBeenCalled();
  });

  it('logs the method and the issue, not the values', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(call('saveFact', { group: 'Projects', text: '' })).rejects.toThrow();
    expect(log).toHaveBeenCalledWith('[ipc] rejected saveFact: invalid arguments', [{ path: 'text', message: "can't be empty" }]);
  });

  it('accepts only web links in contact details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const contact = { phone: '', location: '', education: '', notes: '' };
    await expect(call('saveContact', { ...contact, links: [{ label: 'Site', url: 'javascript:alert(1)' }] })).rejects.toThrow();
    await expect(call('saveFactGroup', { name: 'X', link: 'file:///etc/passwd' })).rejects.toThrow();
  });

  it('never logs a secret, even when its call is rejected', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const secret = 'sk-ant-do-not-log-me';
    await expect(call('setSecret', 'awsKey', secret)).rejects.toThrow();
    await expect(call('setSecret', 'gmailAppPassword', secret.repeat(300))).rejects.toThrow();
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
});
