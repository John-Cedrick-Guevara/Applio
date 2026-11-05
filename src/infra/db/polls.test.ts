// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { openDatabase } from './database';
import { createPollsRepo } from './polls';

describe('polls repository', () => {
  it('counts polls per source per day', () => {
    const polls = createPollsRepo(openDatabase(':memory:'));
    polls.record('remotive', '2026-11-05');
    polls.record('remotive', '2026-11-05');
    polls.record('remoteok', '2026-11-05');
    polls.record('remotive', '2026-11-06');
    expect(polls.count('remotive', '2026-11-05')).toBe(2);
    expect(polls.count('remoteok', '2026-11-05')).toBe(1);
    expect(polls.count('remotive', '2026-11-06')).toBe(1);
    expect(polls.count('himalayas', '2026-11-05')).toBe(0);
  });
});
