import { describe, expect, it, vi } from 'vitest';
import type { JobStatus } from '../../shared/types';
import type { Application, IncomingMail } from './replies';
import { trackReplies, type TrackPorts } from './track-replies';

const mail = (over: Partial<IncomingMail> = {}): IncomingMail => ({
  from: 'maria@acme.com', fromName: 'Maria', subject: 'Re: Application', date: '2026-11-21T10:00:00.000Z', references: [], text: 'Thanks, we received it.', ...over,
});

const setup = (status: JobStatus = 'applied') => {
  const applications: Application[] = [{ id: 'j1', company: 'Acme', applyTarget: 'jobs@acme.com', messageIds: [], status }];
  const ports: TrackPorts = { applications: () => applications, ownAddress: 'sam@gmail.com', move: vi.fn(), note: vi.fn() };
  return { ports };
};

describe('trackReplies', () => {
  it('moves a matched application to Replied with the sender and a short summary', () => {
    const { ports } = setup();
    expect(trackReplies([mail()], ports)).toBe(1);
    expect(ports.move).toHaveBeenCalledWith('j1', 'replied', 'Reply from maria@acme.com: Thanks, we received it.', '2026-11-21T10:00:00.000Z');
  });

  it('moves an interview invitation to Interview and a rejection to Rejected', () => {
    const { ports } = setup();
    trackReplies([mail({ text: "Let's schedule an interview." })], ports);
    expect(ports.move).toHaveBeenLastCalledWith('j1', 'interview', expect.stringContaining("Let's schedule an interview."), expect.any(String));
    const second = setup('interview').ports;
    trackReplies([mail({ text: 'Unfortunately we are not moving forward.' })], second);
    expect(second.move).toHaveBeenCalledWith('j1', 'rejected', expect.any(String), expect.any(String));
  });

  it('only notes a reply whose meaning would move the application backwards', () => {
    const { ports } = setup('interview');
    trackReplies([mail({ text: 'Thanks for your time today.' })], ports);
    expect(ports.move).not.toHaveBeenCalled();
    expect(ports.note).toHaveBeenCalledWith('j1', 'Reply from maria@acme.com: Thanks for your time today.', '2026-11-21T10:00:00.000Z');
  });

  it('ignores mail that matches no application, and the operator’s own mail, keeping nothing of it', () => {
    const { ports } = setup();
    expect(trackReplies([mail({ from: 'news@shop.com' }), mail({ from: 'sam@gmail.com' })], ports)).toBe(0);
    expect(ports.move).not.toHaveBeenCalled();
    expect(ports.note).not.toHaveBeenCalled();
  });
});
