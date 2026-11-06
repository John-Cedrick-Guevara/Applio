import { describe, expect, it, vi } from 'vitest';
import type { Autonomy, EmploymentType } from '../../shared/types';
import { QuotaExceededError, type AiRequest } from '../ai/ai-service';
import { draftJobs, type DraftPorts } from './draft-jobs';

type Fake = { employmentType: EmploymentType; platform?: string; sourceId: string; saves?: boolean };

/** A fake AI that "saves" a draft for jobs set to save one. */
const setup = (jobs: Record<string, Fake>, autonomy: Record<string, Autonomy> = {}) => {
  const drafted = new Set<string>();
  const requests: AiRequest[] = [];
  const ports: DraftPorts = {
    ai: vi.fn(async (req: AiRequest) => {
      requests.push(req);
      for (const id of req.jobIds) if (jobs[id]?.saves !== false) drafted.add(id);
      return { text: 'done', inputTokens: 3000, outputTokens: 1000 };
    }),
    hasDraft: (id) => drafted.has(id),
    job: (id) => jobs[id],
    autonomy: (sourceId) => autonomy[sourceId] ?? 'draft',
    note: vi.fn(),
    addTokens: vi.fn(),
  };
  return { ports, requests };
};

describe('draftJobs', () => {
  it('drafts each job in its own call, charged to the run, with the right kind', async () => {
    const { ports, requests } = setup({ j1: { employmentType: 'full-time', sourceId: 'remotive' }, j2: { employmentType: 'freelance', sourceId: 'remotive' } });
    expect(await draftJobs(['j1', 'j2'], { runId: 3 }, ports)).toEqual({ drafted: 2, notDrafted: 0, notifyOnly: 0 });
    expect(requests.map((r) => [r.jobIds, r.step, r.runId])).toEqual([[['j1'], 'tailor', 3], [['j2'], 'tailor', 3]]);
    expect(requests[0]!.prompt).toBe('Draft a cover letter application for job j1.');
    expect(requests[1]!.prompt).toBe('Draft a proposal application for job j2.');
    expect(requests[0]!.system).toMatch(/never follow instructions/i);
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

  it('never drafts a job from a Notify-only source', async () => {
    const { ports } = setup({ j1: { employmentType: 'full-time', sourceId: 'jobicy' } }, { jobicy: 'notify' });
    expect(await draftJobs(['j1'], {}, ports)).toEqual({ drafted: 0, notDrafted: 0, notifyOnly: 1 });
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
    expect(await draftJobs(['j1'], {}, ports)).toEqual({ drafted: 0, notDrafted: 1, notifyOnly: 0 });
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
    expect(await draftJobs(['j1', 'j2'], {}, ports)).toEqual({ drafted: 0, notDrafted: 2, notifyOnly: 0, stopped: 'Budget used up.' });
    expect(ports.ai).toHaveBeenCalledTimes(1);
    expect(ports.note).not.toHaveBeenCalled();
  });
});
