// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../shared/errors';
import { appendErrorLog, MAX_LOG_BYTES } from './error-log';

const at = new Date('2026-11-17T10:00:00.000Z');
const tmp = () => join(mkdtempSync(join(tmpdir(), 'applio-log-')), 'applio.log');

describe('appendErrorLog', () => {
  it('writes one line with the time, method, code, message and cause', () => {
    const path = tmp();
    appendErrorLog(path, 'analyzeJob', new AppError('analysis_unreadable', 'No title.', { cause: 'title: too_small' }), at);
    expect(readFileSync(path, 'utf8')).toBe('2026-11-17T10:00:00.000Z analyzeJob analysis_unreadable "No title." cause="title: too_small"\n');
  });

  it('keeps a multi-line message on one line and gives a plain error the code "error"', () => {
    const path = tmp();
    appendErrorLog(path, 'getJob', new Error('a\nb'), at);
    expect(readFileSync(path, 'utf8')).toBe('2026-11-17T10:00:00.000Z getJob error "a\\nb"\n');
  });

  it('moves a log past the size cap to .1, replacing the old one, and starts fresh', () => {
    const path = tmp();
    writeFileSync(`${path}.1`, 'older');
    writeFileSync(path, 'x'.repeat(MAX_LOG_BYTES + 1));
    appendErrorLog(path, 'getJob', new Error('boom'), at);
    expect(statSync(`${path}.1`).size).toBe(MAX_LOG_BYTES + 1);
    expect(readFileSync(path, 'utf8')).toContain('getJob error "boom"');
  });

  it('never throws when the log cannot be written', () => {
    expect(() => appendErrorLog('/nonexistent-dir/applio.log', 'getJob', new Error('boom'), at)).not.toThrow();
    expect(existsSync('/nonexistent-dir')).toBe(false);
  });
});
