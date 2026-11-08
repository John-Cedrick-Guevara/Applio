import { describe, expect, it, vi } from 'vitest';
import type { InterviewPrep } from '../../shared/types';
import { interviewPrep, type PrepPorts } from './interview-prep';

const reply = (text: string) => ({ text, inputTokens: 1500, outputTokens: 500 });
const setup = (text = '{"told":["Cut latency 40%"],"likelyQuestions":["How did you cut latency?"],"askThem":["What breaks most?"]}') => {
  let saved: InterviewPrep | undefined;
  const ports: PrepPorts = {
    cached: () => saved,
    save: (_id, prep) => void (saved = prep),
    sent: () => ({ letter: 'Dear team, I cut latency 40%.', resume: ['Cut API latency 40%'] }),
    ai: vi.fn(async () => reply(text)),
  };
  return { ports };
};

describe('interviewPrep', () => {
  it('asks Claude, as the operator, with what was sent, and saves the result with its cost', async () => {
    const { ports } = setup();
    expect(await interviewPrep('j1', ports)).toEqual({ told: ['Cut latency 40%'], likelyQuestions: ['How did you cut latency?'], askThem: ['What breaks most?'], tokens: 2000 });
    const req = vi.mocked(ports.ai).mock.calls[0]![0];
    expect(req).toMatchObject({ step: 'prep', jobIds: ['j1'] });
    expect(req.prompt).toContain('Dear team, I cut latency 40%.');
  });

  it('reuses the saved prep on reopen without another AI call', async () => {
    const { ports } = setup();
    await interviewPrep('j1', ports);
    await interviewPrep('j1', ports);
    expect(ports.ai).toHaveBeenCalledTimes(1);
  });

  it('reads the JSON even when Claude wraps it in prose', async () => {
    const { ports } = setup('Here you go:\n```json\n{"told":[],"likelyQuestions":["Q"],"askThem":[]}\n```');
    expect((await interviewPrep('j1', ports)).likelyQuestions).toEqual(['Q']);
  });

  it('saves nothing and says so when the answer cannot be read', async () => {
    const { ports } = setup('I could not help with that.');
    await expect(interviewPrep('j1', ports)).rejects.toThrow("Claude's prep couldn't be read. Try again.");
    expect(ports.cached('j1')).toBeUndefined();
  });
});
