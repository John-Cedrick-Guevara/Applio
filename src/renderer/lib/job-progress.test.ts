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
  it('is saving only while main is working on the job', () => {
    expect(filesState({ history: [] }, true)).toEqual({ kind: 'saving' });
  });
  it('says the save stopped when nothing is saving it, instead of spinning forever', () => {
    // Applio can quit between Claude's draft and the PDFs printing; nothing records a failure then.
    expect(filesState({ history: [] }, false)).toEqual({ kind: 'failed', reason: 'Applio stopped before the PDFs were printed' });
  });
  it('keeps a recorded failure over the stopped message, and never doubts a finished save', () => {
    const note = "Couldn't save the files: printing failed";
    expect(filesState({ history: [{ status: 'drafted' as const, at: '', note }] }, false)).toEqual({ kind: 'failed', reason: note });
    expect(filesState({ folderPath: '/out/acme', history: [] }, false)).toEqual({ kind: 'ready' });
  });
});

