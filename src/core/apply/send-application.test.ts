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
  const files: Record<string, string | Uint8Array> = {};
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
    copyFile: vi.fn(),
    owner: () => ({ name: 'Sam Rivera', email: 'sam@gmail.com' }),
    caps: () => ({ gmailDaily: 100, perChannel: opts.perChannel ?? 10 }),
    dayStart: () => '2026-11-06T00:00:00.000Z',
    now: () => NOW,
    saveAiAnswers: vi.fn(),
    newMessageId: () => '<j1.1@applio.local>',
    bankAnswers: () => [{ question: 'Phone', answer: '+63 917 555 0100' }],
    submitAts: vi.fn(async () => ({ kind: 'submitted' as const, filled: [{ selector: '#email', label: 'Email', action: 'type' as const, value: 'sam@gmail.com' }] })),
  };
  return { ports, outbox, files, log, job: () => job };
};

describe('approveDraft over email', () => {
  it('sends the cover letter as the body with the résumé attached, from Gmail', async () => {
    const { ports, outbox } = setup();
    await approveDraft('j1', ports);
    expect(outbox).toEqual([{
      from: '"Sam Rivera" <sam@gmail.com>', to: 'jobs@acme.com', subject: 'Application: Senior Backend Engineer — Sam Rivera',
      text: 'Dear Acme team,\n\nI build APIs.', attachments: [{ filename: 'Rivera_Senior_Backend_Engineer.pdf', path: '/out/acme/resume.pdf' }], messageId: '<j1.1@applio.local>',
    }]);
  });

  it('leaves an older draft unsigned, since its letter carries its own sign-off', async () => {
    const { ports, outbox } = setup();
    ports.owner = () => ({ name: 'Sam Rivera', email: 'sam@gmail.com', contact: { phone: '+1 555', location: '', links: [], education: '', notes: '' } });
    await approveDraft('j1', ports);
    expect(outbox[0]).toMatchObject({ text: 'Dear Acme team,\n\nI build APIs.' });
  });

  it('uses the subject Claude wrote, and signs off from Profile', async () => {
    const { ports, outbox } = setup();
    const base = ports.draft('j1')!;
    const draft = { ...base, subject: 'AI Engineer — Sam Rivera', resume: base.resume.map((s) => ({ ...s, group: s.heading })) };
    ports.draft = () => draft;
    ports.owner = () => ({ name: 'Sam Rivera', email: 'sam@gmail.com', contact: { phone: '+1 555', location: '', links: [{ label: 'Site', url: 'https://sam.dev' }], education: '', notes: '' } });
    await approveDraft('j1', ports);
    expect(outbox[0]).toMatchObject({ subject: 'AI Engineer — Sam Rivera', text: 'Dear Acme team,\n\nI build APIs.\n\nSam Rivera\n+1 555 | sam.dev' });
  });

  it('quotes the sender name, so a comma in it stays one address', async () => {
    const { ports, outbox } = setup();
    ports.owner = () => ({ name: 'Rivera, Sam', email: 'sam@gmail.com' });
    await approveDraft('j1', ports);
    expect((outbox[0] as { from: string }).from).toBe('"Rivera, Sam" <sam@gmail.com>');
  });

  it('marks the job applied by you and writes sent.md with exactly what went out', async () => {
    const { ports, files, job } = setup();
    expect((await approveDraft('j1', ports)).status).toBe('applied');
    expect(job()).toMatchObject({ status: 'applied', sentBy: 'you-app' });
    const md = files['/out/acme/sent.md'] as string;
    for (const part of ['To: jobs@acme.com', 'Subject: Application: Senior Backend Engineer — Sam Rivera', 'Channel: email', 'Sent: 2026-11-06T09:00:00.000Z', 'Tokens: 5200', 'Attachments: Rivera_Senior_Backend_Engineer.pdf', 'Dear Acme team,\n\nI build APIs.']) {
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
  it.each(['platform', 'custom'] as const)('only approves a %s job; nothing is sent', async (channel) => {
    const { ports, job } = setup({ channel });
    await approveDraft('j1', ports);
    expect(job().status).toBe('approved');
    expect(ports.sendEmail).not.toHaveBeenCalled();
  });
});

describe('approveDraft on a standard ATS form', () => {
  const ats = (over: Partial<Job> = {}) => setup({ channel: 'ats', applyTarget: 'jobs.lever.co', applyUrl: 'https://jobs.lever.co/acme/123', ...over });

  it("fills and submits the form with the résumé, letter, profile and answers, then logs exactly what was filled", async () => {
    const { ports, files, job } = ats();
    expect((await approveDraft('j1', ports)).status).toBe('applied');
    expect(ports.submitAts).toHaveBeenCalledWith({
      url: 'https://jobs.lever.co/acme/123/apply',
      input: {
        applicant: { fullName: 'Sam Rivera', email: 'sam@gmail.com' },
        files: { resume: '/out/acme/Rivera_Senior_Backend_Engineer.pdf', coverLetter: '/out/acme/Rivera_Senior_Backend_Engineer_Cover_Letter.pdf' },
        letter: 'Dear Acme team,\n\nI build APIs.',
        answers: [{ question: 'Why us?', answer: 'Your API work.' }, { question: 'Notice?', answer: 'Two weeks' }, { question: 'Phone', answer: '+63 917 555 0100' }],
      },
      visible: true,
    });
    // Uploaded under the operator's file names, copied from the files Applio keeps.
    expect(ports.copyFile).toHaveBeenCalledWith('/out/acme/resume.pdf', '/out/acme/Rivera_Senior_Backend_Engineer.pdf');
    expect(job()).toMatchObject({ status: 'applied', sentBy: 'you-app' });
    expect(files['/out/acme/sent.md']).toContain('Email: sam@gmail.com');
    expect(files['/out/acme/sent.md']).toContain('To: https://jobs.lever.co/acme/123/apply');
  });

  it('saves a screenshot of the confirmation page in the job folder', async () => {
    const { ports, files } = ats();
    vi.mocked(ports.submitAts).mockResolvedValueOnce({ kind: 'submitted', filled: [], screenshot: new Uint8Array([137, 80, 78, 71]) });
    await approveDraft('j1', ports);
    expect(files['/out/acme/confirmation.png']).toEqual(new Uint8Array([137, 80, 78, 71]));
  });

  it('hands the form over when it asks something Applio has no answer for, and can be approved again later', async () => {
    const { ports, job, log } = ats();
    vi.mocked(ports.submitAts).mockResolvedValueOnce({ kind: 'handoff', reason: 'It asks things Applio has no saved answer for: Current company.' });
    await expect(approveDraft('j1', ports)).rejects.toThrow('Applio filled what it could. Finish the form in its window, then use Mark as applied. It asks things Applio has no saved answer for: Current company.');
    expect(job().status).toBe('approved');
    expect(log.has('j1')).toBe(false);
  });

  it("keeps the claim when Submit was pressed but not confirmed, so it's never submitted twice", async () => {
    const { ports, log } = ats();
    vi.mocked(ports.submitAts).mockResolvedValueOnce({ kind: 'unconfirmed', filled: [] });
    await expect(approveDraft('j1', ports)).rejects.toThrow("Applio pressed Submit but couldn't confirm it went through.");
    expect(log.get('j1')?.state).toBe('sending');
    await expect(approveDraft('j1', ports)).rejects.toThrow(/didn't finish/);
    expect(ports.submitAts).toHaveBeenCalledTimes(1);
  });

  it('stops at the per-channel cap for ATS forms', async () => {
    const { ports } = setup({ channel: 'ats', applyUrl: 'https://jobs.lever.co/acme/123' }, { sentToday: 10, perChannel: 10 });
    await expect(approveDraft('j1', ports)).rejects.toThrow("Today's cap for ATS applications is reached (10). Raise it in Guardrails, or send tomorrow.");
    expect(ports.submitAts).not.toHaveBeenCalled();
  });
});
