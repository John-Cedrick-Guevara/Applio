// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Answer, Fact } from '../../shared/types';
import { openDatabase } from './database';
import { createProfileRepo } from './profile';

const fact = (id: string, group = 'Projects'): Fact => ({ id, group, text: `Did ${id}`, tags: ['ts'], timesUsed: 0 });
const answer = (id: string): Answer => ({ id, question: `Q ${id}?`, answer: `A ${id}`, origin: 'you', timesReused: 2 });

const setup = () => createProfileRepo(openDatabase(':memory:'));

describe('profile repository', () => {
  it('lists facts in the order they were first saved', () => {
    const profile = setup();
    profile.saveFact(fact('f2'));
    profile.saveFact(fact('f1'));
    expect(profile.listFacts().map((f) => f.id)).toEqual(['f2', 'f1']);
  });

  it('updates a saved fact in place, keeping its position', () => {
    const profile = setup();
    profile.saveFact(fact('f1'));
    profile.saveFact(fact('f2'));
    profile.saveFact({ ...fact('f1'), text: 'Rewritten', group: 'Skills' });
    expect(profile.listFacts()).toEqual([{ ...fact('f1'), text: 'Rewritten', group: 'Skills' }, fact('f2')]);
  });

  it('deletes a fact', () => {
    const profile = setup();
    profile.saveFact(fact('f1'));
    profile.deleteFact('f1');
    expect(profile.listFacts()).toEqual([]);
  });

  it('replaces all fact groups in their display order', () => {
    const profile = setup();
    profile.replaceFactGroups([{ name: 'Old' }]);
    profile.replaceFactGroups([{ name: 'B', dates: '2024 – now' }, { name: 'A' }]);
    expect(profile.listFactGroups()).toEqual([{ name: 'B', dates: '2024 – now' }, { name: 'A' }]);
  });

  it('keeps the previous fact groups when a replacement fails part way', () => {
    const profile = setup();
    profile.replaceFactGroups([{ name: 'Keep' }]);
    expect(() => profile.replaceFactGroups([{ name: 'Dup' }, { name: 'Dup' }])).toThrow();
    expect(profile.listFactGroups()).toEqual([{ name: 'Keep' }]);
  });

  it('saves, updates and deletes answers', () => {
    const profile = setup();
    profile.saveAnswer(answer('a1'));
    profile.saveAnswer(answer('a2'));
    profile.saveAnswer({ ...answer('a1'), answer: 'Changed' });
    profile.deleteAnswer('a2');
    expect(profile.listAnswers()).toEqual([{ ...answer('a1'), answer: 'Changed' }]);
  });
});
