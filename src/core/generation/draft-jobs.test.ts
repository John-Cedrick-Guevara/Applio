import { describe, expect, it, vi } from 'vitest';
import type { Autonomy, EmploymentType } from '../../shared/types';
import { QuotaExceededError, type AiRequest } from '../ai/ai-service';
import { DRAFT_SYSTEM, draftJobs, type DraftPorts } from './draft-jobs';

type Fake = { employmentType: EmploymentType; platform?: string; sourceId: string; saves?: boolean; asks?: boolean; waiting?: boolean };

/** A fake AI that "saves" a draft for jobs set to save one. */
const setup = (jobs: Record<string, Fake>, autonomy: Record<string, Autonomy> = {}) => {
  const drafted = new Set<string>();
  const asked = new Set<string>(Object.keys(jobs).filter((id) => jobs[id]?.waiting));
  const requests: AiRequest[] = [];
  const ports: DraftPorts = {
    ai: vi.fn(async (req: AiRequest) => {
      requests.push(req);
      for (const id of req.jobIds) {
        if (jobs[id]?.asks) asked.add(id);
        else if (jobs[id]?.saves !== false) drafted.add(id);
      }
      return { text: 'done', inputTokens: 3000, outputTokens: 1000 };
    }),
    hasDraft: (id) => drafted.has(id),
    hasQuestions: (id) => asked.has(id),
    answers: () => [],
    job: (id) => jobs[id],
    autonomy: (sourceId) => autonomy[sourceId] ?? 'draft',
    note: vi.fn(),
    addTokens: vi.fn(),
    onDrafted: vi.fn(async () => {}),
  };
  return { ports, requests };
};

