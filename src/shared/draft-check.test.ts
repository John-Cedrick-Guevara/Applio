import { describe, expect, it } from 'vitest';
import { checkDraft, forbiddenTerms, profileVersion, type CheckSources } from './draft-check';

const facts = [
  { id: 'f1', group: 'Afterhours PH — AI Developer', text: 'Built LLM agents that cut support replies 40%' },
  { id: 'f2', group: 'Projects', text: 'Shipped a TypeScript MCP server' },
];
const sources: CheckSources = {
  facts, groups: [{ name: 'Afterhours PH — AI Developer' }], contact: { location: 'Philippines • Open to Remote', education: 'BS Computer Science', notes: '' },
  owner: 'John Guevara', job: { company: 'Quillstack', title: 'Junior AI Engineer', description: 'We build agents in TypeScript and Python.' },
};

describe('checkDraft', () => {
  it('passes a letter whose names and numbers all come from the facts, profile or posting', () => {
    const letter = 'Hi Quillstack team,\n\nAt Afterhours PH I built LLM agents that cut support replies 40%. I also shipped a TypeScript MCP server.\n\nJohn Guevara';
    expect(checkDraft({ coverLetter: letter, resume: [] }, sources)).toEqual({ unverified: [], forbidden: [] });
  });

  it('flags a place and a degree that appear in no fact (QA 2026-11-07 #10)', () => {
    const letter = 'I am based in Marikina City. I hold a PhD and cut costs 70%.';
    expect(checkDraft({ coverLetter: letter, resume: [] }, sources).unverified).toEqual([
      { line: 'I am based in Marikina City.', terms: ['Marikina', 'City'] },
      { line: 'I hold a PhD and cut costs 70%.', terms: ['PhD', '70%'] },
    ]);
  });

  it("accepts a section's dates and the operator's own phone and email in the sign-off", () => {
    const withMore = { ...sources, owner: 'John Guevara john0610@gmail.com', groups: [{ name: 'Afterhours PH — AI Developer', dates: 'June 2026 – October 2026' }], contact: { ...sources.contact, phone: '+63 954 115 2016' } };
    expect(checkDraft({ coverLetter: 'At Afterhours PH (June 2026 – October 2026) I built LLM agents.\njohn0610@gmail.com · +63 954 115 2016', resume: [] }, withMore).unverified).toEqual([]);
  });

  it('ignores greetings, sign-offs, months and days, which are not claims', () => {
    expect(checkDraft({ coverLetter: 'Dear Hiring Team,\nI can start Monday, December 1.\nBest regards,', resume: [] }, sources).unverified).toEqual([]);
  });

  it("flags a term the operator's notes forbid, and its shorter form", () => {
    const withNotes = { ...sources, contact: { ...sources.contact, notes: "Never use 'Internship' for the Afterhours role." } };
    const draft = { coverLetter: 'I was an AI Developer intern at Afterhours PH.', resume: [{ items: [{ text: 'Internship: built agents' }] }] };
    expect(checkDraft(draft, withNotes).forbidden).toEqual(['intern', 'internship']);
  });
});

describe('forbiddenTerms', () => {
  it('reads simple "never use X" rules from notes, quoted or not', () => {
    expect(forbiddenTerms("Never use 'Internship'.\nDon't say \"rockstar\". Do not use ninja. Keep it short.")).toEqual(['internship', 'rockstar', 'ninja']);
  });
});

describe('profileVersion', () => {
  it('changes when a fact, a section or the notes change, and not otherwise', () => {
    const base = profileVersion(sources);
    expect(profileVersion({ ...sources })).toBe(base);
    expect(profileVersion({ ...sources, facts: [{ ...facts[0]!, text: 'Cut replies 30%' }, facts[1]!] })).not.toBe(base);
    expect(profileVersion({ ...sources, contact: { ...sources.contact, notes: 'Never say intern' } })).not.toBe(base);
  });
});
