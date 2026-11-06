import { describe, expect, it, vi } from 'vitest';
import { seedDrafts, seedJobs } from '../../shared/mock/fixtures';
import type { Draft, Job, JobStatus, SentBy } from '../../shared/types';
import { approveDraft, type ApplyPorts, type SendLogRow } from './send-application';

const NOW = new Date('2026-11-06T09:00:00.000Z');

/** One drafted email job, an in-memory send log, and an outbox standing in for Gmail. */
const setup = (over: Partial<Job> = {}, opts: { sentToday?: number; perChannel?: number } = {}) => {
  const base = seedJobs(NOW)[0] as Job;
  let job: Job = { ...base, id: 'j1', status: 'drafted', channel: 'email', applyTarget: 'jobs@acme.com', folderPath: '/out/acme', tokensUsed: 5200, ...over };
  const draft: Draft = { ...(seedDrafts(seedJobs(NOW), NOW)[0] as Draft), jobId: 'j1', coverLetter: 'Dear Acme team,\n\nI build APIs.', answers: [
    { question: 'Why us?', answer: 'Your API work.', origin: 'ai', tokens: 0 },
    { question: 'Notice?', answer: 'Two weeks', origin: 'bank', tokens: 0 },
  ] };
  const log = new Map<string, SendLogRow>();
  const outbox: unknown[] = [];
  const files: Record<string, string> = {};
  const ports: ApplyPorts = {
    job: () => job,
    draft: () => draft,
    transition: (_id, status: JobStatus, extra?: { sentBy?: SentBy; note?: string }) => {
      job = { ...job, status, ...(extra?.sentBy ? { sentBy: extra.sentBy } : {}), history: [...job.history, { status, at: NOW.toISOString(), ...(extra?.note ? { note: extra.note } : {}) }] };
      return job;
    },
    note: vi.fn(),
    sendLog: {
      get: (id) => log.get(id),
      claim: (id, channel, at) => {
        if (log.has(id)) throw new Error('UNIQUE constraint failed');
        log.set(id, { state: 'sending', channel, at });
      },
      markSent: (id, r) => void log.set(id, { state: 'sent', channel: 'email', ...r }),
      release: (id) => void log.delete(id),
      countSince: () => opts.sentToday ?? 0,
    },
    sendEmail: vi.fn(async (msg) => void outbox.push(msg)),
    folder: () => job.folderPath,
    fileExists: () => true,
    writeFile: (path, text) => void (files[path] = text),
    owner: () => ({ name: 'Sam Rivera', email: 'sam@gmail.com' }),
    caps: () => ({ gmailDaily: 100, perChannel: opts.perChannel ?? 10 }),
    dayStart: () => '2026-11-06T00:00:00.000Z',
    now: () => NOW,
    saveAiAnswers: vi.fn(),
  };
  return { ports, outbox, files, log, job: () => job };
};

describe('approveDraft over email', () => {
  it('sends the cover letter as the body with the résumé attached, from Gmail', async () => {
    const { ports, outbox } = setup();
    await approveDraft('j1', ports);
    expect(outbox).toEqual([{
      from: 'Sam Rivera <sam@gmail.com>', to: 'jobs@acme.com', subject: 'Application: Senior Backend Engineer — Sam Rivera',
      text: 'Dear Acme team,\n\nI build APIs.', attachments: [{ filename: 'resume.pdf', path: '/out/acme/resume.pdf' }],
    }]);
  });

  it('marks the job applied by you and writes sent.md with exactly what went out', async () => {
    const { ports, files, job } = setup();
    expect((await approveDraft('j1', ports)).status).toBe('applied');
    expect(job()).toMatchObject({ status: 'applied', sentBy: 'you-app' });
    const md = files['/out/acme/sent.md']!;
    for (const part of ['To: jobs@acme.com', 'Subject: Application: Senior Backend Engineer — Sam Rivera', 'Channel: email', 'Sent: 2026-11-06T09:00:00.000Z', 'Tokens: 5200', 'Attachments: resume.pdf', 'Dear Acme team,\n\nI build APIs.']) {
      expect(md).toContain(part);
    }
  });

  it('adds approved AI-written answers to the answer bank', async () => {
    const { ports } = setup();
    await approveDraft('j1', ports);
    expect(ports.saveAiAnswers).toHaveBeenCalledWith([{ question: 'Why us?', answer: 'Your API work.' }]);
  });

  it('never sends the same job twice', async () => {
    const { ports } = setup();
    await approveDraft('j1', ports);
    await expect(approveDraft('j1', ports)).rejects.toThrow('Job j1 is not awaiting approval');
    expect(ports.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('refuses to resend after a crash mid-send, since the email may have gone out', async () => {
    const { ports, log } = setup({ status: 'approved' });
    log.set('j1', { state: 'sending', channel: 'email', at: '2026-11-06T08:59:00.000Z' });
    await expect(approveDraft('j1', ports)).rejects.toThrow(
      "A send started at 2026-11-06T08:59:00.000Z didn't finish, so Applio can't tell whether it went out. Check Gmail's Sent folder, then use Mark as applied or I didn't apply.",
    );
    expect(ports.sendEmail).not.toHaveBeenCalled();
  });

  it('leaves the job approved with the reason when SMTP fails, and a retry sends it', async () => {
    const { ports, job } = setup();
    vi.mocked(ports.sendEmail).mockRejectedValueOnce(new Error('Gmail rejected the app password.'));
    await expect(approveDraft('j1', ports)).rejects.toThrow('Gmail rejected the app password.');
    expect(job().status).toBe('approved');
    expect(ports.note).toHaveBeenCalledWith('j1', 'Not sent: Gmail rejected the app password.');
    expect((await approveDraft('j1', ports)).status).toBe('applied');
  });

  it("stops at Gmail's daily cap", async () => {
    const { ports, job } = setup({}, { sentToday: 100, perChannel: 500 });
    await expect(approveDraft('j1', ports)).rejects.toThrow("Gmail's daily cap is reached (100 sends today). Applio sends again tomorrow.");
    expect(job().status).toBe('approved');
    expect(ports.sendEmail).not.toHaveBeenCalled();
  });

  it('stops at the per-channel daily cap from Guardrails', async () => {
    const { ports } = setup({}, { sentToday: 10, perChannel: 10 });
    await expect(approveDraft('j1', ports)).rejects.toThrow("Today's cap for email applications is reached (10). Raise it in Guardrails, or send tomorrow.");
  });

  it("refuses to send before the résumé PDF is saved", async () => {
    const { ports } = setup();
    ports.fileExists = () => false;
    await expect(approveDraft('j1', ports)).rejects.toThrow("The résumé PDF isn't saved yet, so there's nothing to attach. Open the job folder to check it.");
    expect(ports.sendEmail).not.toHaveBeenCalled();
  });
});

describe('approveDraft on other channels', () => {
  it.each(['platform', 'custom', 'ats'] as const)('only approves a %s job; nothing is sent', async (channel) => {
    const { ports, job } = setup({ channel });
    await approveDraft('j1', ports);
    expect(job().status).toBe('approved');
    expect(ports.sendEmail).not.toHaveBeenCalled();
  });
});
