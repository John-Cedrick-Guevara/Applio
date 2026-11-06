// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createJobsRepo, createProfileRepo, openDatabase } from '../infra/db';
import { seedJobs } from '../shared/mock/fixtures';
import type { Job } from '../shared/types';
import { createToolPorts } from './db-ports';
import { createTools } from './tools';

const NOW = new Date('2026-11-06T09:00:00.000Z');

const setup = () => {
  const db = openDatabase(':memory:');
  const job = { ...(seedJobs(NOW)[0] as Job), status: 'found' as const, history: [{ status: 'found' as const, at: NOW.toISOString() }] };
  createJobsRepo(db).insert(job, { dedupKey: 'k', createdAt: NOW.toISOString() });
  createProfileRepo(db).saveFact({ id: 'f1', group: 'Acme', text: 'Cut API latency 40%', tags: [], timesUsed: 0 });
  createProfileRepo(db).saveAnswer({ id: 'a1', question: 'Notice period?', answer: 'Two weeks', origin: 'you', timesReused: 2 });
  const tools = createTools(createToolPorts(db, [job.id], () => NOW));
  const call = (name: string, input: unknown = {}) => tools.find((t) => t.name === name)!.call(input);
  return { db, job, call, jobs: createJobsRepo(db) };
};

describe('tools over the Applio database', () => {
  it('store a match and move a found job to scored', () => {
    const { call, jobs, job } = setup();
    call('save_match', { jobId: job.id, score: 82, roleSummary: 'APIs', descriptionSummary: 'Remote', strengths: [{ text: 'Fast APIs', factId: 'f1' }], gaps: [] });
    expect(jobs.get(job.id)).toMatchObject({ status: 'scored', score: 82, roleSummary: 'APIs' });
  });

  it('store a draft and move the job to drafted', () => {
    const { call, db, jobs, job } = setup();
    call('save_draft', {
      jobId: job.id, kind: 'cover-letter', headline: 'h', summary: 's',
      resume: [{ heading: 'Acme', items: [{ text: 'Cut API latency 40%', factId: 'f1' }, { text: 'Latency down 40%', factId: 'f1' }] }],
      coverLetter: 'Dear team', answers: [{ question: 'Notice?', answerId: 'a1' }],
    });
    expect(jobs.get(job.id)).toMatchObject({ status: 'drafted', factsUsed: 1 });
    expect(db.prepare('SELECT cover_letter FROM drafts').get()).toEqual({ cover_letter: 'Dear team' });
    const profile = createProfileRepo(db);
    expect(profile.listFacts()[0]?.timesUsed).toBe(1);
    expect(profile.listAnswers()[0]?.timesReused).toBe(3);
  });

  it("log a note without changing the job's status", () => {
    const { call, jobs, job } = setup();
    call('log_event', { jobId: job.id, message: 'Asks for a portfolio' });
    expect(jobs.get(job.id)?.history.at(-1)).toEqual({ status: 'found', at: NOW.toISOString(), note: 'Asks for a portfolio' });
  });

  it('read the fact bank from the database', () => {
    expect(JSON.parse(setup().call('get_profile')).facts).toEqual([{ id: 'f1', group: 'Acme', text: 'Cut API latency 40%' }]);
  });
});
