import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES } from '../shared/defaults';
import { seedJobs } from '../shared/mock/fixtures';
import type { Draft, Job } from '../shared/types';
import { createTools, type ToolPorts } from './tools';

const NOW = new Date('2026-11-06T09:00:00.000Z');
const [inScope, outOfScope] = seedJobs(NOW) as [Job, Job, ...Job[]];

const setup = () => {
  const ports: ToolPorts = {
    scope: new Set([inScope.id]),
    profile: () => ({
      facts: [{ id: 'f1', group: 'Acme — Engineer', text: 'Cut API latency 40%', tags: [], timesUsed: 0 }],
      skills: ['TypeScript'],
      preferences: { ...DEFAULT_PREFERENCES, targetRoles: ['Backend Engineer'] },
    }),
    answers: () => [{ id: 'a1', question: 'Notice period?', answer: 'Two weeks', origin: 'you', timesReused: 3 }],
    job: (id) => [inScope, outOfScope].find((j) => j.id === id),
    saveMatch: vi.fn(),
    saveDraft: vi.fn(),
    logEvent: vi.fn(),
    now: () => NOW,
  };
  const tools = createTools(ports);
  const call = (name: string, input: unknown = {}) => tools.find((t) => t.name === name)!.call(input);
  return { tools, call, ports };
};

const draftInput = {
  jobId: inScope.id, kind: 'cover-letter', headline: 'Backend engineer', summary: 'Ships fast APIs.',
  resume: [{ heading: 'Acme', items: [{ text: 'Cut API latency 40%', factId: 'f1' }] }],
  coverLetter: 'Dear team…', answers: [{ question: 'Why us?', answer: 'Your API work.' }, { question: 'Notice period?', answerId: 'a1' }],
};

