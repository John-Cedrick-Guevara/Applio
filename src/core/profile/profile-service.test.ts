import { describe, expect, it } from 'vitest';
import type { Answer, Fact, FactGroup } from '../../shared/types';
import { createProfileService, type ProfilePorts } from './profile-service';

/** In-memory ports — the SQLite repositories have their own tests. */
const setup = () => {
  const kv = new Map<string, unknown>();
  let facts: Fact[] = [];
  let groups: FactGroup[] = [];
  let answers: Answer[] = [];
  let n = 0;
  const upsert = <T extends { id: string }>(list: T[], item: T) =>
    list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
  const ports: ProfilePorts = {
    kv: { get: (k) => structuredClone(kv.get(k)), set: (k, v) => void kv.set(k, structuredClone(v)) },
    store: {
      listFacts: () => structuredClone(facts),
      saveFact: (f) => void (facts = upsert(facts, f)),
      deleteFact: (id) => void (facts = facts.filter((f) => f.id !== id)),
      listFactGroups: () => structuredClone(groups),
      replaceFactGroups: (g) => void (groups = [...g]),
      listAnswers: () => structuredClone(answers),
      saveAnswer: (a) => void (answers = upsert(answers, a)),
      deleteAnswer: (id) => void (answers = answers.filter((a) => a.id !== id)),
    },
    newId: () => `id${++n}`,
    now: () => new Date('2026-11-04T09:00:00.000Z'),
  };
  return createProfileService(ports);
};

describe('profile service', () => {
  it('starts empty with default preferences', () => {
    expect(setup().getProfile()).toEqual({
      facts: [], factGroups: [], skills: [], answers: [],
      preferences: { targetRoles: [], seniority: '', employmentTypes: ['full-time', 'contract', 'freelance'], remoteOnly: true, hoursOverlap: '', minimumPay: '' },
    });
  });

  it('adds a new fact with a fresh id, and lists its group', () => {
    const profile = setup();
    const fact = profile.saveFact({ group: 'Projects', text: '  Built X  ' });
    expect(fact).toEqual({ id: 'id1', group: 'Projects', text: 'Built X', tags: [], timesUsed: 0 });
    expect(profile.getProfile().factGroups).toEqual([{ name: 'Projects' }]);
  });

  it('edits a fact in place, keeping its tags and usage count', () => {
    const profile = setup();
    const { id } = profile.saveFact({ group: 'Projects', text: 'Built X' });
    expect(profile.saveFact({ id, group: 'Projects', text: 'Built Y' })).toMatchObject({ id, text: 'Built Y', timesUsed: 0 });
    expect(profile.getProfile().facts).toHaveLength(1);
  });

  it('refuses an empty fact and an edit to a fact that is gone', () => {
    const profile = setup();
    expect(() => profile.saveFact({ group: 'Projects', text: '  ' })).toThrow('Write the fact first');
    expect(() => profile.saveFact({ id: 'gone', group: 'Projects', text: 'X' })).toThrow('That fact was deleted');
  });

  it('deletes a fact', () => {
    const profile = setup();
    const { id } = profile.saveFact({ group: 'Projects', text: 'Built X' });
    profile.deleteFact(id);
    expect(profile.getProfile().facts).toEqual([]);
  });

  it('adds, edits and deletes answers, and refuses half-filled ones', () => {
    const profile = setup();
    const a = profile.saveAnswer({ question: 'Notice period', answer: '2 weeks' });
    expect(a).toEqual({ id: 'id1', question: 'Notice period', answer: '2 weeks', origin: 'you', timesReused: 0 });
    profile.saveAnswer({ id: a.id, question: 'Notice period', answer: '1 month' });
    expect(profile.getProfile().answers).toEqual([{ ...a, answer: '1 month' }]);
    expect(() => profile.saveAnswer({ question: 'Q', answer: ' ' })).toThrow('Fill in both the question and the answer');
    profile.deleteAnswer(a.id);
    expect(profile.getProfile().answers).toEqual([]);
  });

  it('saves preferences', () => {
    const profile = setup();
    const prefs = { targetRoles: ['Backend'], seniority: 'Senior', employmentTypes: ['contract' as const], remoteOnly: true, hoursOverlap: '4h', minimumPay: '$90k' };
    profile.savePreferences(prefs);
    expect(profile.getProfile().preferences).toEqual(prefs);
  });

  it('records an imported résumé and suggests its facts without adding any', () => {
    const profile = setup();
    profile.saveFact({ group: 'Acme', text: 'Led on-call.' });
    const result = profile.recordResume('resume.pdf', 'Acme\n- Led on-call.\n- Cut costs by 30%.');
    expect(result).toEqual({
      resume: { fileName: 'resume.pdf', uploadedAt: '2026-11-04T09:00:00.000Z', factsFound: 1 },
      suggestions: [{ group: 'Acme', text: 'Cut costs by 30%.' }],
    });
    expect(profile.getProfile().facts).toHaveLength(1);
    expect(profile.getProfile().referenceResume).toEqual(result.resume);
  });
});
