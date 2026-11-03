import { describe, expect, it } from 'vitest';
import { API_METHODS } from './api';
import { channelFor, unwrapIpcError } from './ipc';

describe('channelFor', () => {
  it('namespaces API methods on their own IPC channel', () => {
    expect(channelFor('listJobs')).toBe('applio:listJobs');
  });
});

describe('API_METHODS', () => {
  it('lists each method once', () => {
    expect(new Set(API_METHODS).size).toBe(API_METHODS.length);
  });
});

describe('unwrapIpcError', () => {
  it("strips Electron's remote-invoke prefix so the operator sees only the message", () => {
    expect(unwrapIpcError("Error invoking remote method 'applio:approveDraft': Error: Job j1 is not awaiting approval"))
      .toBe('Job j1 is not awaiting approval');
  });

  it('leaves plain messages untouched', () => {
    expect(unwrapIpcError('Daily limit reached')).toBe('Daily limit reached');
  });
});
