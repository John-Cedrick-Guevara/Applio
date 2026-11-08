import { describe, expect, it } from 'vitest';
import { filesState, pendingReason } from './job-progress';

describe('pendingReason', () => {
  const job = (status: 'found' | 'scored', note?: string) => ({ status, history: [{ status, at: '2026-11-06T00:00:00.000Z', ...(note ? { note } : {}) }] });

  it('shows the last failure note when there is one', () => {
    expect(pendingReason(job('scored', "Not drafted: Claude Code couldn't finish: API Error: 429"))).toBe("Not drafted: Claude Code couldn't finish: API Error: 429");
  });

  it('falls back to what is still to do', () => {
    expect(pendingReason(job('found'))).toBe('Not scored yet');
    expect(pendingReason(job('scored'))).toBe('Not drafted yet');
  });
});


describe('filesState', () => {
  it('is saving while a fresh draft has no folder yet', () => {
    expect(filesState({ history: [] })).toEqual({ kind: 'saving' });
  });
  it('passes on why the files could not be saved', () => {
    expect(filesState({ history: [{ status: 'drafted' as const, at: '', note: "Couldn't save the files: printing failed" }] })).toEqual({ kind: 'failed', reason: "Couldn't save the files: printing failed" });
  });
  it('is ready once the folder exists', () => {
    expect(filesState({ folderPath: '/out/acme', history: [] })).toEqual({ kind: 'ready' });
  });
});

