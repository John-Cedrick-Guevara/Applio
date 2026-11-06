import { describe, expect, it, vi } from 'vitest';
import { seedJobs } from '../../shared/mock/fixtures';
import type { Job } from '../../shared/types';
import { sendFollowUp, type FollowUpPorts } from './follow-up';

const NOW = new Date('2026-11-20T09:00:00.000Z');

const setup = (over: Partial<Job> = {}) => {
  let job: Job = { ...(seedJobs(NOW)[0] as Job), id: 'j1', status: 'applied', channel: 'email', applyTarget: 'jobs@acme.com', folderPath: '/out/acme', ...over };
  const appended: Record<string, string> = {};
  const ports: FollowUpPorts = {
    job: () => job,
    sent: () => ({ subject: 'Application: Engineer — Sam Rivera', messageId: '<j1.1@applio.local>' }),
    sendEmail: vi.fn(async () => {}),
    owner: () => ({ name: 'Sam Rivera', email: 'sam@gmail.com' }),
    folder: () => job.folderPath,
    appendFile: (path, text) => void (appended[path] = (appended[path] ?? '') + text),
    logFollowUp: () => {
      job = { ...job, history: [...job.history, { status: 'applied', at: NOW.toISOString(), note: 'Follow-up sent' }] };
      return job;
    },
    newMessageId: () => '<j1.2@applio.local>',
    now: () => NOW,
  };
  return { ports, appended, job: () => job };
};

describe('sendFollowUp', () => {
  it('replies in the same thread to the address the application went to', async () => {
    const { ports } = setup();
    await sendFollowUp('j1', 'Hi again, still keen.', ports);
    expect(ports.sendEmail).toHaveBeenCalledWith({
      from: '"Sam Rivera" <sam@gmail.com>', to: 'jobs@acme.com', subject: 'Re: Application: Engineer — Sam Rivera', text: 'Hi again, still keen.',
      attachments: [], messageId: '<j1.2@applio.local>', inReplyTo: '<j1.1@applio.local>', references: '<j1.1@applio.local>',
    });
  });

  it('restarts the follow-up window and logs exactly what was sent', async () => {
    const { ports, appended, job } = setup();
    await sendFollowUp('j1', 'Hi again, still keen.', ports);
    expect(job().history.at(-1)).toMatchObject({ status: 'applied', note: 'Follow-up sent' });
    expect(appended['/out/acme/follow-ups.md']).toBe('\n## 2026-11-20T09:00:00.000Z\nTo: jobs@acme.com\nSubject: Re: Application: Engineer — Sam Rivera\n\nHi again, still keen.\n');
  });

  it('refuses an application that did not go by email, since there is no one to write to', async () => {
    const { ports } = setup({ channel: 'ats', applyTarget: 'jobs.lever.co' });
    await expect(sendFollowUp('j1', 'Hi', ports)).rejects.toThrow('This application went through a form, so there is no email address to follow up with.');
    expect(ports.sendEmail).not.toHaveBeenCalled();
  });

  it('only follows up on applications still waiting on a reply, and only with text', async () => {
    await expect(sendFollowUp('j1', 'Hi', setup({ status: 'interview' }).ports)).rejects.toThrow('Follow-ups go only to applications still waiting on a reply');
    await expect(sendFollowUp('j1', '   ', setup().ports)).rejects.toThrow('Write the follow-up first');
  });

  it('logs nothing when Gmail refuses', async () => {
    const { ports, appended, job } = setup();
    vi.mocked(ports.sendEmail).mockRejectedValueOnce(new Error("Couldn't reach Gmail."));
    await expect(sendFollowUp('j1', 'Hi', ports)).rejects.toThrow("Couldn't reach Gmail.");
    expect(appended).toEqual({});
    expect(job().history.at(-1)?.note).not.toBe('Follow-up sent');
  });
});