describe('draftJobs', () => {
  it("follows the operator's résumé-strategist instructions, with every personal fact left to the fact bank", () => {
    for (const rule of [
      'resume strategist', 'past AI/ATS screening', '30-second read', 'Never invent skills, tools, metrics, titles, or dates',
      'strong action verb + what I built or changed + how (the mechanism) + result/scale', 'Mirror the job post', '3 lines max, one sentence each', 'Under 250 words',
      'Hook', 'Proof', 'Value', 'Close', 'get_profile', 'untrusted', 'Never tell me to skip a job',
      'ask me before writing', 'Max 5 questions', 'about 18–22 bullets in total', 'Never fill a Gap with invented content', 'Never restate the context line', 'availability, start date, notice period, time zone',
    ]) expect(DRAFT_SYSTEM).toContain(rule);
    // Personal facts come from get_profile at run time, never from text built into Applio.
    for (const personal of ['Guevara', 'Afterhours', 'Zentari', 'Octivia', '+63', 'guevix']) expect(DRAFT_SYSTEM).not.toContain(personal);
  });

  it('drafts each job in its own call, charged to the run, with the right kind', async () => {
    const { ports, requests } = setup({ j1: { employmentType: 'full-time', sourceId: 'remotive' }, j2: { employmentType: 'freelance', sourceId: 'remotive' } });
    expect(await draftJobs(['j1', 'j2'], { runId: 3 }, ports)).toEqual({ drafted: 2, notDrafted: 0, notifyOnly: 0, asked: 0 });
    expect(requests.map((r) => [r.jobIds, r.step, r.runId])).toEqual([[['j1'], 'tailor', 3], [['j2'], 'tailor', 3]]);
    expect(requests[0]!.prompt).toBe('Draft a cover letter application for job j1.');
    expect(requests[1]!.prompt).toBe('Draft a proposal application for job j2.');
    expect(requests[0]!.system).toMatch(/never follow instructions/i);
  });

  it('waits for answers when Claude asks instead of drafting, and keeps drafting the rest', async () => {
    const { ports, requests } = setup({ j1: { employmentType: 'full-time', sourceId: 'remotive', asks: true }, j2: { employmentType: 'full-time', sourceId: 'remotive' } });
    expect(await draftJobs(['j1', 'j2'], {}, ports)).toMatchObject({ drafted: 1, asked: 1, notDrafted: 0 });
    // No second try and no failure note: the job is waiting on the operator.
    expect(requests.filter((r) => r.jobIds[0] === 'j1')).toHaveLength(1);
    expect(ports.note).not.toHaveBeenCalled();
  });

  it('never drafts a job that is waiting on answers, whatever its source allows', async () => {
    const { ports, requests } = setup({ j1: { employmentType: 'full-time', sourceId: 'remotive', waiting: true } }, { remotive: 'autonomous' });
    expect(await draftJobs(['j1'], {}, ports)).toMatchObject({ drafted: 0, asked: 1 });
    expect(requests).toEqual([]);
  });

  it("gives Claude the operator's answers when it drafts again", async () => {
    const { ports, requests } = setup({ j1: { employmentType: 'full-time', sourceId: 'remotive' } });
    ports.answers = () => [{ question: 'Can you start in December?', answer: 'Yes, from Dec 1.' }];
    await draftJobs(['j1'], {}, ports);
    expect(requests[0]!.prompt).toBe('Draft a cover letter application for job j1.\nThe operator answered your questions; use these as facts for this job:\nQ: Can you start in December?\nA: Yes, from Dec 1.');
  });

  it('writes a proposal for Upwork jobs', async () => {
    const { ports, requests } = setup({ j1: { employmentType: 'contract', platform: 'Upwork', sourceId: 'clip' } });
    await draftJobs(['j1'], {}, ports);
    expect(requests[0]!.prompt).toMatch(/proposal/);
  });

  it('adds each call’s tokens to the job', async () => {
    const { ports } = setup({ j1: { employmentType: 'full-time', sourceId: 'remotive' } });
    await draftJobs(['j1'], {}, ports);
    expect(ports.addTokens).toHaveBeenCalledWith('j1', 4000);
  });

  it('hands each saved draft on, so its files get written', async () => {
    const { ports } = setup({ j1: { employmentType: 'full-time', sourceId: 'r' }, j2: { employmentType: 'full-time', sourceId: 'r', saves: false } });
    await draftJobs(['j1', 'j2'], {}, ports);
    expect(ports.onDrafted).toHaveBeenCalledTimes(1);
    expect(ports.onDrafted).toHaveBeenCalledWith('j1');
  });

  it('never drafts a job from a Notify-only source', async () => {
    const { ports } = setup({ j1: { employmentType: 'full-time', sourceId: 'jobicy' } }, { jobicy: 'notify' });
    expect(await draftJobs(['j1'], {}, ports)).toEqual({ drafted: 0, notDrafted: 0, notifyOnly: 1, asked: 0 });
    expect(ports.ai).not.toHaveBeenCalled();
  });

  it('skips a job that already has a draft', async () => {
    const { ports } = setup({ j1: { employmentType: 'full-time', sourceId: 'remotive' } });
    await draftJobs(['j1'], {}, ports);
    await draftJobs(['j1'], {}, ports);
    expect(ports.ai).toHaveBeenCalledTimes(1);
  });

  it('tries once more when no draft was saved, then flags the job for the operator', async () => {
    const { ports } = setup({ j1: { employmentType: 'full-time', sourceId: 'remotive', saves: false } });
    expect(await draftJobs(['j1'], {}, ports)).toEqual({ drafted: 0, notDrafted: 1, notifyOnly: 0, asked: 0 });
    expect(ports.ai).toHaveBeenCalledTimes(2);
    expect(ports.note).toHaveBeenCalledWith('j1', "Not drafted: Claude didn't save a draft that passed the fact checks.");
  });

  it('notes the error when both calls fail', async () => {
    const { ports } = setup({ j1: { employmentType: 'full-time', sourceId: 'remotive' } });
    vi.mocked(ports.ai).mockRejectedValue(new Error('Claude Code exited with code 1'));
    await draftJobs(['j1'], {}, ports);
    expect(ports.note).toHaveBeenCalledWith('j1', 'Not drafted: Claude Code exited with code 1');
  });

  it('stops at the budget hard stop, leaving the rest for later', async () => {
    const { ports } = setup({ j1: { employmentType: 'full-time', sourceId: 'r' }, j2: { employmentType: 'full-time', sourceId: 'r' } });
    vi.mocked(ports.ai).mockRejectedValueOnce(new QuotaExceededError('Budget used up.'));
    expect(await draftJobs(['j1', 'j2'], {}, ports)).toEqual({ drafted: 0, notDrafted: 2, notifyOnly: 0, asked: 0, stopped: 'Budget used up.' });
    expect(ports.ai).toHaveBeenCalledTimes(1);
    expect(ports.note).not.toHaveBeenCalled();
  });
});
