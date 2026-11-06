// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findJobFolder, writeApplication } from './application-files';

let root = '';
beforeEach(() => (root = mkdtempSync(join(tmpdir(), 'applio-out-'))));
afterEach(() => rmSync(root, { recursive: true, force: true }));

const jobMd = (id: string) => `---\napplio_job_id: ${id}\n---\n# Role`;

describe('application files', () => {
  it('writes every file into the job folder, creating it, and returns its path', () => {
    const folder = writeApplication(root, '2026-11/Acme — Engineer (88%)', { 'job.md': jobMd('j1'), 'resume.pdf': new Uint8Array([37, 80, 68, 70]) }, 'j1');
    expect(folder).toBe(join(root, '2026-11/Acme — Engineer (88%)'));
    expect(readFileSync(join(folder, 'job.md'), 'utf8')).toBe(jobMd('j1'));
    expect(readFileSync(join(folder, 'resume.pdf')).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('refuses a folder path that would escape the output folder', () => {
    expect(() => writeApplication(root, '../outside', { 'job.md': 'x' }, 'j1')).toThrow('outside the output folder');
  });

  it('finds a renamed folder by the job id in its job.md', () => {
    const folder = writeApplication(root, '2026-11/Acme — Engineer (88%)', { 'job.md': jobMd('j1') }, 'j1');
    writeApplication(root, '2026-11/Globex — Designer (80%)', { 'job.md': jobMd('j2') }, 'j2');
    renameSync(folder, join(root, '2026-11', 'Acme (applied)'));
    expect(findJobFolder(root, 'j1')).toBe(join(root, '2026-11', 'Acme (applied)'));
  });

  it('finds a folder moved to another month folder', () => {
    const folder = writeApplication(root, '2026-11/Acme — Engineer (88%)', { 'job.md': jobMd('j1') }, 'j1');
    mkdirSync(join(root, 'archive'));
    renameSync(folder, join(root, 'archive', 'Acme'));
    expect(findJobFolder(root, 'j1')).toBe(join(root, 'archive', 'Acme'));
  });

  it('finds nothing when the folder is gone or the root does not exist', () => {
    expect(findJobFolder(root, 'j9')).toBeUndefined();
    expect(findJobFolder(join(root, 'missing'), 'j1')).toBeUndefined();
  });

  it("gives a second job its own folder when the name is taken by another job", () => {
    const first = writeApplication(root, '2026-11/Acme — Engineer (88%)', { 'job.md': jobMd('j1') }, 'j1');
    const second = writeApplication(root, '2026-11/Acme — Engineer (88%)', { 'job.md': jobMd('abcdef1234') }, 'abcdef1234');
    expect(second).toBe(join(root, '2026-11/Acme — Engineer (88%) · abcdef12'));
    expect(readFileSync(join(first, 'job.md'), 'utf8')).toBe(jobMd('j1'));
    expect(writeApplication(root, '2026-11/Acme — Engineer (88%)', { 'job.md': jobMd('j1') }, 'j1')).toBe(first);
  });
});
