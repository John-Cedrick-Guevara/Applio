// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (event: { senderFrame: { url: string } }, ...args: unknown[]) => Promise<unknown>;
const handlers = vi.hoisted(() => new Map<string, Handler>());
vi.mock('electron', () => ({ ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn) } }));

import type { ApplioApi } from '../shared/api';
import { AppError } from '../shared/errors';
import { createMockApi } from '../shared/mock/mock-api';
import { registerApiHandlers } from './ipc';

const fromApp = { senderFrame: { url: 'file:///app/index.html' } };
const call = (method: keyof ApplioApi, ...args: unknown[]) => (handlers.get(`applio:${method}`) as Handler)(fromApp, ...args);

let api: ApplioApi;
const logged = vi.fn();
beforeEach(() => {
  handlers.clear();
  logged.mockReset();
  api = createMockApi({ latencyMs: 0 });
  registerApiHandlers(api, undefined, logged);
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

  it('writes a failed call to the log file with its error, and the operator sees only the message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new AppError('analysis_unreadable', 'No title.', { cause: 'title: too_small' });
    vi.spyOn(api, 'getJob').mockRejectedValue(failure);
    const thrown = await call('getJob', 'j1').catch((e: Error) => e);
    expect(logged).toHaveBeenCalledWith('getJob', failure);
    expect((thrown as Error).message).toBe('No title.');
  });

  it('logs a rejected argument set by its issues, never its values', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(call('setSecret', 'gmailAppPassword', 'sk-ant-do-not-log-me'.repeat(300))).rejects.toThrow();
    expect(JSON.stringify(logged.mock.calls)).not.toContain('sk-ant-do-not-log-me');
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('still shows the original message when the logger itself throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    logged.mockImplementation(() => { throw new Error('disk full'); });
    vi.spyOn(api, 'getJob').mockRejectedValue(new Error('Job j1 not found'));
    await expect(call('getJob', 'j1')).rejects.toThrow('Job j1 not found');
  });

  it('logs an untrusted sender to the file, without running the call', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const getJob = vi.spyOn(api, 'getJob');
    const evil = { senderFrame: { url: 'https://evil.example/x' } };
    await expect((handlers.get('applio:getJob') as Handler)(evil, 'j1')).rejects.toThrow('Request rejected');
    expect(getJob).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalledWith('getJob', expect.objectContaining({ message: expect.stringContaining('https://evil.example/x') }));
  });
});
