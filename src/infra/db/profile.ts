import type { DatabaseSync } from 'node:sqlite';
import type { Answer, Fact, FactGroup, FactGroupKind } from '../../shared/types';
import { transaction } from './database';
import { json, nullable, optText, type Row } from './rows';

export interface ProfileRepo {
  listFacts(): Fact[];
  /** Inserts, or updates in place by id; new facts go last. */
  saveFact(fact: Fact): void;
  deleteFact(id: string): void;
  listFactGroups(): FactGroup[];
  /** Swaps the whole group list at once; on failure the previous list stays. */
  replaceFactGroups(groups: readonly FactGroup[]): void;
  /** Swaps every section and fact at once (a fact-bank rebuild); answers are untouched. */
  replaceFactBank(groups: readonly FactGroup[], facts: readonly Fact[]): void;
  listAnswers(): Answer[];
  /** Inserts, or updates in place by id; new answers go last. */
  saveAnswer(answer: Answer): void;
  deleteAnswer(id: string): void;
}

const toFact = (r: Row): Fact => ({
  id: String(r.id),
  group: String(r.group_name),
  text: String(r.text),
  tags: json<string[]>(r.tags),
  timesUsed: Number(r.times_used),
});

const toAnswer = (r: Row): Answer => ({
  id: String(r.id),
  question: String(r.question),
  answer: String(r.answer),
  origin: String(r.origin) as Answer['origin'],
  timesReused: Number(r.times_reused),
});

/** SQLite-backed fact bank, fact groups and answer bank (SPEC F1). */
export function createProfileRepo(db: DatabaseSync): ProfileRepo {
  const upsertFact = db.prepare(`
    INSERT INTO facts (id, group_name, text, tags, times_used, position)
    VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM facts))
    ON CONFLICT (id) DO UPDATE SET group_name = excluded.group_name, text = excluded.text,
      tags = excluded.tags, times_used = excluded.times_used`);
  const upsertAnswer = db.prepare(`
    INSERT INTO answers (id, question, answer, origin, times_reused, position)
    VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM answers))
    ON CONFLICT (id) DO UPDATE SET question = excluded.question, answer = excluded.answer,
      origin = excluded.origin, times_reused = excluded.times_reused`);
  const insertGroup = db.prepare('INSERT INTO fact_groups (name, dates, kind, context, link, position) VALUES (?, ?, ?, ?, ?, ?)');

  return {
    listFacts: () => db.prepare('SELECT * FROM facts ORDER BY position').all().map(toFact),
    saveFact: (f) => void upsertFact.run(f.id, f.group, f.text, JSON.stringify(f.tags), f.timesUsed),
    deleteFact: (id) => void db.prepare('DELETE FROM facts WHERE id = ?').run(id),

    listFactGroups: () =>
      db.prepare('SELECT name, dates, kind, context, link FROM fact_groups ORDER BY position').all().map((r) => {
        // Unset details are left off, so a plain section reads as just its name.
        const group: FactGroup = { name: String(r.name) };
        for (const key of ['dates', 'context', 'link'] as const) {
          const v = optText(r[key]);
          if (v) group[key] = v;
        }
        const kind = optText(r.kind);
        if (kind) group.kind = kind as FactGroupKind;
        return group;
      }),
    replaceFactGroups: (groups) =>
      transaction(db, () => {
        db.exec('DELETE FROM fact_groups');
        groups.forEach((g, i) => insertGroup.run(g.name, nullable(g.dates), nullable(g.kind), nullable(g.context), nullable(g.link), i));
      }),

    replaceFactBank: (groups, facts) =>
      transaction(db, () => {
        db.exec('DELETE FROM facts; DELETE FROM fact_groups');
        groups.forEach((g, i) => insertGroup.run(g.name, nullable(g.dates), nullable(g.kind), nullable(g.context), nullable(g.link), i));
        for (const f of facts) upsertFact.run(f.id, f.group, f.text, JSON.stringify(f.tags), f.timesUsed);
      }),

    listAnswers: () => db.prepare('SELECT * FROM answers ORDER BY position').all().map(toAnswer),
    saveAnswer: (a) => void upsertAnswer.run(a.id, a.question, a.answer, a.origin, a.timesReused),
    deleteAnswer: (id) => void db.prepare('DELETE FROM answers WHERE id = ?').run(id),
  };
}
