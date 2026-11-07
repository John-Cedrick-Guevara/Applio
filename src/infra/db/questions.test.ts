// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { openDatabase } from './database';
import { createQuestionsRepo } from './questions';
import { createSettingsRepo } from './settings';

const setup = () => createQuestionsRepo(createSettingsRepo(openDatabase(':memory:')));

describe('questions repository', () => {
  it('keeps each job\'s open questions until they are cleared', () => {
    const questions = setup();
    questions.save('j1', ['Did OpsMind ship?'], '2026-11-07T08:00:00.000Z');
    questions.save('j2', ['Start date?'], '2026-11-07T09:00:00.000Z');
    expect(questions.get('j1')).toEqual({ jobId: 'j1', questions: ['Did OpsMind ship?'], askedAt: '2026-11-07T08:00:00.000Z' });
    expect(questions.list().map((q) => q.jobId)).toEqual(['j1', 'j2']);
    questions.clear('j1');
    expect(questions.get('j1')).toBeUndefined();
    expect(questions.list().map((q) => q.jobId)).toEqual(['j2']);
  });
});
