import { beforeEach, describe, expect, it } from 'vitest';
import type { ApplioApi } from '../api';
import { createMockApi } from './mock-api';

let api: ApplioApi;

beforeEach(() => {
  api = createMockApi({ latencyMs: 0, now: () => new Date('2026-11-03T12:00:00Z') });
});

describe('listJobs', () => {
  it('filters by status', async () => {
    const jobs = await api.listJobs({ statuses: ['drafted'] });
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.status === 'drafted')).toBe(true);
  });

  it('filters by minimum score', async () => {
    const jobs = await api.listJobs({ minScore: 85 });
    expect(jobs.every((j) => (j.score ?? 0) >= 85)).toBe(true);
  });

  it('searches company and title case-insensitively', async () => {
    const [first] = await api.listJobs();
    const jobs = await api.listJobs({ search: first!.company.toUpperCase() });
    expect(jobs.map((j) => j.id)).toContain(first!.id);
  });

  it('returns copies so callers cannot mutate the store', async () => {
    const [first] = await api.listJobs();
    first!.company = 'Mutated';
    expect((await api.getJob(first!.id)).company).not.toBe('Mutated');
  });
});

/** Saves a Gmail address and app password, which email sends need. */
const setUpGmail = async (on: ApplioApi) => {
  await on.saveSettings({ gmailAddress: 'sam@gmail.com', fullName: 'Sam Rivera' });
  await on.setSecret('gmailAppPassword', 'abcd efgh ijkl mnop');
};

describe('approveDraft', () => {
  it('refuses an email send while Gmail is not set up, and leaves the draft waiting', async () => {
    const draftOnEmail = (await api.listJobs({ statuses: ['drafted'] })).find((j) => j.channel === 'email')!;
    await expect(api.approveDraft(draftOnEmail.id)).rejects.toThrow('Set up Gmail in Settings first');
    expect((await api.getJob(draftOnEmail.id)).status).toBe('drafted');
    expect(await api.getSend(draftOnEmail.id)).toBeNull();
  });

  it('logs exactly what went out, and nothing for a job it never sent', async () => {
    await setUpGmail(api);
    const draftOnEmail = (await api.listJobs({ statuses: ['drafted'] })).find((j) => j.channel === 'email')!;
    await api.approveDraft(draftOnEmail.id);
    expect(await api.getSend(draftOnEmail.id)).toMatchObject({ state: 'sent', to: draftOnEmail.applyTarget, subject: `Application: ${draftOnEmail.title} — Sam Rivera` });
    expect(await api.getSend('j3')).toBeNull();
  });

  it('leaves a refused send approved with the reason, and a retry sends it', async () => {
    let refuse: string | undefined = 'Gmail rejected the app password.';
    const failing = createMockApi({ latencyMs: 0, sendFailure: () => refuse });
    await setUpGmail(failing);
    await expect(failing.approveDraft('j1')).rejects.toThrow('Gmail rejected the app password.');
    expect(await failing.getJob('j1')).toMatchObject({ status: 'approved', history: expect.arrayContaining([expect.objectContaining({ note: 'Not sent: Gmail rejected the app password.' })]) });
    refuse = undefined;
    expect((await failing.approveDraft('j1')).status).toBe('applied');
  });

  it('sends immediately on email/ATS channels', async () => {
    await setUpGmail(api);
    const draftOnEmail = (await api.listJobs({ statuses: ['drafted'] })).find((j) => j.channel === 'email')!;
    const approved = await api.approveDraft(draftOnEmail.id);
    expect(approved.status).toBe('applied');
    expect(approved.history.at(-1)?.status).toBe('applied');
  });

  it('stops at approved on platform channels so the operator submits', async () => {
    const draftOnPlatform = (await api.listJobs({ statuses: ['drafted'] })).find((j) => j.channel === 'platform')!;
    expect((await api.approveDraft(draftOnPlatform.id)).status).toBe('approved');
  });

  it('rejects jobs that are not awaiting approval', async () => {
    const [applied] = await api.listJobs({ statuses: ['applied'] });
    await expect(api.approveDraft(applied!.id)).rejects.toThrow(/not awaiting approval/);
  });
});

describe('draftJob', () => {
  it('drafts a scored job on request', async () => {
    const [scored] = await api.listJobs({ statuses: ['scored'] });
    expect((await api.draftJob(scored!.id)).status).toBe('drafted');
    expect(await api.getDraft(scored!.id)).not.toBeNull();
  });

  it('refuses a job that is not waiting to be drafted', async () => {
    const [applied] = await api.listJobs({ statuses: ['applied'] });
    await expect(api.draftJob(applied!.id)).rejects.toThrow('Only scored jobs can be drafted');
  });
});

