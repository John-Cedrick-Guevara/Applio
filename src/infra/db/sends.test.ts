// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { seedJobs } from '../../shared/mock/fixtures';
import type { Job } from '../../shared/types';
import { openDatabase } from './database';
import { createJobsRepo } from './jobs';
import { createSendsRepo } from './sends';

const NOW = '2026-11-06T09:00:00.000Z';
const setup = () => {
  const db = openDatabase(':memory:');
  const jobs = seedJobs(new Date(NOW)).slice(0, 2) as Job[];
  for (const j of jobs) createJobsRepo(db).insert(j, { dedupKey: j.id, createdAt: NOW });
  return { sends: createSendsRepo(db), ids: jobs.map((j) => j.id) };
};
const sent = { to: 'jobs@acme.com', subject: 'Application: Engineer', body: 'Dear team', attachments: ['resume.pdf'], at: NOW, messageId: '<j1.1@applio.local>' };

describe('sends repository', () => {
  it('claims a job once; a second claim fails', () => {
    const { sends, ids } = setup();
    sends.claim(ids[0]!, 'email', NOW);
    expect(() => sends.claim(ids[0]!, 'email', NOW)).toThrow();
    expect(sends.get(ids[0]!)).toMatchObject({ state: 'sending', channel: 'email' });
  });

  it('records exactly what was sent', () => {
    const { sends, ids } = setup();
    sends.claim(ids[0]!, 'email', NOW);
    sends.markSent(ids[0]!, sent);
    expect(sends.get(ids[0]!)).toEqual({ jobId: ids[0], channel: 'email', state: 'sent', ...sent });
  });

  it('releases a claim after a failure so the send can be retried', () => {
    const { sends, ids } = setup();
    sends.claim(ids[0]!, 'email', NOW);
    sends.release(ids[0]!);
    expect(sends.get(ids[0]!)).toBeUndefined();
    expect(() => sends.claim(ids[0]!, 'email', NOW)).not.toThrow();
  });

  it('counts sends per channel since a time, claims included', () => {
    const { sends, ids } = setup();
    sends.claim(ids[0]!, 'email', '2026-11-05T23:00:00.000Z');
    sends.claim(ids[1]!, 'email', NOW);
    expect(sends.countSince('email', '2026-11-06T00:00:00.000Z')).toBe(1);
    expect(sends.countSince('ats', '2026-11-06T00:00:00.000Z')).toBe(0);
  });
});
