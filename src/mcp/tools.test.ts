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
      facts: [
        { id: 'f1', group: 'Acme — Engineer', text: 'Cut API latency 40%', tags: [], timesUsed: 0 },
        { id: 'f2', group: 'Languages', text: 'TypeScript, Python, SQL', tags: [], timesUsed: 0 },
      ],
      factGroups: [{ name: 'Acme — Engineer', kind: 'experience', dates: '2024 – 2026' }, { name: 'Languages', kind: 'skills' }],
      contact: { phone: '+63 900', location: 'Philippines • Open to Remote', links: [{ label: 'Portfolio', url: 'https://x.dev' }], education: 'BS CS', notes: 'Never say internship.' },
      skills: ['TypeScript'],
      preferences: { ...DEFAULT_PREFERENCES, targetRoles: ['Backend Engineer'] },
    }),
    answers: () => [{ id: 'a1', question: 'Notice period?', answer: 'Two weeks', origin: 'you', timesReused: 3 }],
    job: (id) => [inScope, outOfScope].find((j) => j.id === id),
    saveMatch: vi.fn(),
    saveDraft: vi.fn(),
    saveQuestions: vi.fn(),
    logEvent: vi.fn(),
    now: () => NOW,
  };
  const tools = createTools(ports);
  const call = (name: string, input: unknown = {}) => tools.find((t) => t.name === name)!.call(input);
  return { tools, call, ports };
};

const draftInput = {
  jobId: inScope.id, kind: 'cover-letter', headline: 'Backend engineer', summary: 'Ships fast APIs.',
  resume: [{ group: 'Acme — Engineer', items: [{ text: 'Cut API latency 40%', factId: 'f1' }] }],
  coverLetter: 'Dear team…', subject: 'AI Engineer application — Sam Rivera',
  keywords: { claimed: [{ keyword: 'API performance', factId: 'f1' }], gaps: ['Kafka'] }, answers: [{ question: 'Why us?', answer: 'Your API work.' }, { question: 'Notice period?', answerId: 'a1' }],
};

describe('MCP tools', () => {
  it('are exactly the six SPEC §4 tools', () => {
    expect(setup().tools.map((t) => t.name)).toEqual(['get_profile', 'get_jobs', 'save_match', 'save_draft', 'get_answers', 'log_event']);
  });

  it('keep their definitions small', () => {
    const defs = JSON.stringify(setup().tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })));
    // ~1.1k tokens, paid once per call and cached; the draft's keywords, subject and questions form need the room.
    expect(defs.length).toBeLessThan(4500);
  });

  it('return the fact bank with its sections, skills, preferences and the notes for Claude, and nothing else', () => {
    const profile = JSON.parse(setup().call('get_profile')) as Record<string, unknown>;
    expect(Object.keys(profile).sort()).toEqual(['contact', 'facts', 'preferences', 'sections', 'skills']);
    expect(profile.sections).toEqual([{ name: 'Acme — Engineer', kind: 'experience', dates: '2024 – 2026' }, { name: 'Languages', kind: 'skills' }]);
    expect(profile.contact).toEqual({ notes: 'Never say internship.' });
    expect(profile.facts).toEqual([{ id: 'f1', group: 'Acme — Engineer', text: 'Cut API latency 40%' }, { id: 'f2', group: 'Languages', text: 'TypeScript, Python, SQL' }]);
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
    const inflated = { ...draftInput, resume: [{ group: 'Acme — Engineer', items: [{ text: 'Cut API latency 45%', factId: 'f1' }] }] };
    expect(() => call('save_draft', inflated)).toThrow('"Cut API latency 45%" has 45, which fact f1 doesn\'t say. Use its numbers exactly as written.');
    expect(ports.saveDraft).not.toHaveBeenCalled();
  });

  it('reject a draft citing a fact that is not in the bank, naming it', () => {
    const { call, ports } = setup();
    const bad = { ...draftInput, resume: [{ group: 'Acme — Engineer', items: [{ text: 'Led 50 people', factId: 'f999' }] }] };
    expect(() => call('save_draft', bad)).toThrow('These fact IDs are not in the fact bank: f999. Use only facts from get_profile.');
    expect(ports.saveDraft).not.toHaveBeenCalled();
  });

  it('store each section under its fact-bank name, with the subject and keywords', () => {
    const { call, ports } = setup();
    call('save_draft', draftInput);
    const saved = vi.mocked(ports.saveDraft).mock.calls[0]![0] as Draft;
    expect(saved.resume[0]).toEqual({ heading: 'Acme — Engineer', group: 'Acme — Engineer', items: [{ text: 'Cut API latency 40%', factId: 'f1' }] });
    expect(saved).toMatchObject({ subject: 'AI Engineer application — Sam Rivera', keywords: { claimed: [{ keyword: 'API performance', factId: 'f1' }], gaps: ['Kafka'] } });
  });

  it('reject a section that is not in the fact bank, or a line filed under the wrong section', () => {
    const { call } = setup();
    expect(() => call('save_draft', { ...draftInput, resume: [{ group: 'Globex', items: [{ text: 'Cut API latency 40%', factId: 'f1' }] }] })).toThrow('"Globex" is not a section in the fact bank. Use a section name from get_profile.');
    expect(() => call('save_draft', { ...draftInput, resume: [{ group: 'Languages', items: [{ text: 'Cut API latency 40%', factId: 'f1' }] }] })).toThrow('Fact f1 belongs to "Acme — Engineer", not "Languages".');
  });

  it('reject a skill the fact does not list', () => {
    const { call } = setup();
    const skills = { ...draftInput, resume: [...draftInput.resume, { group: 'Languages', items: [{ text: 'TypeScript, Go', factId: 'f2' }] }] };
    expect(() => call('save_draft', skills)).toThrow('"Go" is not in fact f2. List only skills it names.');
  });

  it('reject a cover letter of 250 words or more', () => {
    const { call } = setup();
    expect(() => call('save_draft', { ...draftInput, coverLetter: Array(250).fill('word').join(' ') })).toThrow('The cover letter has 250 words; keep it under 250.');
    expect(call('save_draft', { ...draftInput, coverLetter: Array(249).fill('word').join(' ') })).toBe('Saved.');
  });

  it('reject a claimed keyword whose proof is not in the fact bank', () => {
    const { call } = setup();
    expect(() => call('save_draft', { ...draftInput, keywords: { claimed: [{ keyword: 'Kafka', factId: 'f9' }], gaps: [] } })).toThrow('These fact IDs are not in the fact bank: f9.');
  });

  it('save up to 5 questions for the operator instead of a draft', () => {
    const { call, ports } = setup();
    expect(call('save_draft', { jobId: inScope.id, questions: ['Did OpsMind ship to real users?', 'Can you start in December?'] })).toBe('Asked. The operator answers in Applio, then you draft again.');
    expect(ports.saveQuestions).toHaveBeenCalledWith(inScope.id, ['Did OpsMind ship to real users?', 'Can you start in December?']);
    expect(ports.saveDraft).not.toHaveBeenCalled();
  });

  it('refuse a 6th question, and any question asking for a password, key or token', () => {
    const { call, ports } = setup();
    expect(() => call('save_draft', { jobId: inScope.id, questions: ['1?', '2?', '3?', '4?', '5?', '6?'] })).toThrow();
    expect(() => call('save_draft', { jobId: inScope.id, questions: ['What is your Gmail app password?'] })).toThrow("Applio never asks for passwords, keys or tokens. Ask only about the operator's experience.");
    expect(ports.saveQuestions).not.toHaveBeenCalled();
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
