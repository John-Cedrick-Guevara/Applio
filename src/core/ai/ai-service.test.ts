import { describe, expect, it, vi } from 'vitest';
import { createAi, type AiPorts, type UsageEntry } from './ai-service';
import type { AiEngine } from './engine';

const NOW = new Date(2026, 10, 15, 10, 0);

/** Usage so far today and this month, as the usage table would total them. */
const setup = ({ today = 0, month = 0, paused = false } = {}) => {
  const recorded: UsageEntry[] = [];
  const engine: AiEngine = {
    complete: vi.fn(async () => ({ text: 'ok', inputTokens: 300, outputTokens: 100 })),
    check: async () => ({ ready: true, message: 'Ready' }),
  };
  const ports: AiPorts = {
    engine: () => engine,
    budgets: () => ({ daily: 10_000, monthly: 100_000 }),
    tokensSince: (since) => (since === new Date(2026, 10, 15).toISOString() ? today : month) + recorded.reduce((n, r) => n + r.inputTokens + r.outputTokens, 0),
    record: (entry) => void recorded.push(entry),
    isPaused: () => paused,
    now: () => NOW,
    warn: vi.fn(),
  };
  return { ai: createAi(ports), engine, recorded, ports };
};

const request = { step: 'score' as const, prompt: 'Score these jobs', trigger: 'scheduled' as const };

describe('AI service', () => {
  it('returns the reply and records its tokens against the run, job and step', async () => {
    const { ai, recorded } = setup();
    expect(await ai.run({ ...request, runId: 7, jobId: 'j1' })).toEqual({ text: 'ok', inputTokens: 300, outputTokens: 100 });
    expect(recorded).toEqual([{ at: NOW.toISOString(), step: 'score', inputTokens: 300, outputTokens: 100, runId: 7, jobId: 'j1' }]);
  });

  it('warns once when a call takes today past 80% of the daily budget', async () => {
    const { ai, ports } = setup({ today: 7_900, month: 7_900 });
    await ai.run(request);
    expect(ports.warn).toHaveBeenCalledWith('Claude tokens: 83% of the daily budget used. AI stops at 100%.');
    await ai.run(request);
    expect(ports.warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn below 80%', async () => {
    const { ai, ports } = setup({ today: 7_500, month: 7_500 });
    await ai.run(request);
    expect(ports.warn).not.toHaveBeenCalled();
  });

  it('warns on the monthly budget too', async () => {
    const { ai, ports } = setup({ today: 0, month: 79_900 });
    await ai.run(request);
    expect(ports.warn).toHaveBeenCalledWith('Claude tokens: 80% of the monthly budget used. AI stops at 100%.');
  });

  it('refuses every call once today reaches the daily budget, without contacting the engine', async () => {
    const { ai, engine } = setup({ today: 10_000, month: 10_000 });
    await expect(ai.run({ ...request, trigger: 'operator' })).rejects.toThrow(
      "Today's Claude token budget is used up (10,000 of 10,000). AI resumes tomorrow, or raise the budget in Settings.",
    );
    expect(engine.complete).not.toHaveBeenCalled();
  });

  it('refuses every call once the month reaches the monthly budget', async () => {
    const { ai, engine } = setup({ today: 0, month: 100_000 });
    await expect(ai.run(request)).rejects.toThrow("This month's Claude token budget is used up (100,000 of 100,000). AI resumes next month, or raise the budget in Settings.");
    expect(engine.complete).not.toHaveBeenCalled();
  });

  it('refuses scheduled calls while automation is paused', async () => {
    const { ai, engine } = setup({ paused: true });
    await expect(ai.run(request)).rejects.toThrow('Automation is paused');
    expect(engine.complete).not.toHaveBeenCalled();
  });

  it('still runs a call the operator asked for while paused', async () => {
    const { ai } = setup({ paused: true });
    expect((await ai.run({ ...request, trigger: 'operator' })).text).toBe('ok');
  });

  it('records nothing when the engine fails', async () => {
    const { ai, engine, recorded } = setup();
    vi.mocked(engine.complete).mockRejectedValueOnce(new Error('Claude Code exited with code 1'));
    await expect(ai.run(request)).rejects.toThrow('Claude Code exited with code 1');
    expect(recorded).toEqual([]);
  });
});