describe('MCP tools', () => {
  it('are exactly the six SPEC §4 tools', () => {
    expect(setup().tools.map((t) => t.name)).toEqual(['get_profile', 'get_jobs', 'save_match', 'save_draft', 'get_answers', 'log_event']);
  });

  it('keep their definitions small', () => {
    const defs = JSON.stringify(setup().tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })));
    expect(defs.length).toBeLessThan(4000); // ~1k tokens
  });

  it('return the fact bank, skills and preferences, and nothing else', () => {
    const profile = JSON.parse(setup().call('get_profile')) as Record<string, unknown>;
    expect(Object.keys(profile).sort()).toEqual(['facts', 'preferences', 'skills']);
    expect(profile.facts).toEqual([{ id: 'f1', group: 'Acme — Engineer', text: 'Cut API latency 40%' }]);
  });

  it('return only the jobs of this task', () => {
    const jobs = JSON.parse(setup().call('get_jobs')) as { id: string }[];
    expect(jobs.map((j) => j.id)).toEqual([inScope.id]);
    expect(jobs[0]).toMatchObject({ company: inScope.company, title: inScope.title, description: inScope.description });
  });

  it('return the answer bank', () => {
    expect(JSON.parse(setup().call('get_answers'))).toEqual([{ id: 'a1', question: 'Notice period?', answer: 'Two weeks' }]);
  });

  it('save a match for a job in scope', () => {
    const { call, ports } = setup();
    const match = { jobId: inScope.id, score: 82, roleSummary: 'Backend APIs', descriptionSummary: 'Remote, Node', strengths: [{ text: 'Low-latency APIs', factId: 'f1' }], gaps: ['Go'] };
    expect(call('save_match', match)).toBe('Saved.');
    expect(ports.saveMatch).toHaveBeenCalledWith(inScope.id, { score: 82, roleSummary: 'Backend APIs', descriptionSummary: 'Remote, Node', strengths: ['Low-latency APIs'], gaps: ['Go'] });
  });

  it('reject a strength citing a fact that is not in the bank', () => {
    const { call, ports } = setup();
    const match = { jobId: inScope.id, score: 82, roleSummary: 'r', descriptionSummary: 'd', strengths: [{ text: 'Led 50 people', factId: 'f9' }], gaps: [] };
    expect(() => call('save_match', match)).toThrow('These fact IDs are not in the fact bank: f9. Use only facts from get_profile.');
    expect(ports.saveMatch).not.toHaveBeenCalled();
  });

  it.each([
    ['a score above 100', { score: 101 }, 'score'],
    ['a fractional score', { score: 81.5 }, 'score'],
    ['a missing summary', { roleSummary: undefined }, 'roleSummary'],
    ['an unknown key', { extra: 'x' }, 'extra'],
  ])('reject %s with a readable error', (_label, change, field) => {
    const { call, ports } = setup();
    const base = { jobId: inScope.id, score: 82, roleSummary: 'r', descriptionSummary: 'd', strengths: [], gaps: [] };
    expect(() => call('save_match', { ...base, ...change })).toThrow(new RegExp(`Invalid input.*${field}`));
    expect(ports.saveMatch).not.toHaveBeenCalled();
  });

  it('refuse to write to a job outside this task', () => {
    const { call, ports } = setup();
    expect(() => call('log_event', { jobId: outOfScope.id, message: 'hi' })).toThrow(`Job ${outOfScope.id} isn't part of this task.`);
    expect(ports.logEvent).not.toHaveBeenCalled();
  });

  it('save a draft whose bullets all cite real facts', () => {
    const { call, ports } = setup();
    expect(call('save_draft', draftInput)).toBe('Saved.');
    const [saved, reused] = vi.mocked(ports.saveDraft).mock.calls[0]! as [Draft, string[]];
    expect(saved).toMatchObject({ jobId: inScope.id, edited: false, createdAt: NOW.toISOString() });
    expect(reused).toEqual(['a1']);
  });

  it("store a bank answer with the bank's own text and no tokens, and mark a new one as AI-written", () => {
    const { call, ports } = setup();
    call('save_draft', draftInput);
    expect((vi.mocked(ports.saveDraft).mock.calls[0]![0] as Draft).answers).toEqual([
      { question: 'Why us?', answer: 'Your API work.', origin: 'ai', tokens: 0 },
      { question: 'Notice period?', answer: 'Two weeks', origin: 'bank', tokens: 0 },
    ]);
  });

  it('reject an answer id that is not in the answer bank', () => {
    const { call } = setup();
    expect(() => call('save_draft', { ...draftInput, answers: [{ question: 'Salary?', answerId: 'a9' }] })).toThrow('Answer a9 is not in the answer bank. Use get_answers, or write a new answer.');
  });

  it('reject a line whose number is not in the fact it cites, so metrics stay exactly as written', () => {
    const { call, ports } = setup();
    const inflated = { ...draftInput, resume: [{ heading: 'Acme', items: [{ text: 'Cut API latency 45%', factId: 'f1' }] }] };
    expect(() => call('save_draft', inflated)).toThrow('"Cut API latency 45%" has 45, which fact f1 doesn\'t say. Use its numbers exactly as written.');
    expect(ports.saveDraft).not.toHaveBeenCalled();
  });

  it('reject a draft citing a fact that is not in the bank, naming it', () => {
    const { call, ports } = setup();
    const bad = { ...draftInput, resume: [{ heading: 'Acme', items: [{ text: 'Led 50 people', factId: 'f999' }] }] };
    expect(() => call('save_draft', bad)).toThrow('These fact IDs are not in the fact bank: f999. Use only facts from get_profile.');
    expect(ports.saveDraft).not.toHaveBeenCalled();
  });

  it('log a note on a job', () => {
    const { call, ports } = setup();
    call('log_event', { jobId: inScope.id, message: 'Posting asks for a portfolio link' });
    expect(ports.logEvent).toHaveBeenCalledWith(inScope.id, 'Posting asks for a portfolio link');
  });

  it("sets the draft's kind by Applio's rule, not by what Claude sent", () => {
    const { call, ports } = setup();
    const freelance = { ...inScope, employmentType: 'freelance' as const };
    ports.job = (id) => (id === inScope.id ? freelance : undefined);
    call('save_draft', { ...draftInput, kind: 'cover-letter' });
    expect((vi.mocked(ports.saveDraft).mock.calls[0]![0] as Draft).kind).toBe('proposal');
  });

  it('sends postings without their boilerplate, as scoring does', () => {
    const { call, ports } = setup();
    ports.job = (id) => (id === inScope.id ? { ...inScope, description: 'The role\nBuild APIs.\nWhat we offer\n- Free lunch' } : undefined);
    const [job] = JSON.parse(call('get_jobs')) as { description: string }[];
    expect(job!.description).toBe('The role\nBuild APIs.');
  });
});