describe('setStatus', () => {
  it('records allowed moves in history', async () => {
    const [applied] = await api.listJobs({ statuses: ['applied'] });
    const job = await api.setStatus(applied!.id, 'interview', 'Call booked');
    expect(job.status).toBe('interview');
    expect(job.history.at(-1)).toMatchObject({ status: 'interview', note: 'Call booked' });
  });

  it('rejects moves the status flow does not allow', async () => {
    const [applied] = await api.listJobs({ statuses: ['applied'] });
    await expect(api.setStatus(applied!.id, 'drafted')).rejects.toThrow(/Cannot move/);
  });
});

describe('secrets', () => {
  it('marks a secret as set without ever returning its value', async () => {
    const settings = await api.setSecret('gmailAppPassword', 'abcd efgh ijkl mnop');
    expect(settings.secretsSet.gmailAppPassword).toBe(true);
    expect(JSON.stringify(await api.getSettings())).not.toContain('abcd efgh');
  });
});

describe('profile', () => {
  it('creates a fact with a new id and deletes it', async () => {
    const fact = await api.saveFact({ group: 'Projects', text: 'Go service, 3 years' });
    expect((await api.getProfile()).facts.map((f) => f.id)).toContain(fact.id);
    await api.deleteFact(fact.id);
    expect((await api.getProfile()).facts.map((f) => f.id)).not.toContain(fact.id);
  });
});

describe('automation', () => {
  it('reports the last scan', async () => {
    const status = await api.getStatus();
    expect(status.lastRun?.found).toBeGreaterThan(0);
  });

  it('runs a scan the operator starts, even while auto-send is paused', async () => {
    expect((await api.setAutomationPaused(true)).paused).toBe(true);
    expect((await api.runDiscovery()).found).toBeGreaterThanOrEqual(0);
  });
});

describe('drafts', () => {
  it('marks a cover letter as edited once the operator changes it', async () => {
    expect((await api.getDraft('j1'))?.edited).toBe(false);
    expect((await api.updateCoverLetter('j1', 'Hi')).edited).toBe(true);
  });
});

describe('skills', () => {
  it('changing skills leaves an existing draft as it was', async () => {
    const before = await api.getDraft('j1');
    await api.saveSkills(['Go']);
    expect(await api.getDraft('j1')).toEqual(before);
  });
});

describe('follow-ups', () => {
  it('logs a follow-up on an application still waiting', async () => {
    const job = await api.sendFollowUp('j10', 'Following up');
    expect(job.history.at(-1)).toMatchObject({ status: 'applied', note: 'Follow-up sent' });
  });

  it('refuses follow-ups once there is a reply', async () => {
    await expect(api.sendFollowUp('j8', 'Hi')).rejects.toThrow(/waiting on a reply/);
  });

  it('records who sent an approved application', async () => {
    await setUpGmail(api);
    expect((await api.approveDraft('j1')).sentBy).toBe('you-app');
    expect((await api.markApplied('j3')).sentBy).toBe('you-manual');
  });
});

describe('add job', () => {
  it('detects the apply channel and queues the job for review', async () => {
    const preview = await api.analyzeJob({ kind: 'text', value: 'Send your CV to hiring@brightline.example' });
    expect(preview).toMatchObject({ channel: 'email', maxAutonomy: 'autonomous' });
    const job = await api.addJob(preview);
    expect(job.status).toBe('drafted');
    expect(await api.getDraft(job.id)).not.toBeNull();
  });

  it('caps platform links at draft', async () => {
    expect((await api.analyzeJob({ kind: 'link', value: 'https://www.linkedin.com/jobs/view/1' })).maxAutonomy).toBe('draft');
  });
});

describe('sources', () => {
  it('refuses autonomous mode where the source forbids it', async () => {
    await expect(api.updateSource('clip', { autonomy: 'autonomous' })).rejects.toThrow(/never autonomous/);
  });
});

describe('seed data', () => {
  it('gives every closed application a sent date', async () => {
    const closed = await api.listJobs({ statuses: ['rejected', 'ghosted'] });
    expect(closed.every((j) => j.history.some((e) => e.status === 'applied'))).toBe(true);
  });
});

describe('fact bank and drafts', () => {
  it('keeps generated drafts unchanged when a cited fact is deleted', async () => {
    const before = (await api.getDraft('j1'))!.coverLetter;
    await api.deleteFact('f1');
    expect((await api.getDraft('j1'))!.coverLetter).toBe(before);
  });
});
