import { describe, expect, it } from 'vitest';
import { dedupe, dedupKey } from './dedup';
import { discovered } from './test-jobs';

describe('dedupKey', () => {
  it('treats the same role at the same company as one job, however each board writes it', () => {
    expect(dedupKey({ company: 'Acme, Inc.', title: 'Sr. Back-end Engineer' })).toBe(dedupKey({ company: 'acme', title: 'Senior Backend Engineer' }));
    expect(dedupKey({ company: 'Northwind GmbH', title: 'Full Stack Developer (m/w/d)' })).toBe(dedupKey({ company: 'Northwind', title: 'Full-stack Developer' }));
  });

  it('keeps different roles and different companies apart', () => {
    expect(dedupKey({ company: 'Acme', title: 'Backend Engineer' })).not.toBe(dedupKey({ company: 'Acme', title: 'Frontend Engineer' }));
    expect(dedupKey({ company: 'Acme', title: 'Backend Engineer' })).not.toBe(dedupKey({ company: 'Apex Labs', title: 'Backend Engineer' }));
  });
});

describe('dedupe', () => {
  it('merges the same job seen on two boards into the first one found', () => {
    const remotive = discovered({ sourceId: 'remotive', company: 'Acme' });
    const remoteOk = discovered({ sourceId: 'remoteok', company: 'Acme Inc', title: 'Sr. Backend Engineer', applyUrl: 'https://remoteok.com/x' });
    const { fresh, duplicates } = dedupe([remotive, remoteOk], new Set());
    expect(fresh).toEqual([{ ...remotive, dedupKey: dedupKey(remotive) }]);
    expect(duplicates).toBe(1);
  });

  it('drops a job already in Applio, so a sent application is never queued again', () => {
    const applied = discovered();
    const { fresh, duplicates } = dedupe([discovered({ sourceId: 'jobicy', externalId: 'other' })], new Set([dedupKey(applied)]));
    expect(fresh).toEqual([]);
    expect(duplicates).toBe(1);
  });

  it('treats a company with or without a descriptor like "Labs" as the same company', () => {
    expect(dedupKey({ company: 'Northbeam Labs', title: 'AI Engineer (LLM Agents)' })).toBe(dedupKey({ company: 'Northbeam, Inc.', title: 'AI Engineer (LLM Agents)' }));
  });

  it('keeps a company that is nothing but a descriptor, rather than an empty key', () => {
    expect(dedupKey({ company: 'Labs', title: 'Engineer' })).toBe('labs|engineer');
  });
});
