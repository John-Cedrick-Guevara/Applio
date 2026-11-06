import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { jobIdIn } from '../../core/generation/application-folder';

/**
 * Writes an application's files into `<root>/<folder>` (SPEC F8), creating it. If that
 * folder already belongs to another job, the short job id is added to the name.
 * @returns The folder's absolute path.
 * @throws when `folder` would land outside `root`; names are sanitized upstream, this is the backstop.
 */
export function writeApplication(root: string, folder: string, files: Record<string, string | Uint8Array>, jobId: string): string {
  // A folder of the same name that belongs to another job is never written into: this job gets its own.
  const taken = (d: string) => existsSync(join(d, 'job.md')) && jobIdIn(readFileSync(join(d, 'job.md'), 'utf8')) !== jobId;
  const named = resolve(root, folder);
  const dir = taken(named) ? `${named} · ${jobId.slice(0, 8)}` : named;
  const rel = relative(resolve(root), dir);
  if (rel.startsWith('..') || rel.startsWith(sep) || rel === '') throw new Error(`${folder} is outside the output folder`);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

/** Subfolders, or none when the folder can't be read. */
const subfolders = (dir: string) => {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(dir, e.name));
  } catch {
    return [];
  }
};

/**
 * Finds a job's folder by the id in its `job.md`, two levels under the root
 * (`<any folder>/<any folder>`), so a renamed or moved folder re-links (SPEC F8).
 * perf: reads every job.md under the root; fine for a few thousand applications.
 */
export function findJobFolder(root: string, jobId: string): string | undefined {
  for (const dir of subfolders(root).flatMap(subfolders)) {
    const md = join(dir, 'job.md');
    if (existsSync(md) && jobIdIn(readFileSync(md, 'utf8')) === jobId) return dir;
  }
  return undefined;
}
