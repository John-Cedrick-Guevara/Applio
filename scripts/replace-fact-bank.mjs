// Replaces the fact bank (sections and facts) and the contact details in an
// Applio database with the ones in a seed file, after backing the database up.
// Answers, jobs, drafts and settings other than `contact` are left alone.
//
//   node scripts/replace-fact-bank.mjs ~/Applio/applio.db seed.json
//
// Seed: { "contact": Contact, "groups": FactGroup[], "facts": [{ "group", "text", "tags"? }] }
// Run it with Applio quit, after Applio has opened the database once on a build with
// migration 9 (fact group details). Same SQL as `replaceFactBank` in src/infra/db/profile.ts.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const [dbPath, seedPath] = process.argv.slice(2);
if (!dbPath || !seedPath) {
  console.error('Usage: node scripts/replace-fact-bank.mjs <applio.db> <seed.json>');
  process.exit(2);
}

const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const names = new Set(seed.groups.map((g) => g.name));
const orphan = seed.facts.find((f) => !names.has(f.group));
if (orphan) throw new Error(`Fact "${orphan.text.slice(0, 40)}…" names a section that isn't in "groups": ${orphan.group}`);

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA busy_timeout = 5000');
const version = Number(db.prepare('PRAGMA user_version').get().user_version);
if (version < 9) throw new Error(`This database is at version ${version}. Open it once with the current Applio build first (it needs version 9).`);

const backup = `${dbPath}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);

const insertGroup = db.prepare('INSERT INTO fact_groups (name, dates, kind, context, link, position) VALUES (?, ?, ?, ?, ?, ?)');
const insertFact = db.prepare('INSERT INTO facts (id, group_name, text, tags, times_used, position) VALUES (?, ?, ?, ?, 0, ?)');
db.exec('BEGIN');
try {
  db.exec('DELETE FROM facts; DELETE FROM fact_groups');
  seed.groups.forEach((g, i) => insertGroup.run(g.name, g.dates ?? null, g.kind ?? null, g.context ?? null, g.link ?? null, i));
  seed.facts.forEach((f, i) => insertFact.run(randomUUID(), f.group, f.text, JSON.stringify(f.tags ?? []), i + 1));
  if (seed.contact) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('contact', JSON.stringify(seed.contact));
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}
console.log(`Replaced the fact bank: ${seed.groups.length} sections, ${seed.facts.length} facts. Backup: ${backup}`);
