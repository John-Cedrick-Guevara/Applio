import type { Migration } from './migrate';

/**
 * The schema, one migration per release that changed it. Append only.
 * Lists and nested records the app never queries by (tags, résumé sections)
 * are JSON text; anything filtered or sorted on is a real column with an index.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        dedup_key TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_name TEXT NOT NULL,
        company TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        location TEXT NOT NULL,
        salary TEXT,
        employment_type TEXT NOT NULL,
        posted_at TEXT NOT NULL,
        status TEXT NOT NULL,
        channel TEXT NOT NULL,
        description TEXT NOT NULL,
        score INTEGER,
        role_summary TEXT,
        description_summary TEXT,
        tags TEXT NOT NULL,
        strengths TEXT NOT NULL,
        gaps TEXT NOT NULL,
        apply_target TEXT NOT NULL,
        platform TEXT,
        facts_used INTEGER NOT NULL,
        tokens_used INTEGER NOT NULL,
        folder_path TEXT,
        sent_by TEXT,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX jobs_dedup_key ON jobs (dedup_key);
      CREATE INDEX jobs_status ON jobs (status);
      CREATE INDEX jobs_created_at ON jobs (created_at);

      CREATE TABLE status_events (
        id INTEGER PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        at TEXT NOT NULL,
        note TEXT
      );
      CREATE INDEX status_events_job ON status_events (job_id, id);

      CREATE TABLE drafts (
        job_id TEXT PRIMARY KEY REFERENCES jobs (id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        headline TEXT NOT NULL,
        summary TEXT NOT NULL,
        resume TEXT NOT NULL,
        cover_letter TEXT NOT NULL,
        edited INTEGER NOT NULL,
        answers TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE fact_groups (
        name TEXT PRIMARY KEY,
        dates TEXT,
        position INTEGER NOT NULL
      );

      CREATE TABLE facts (
        id TEXT PRIMARY KEY,
        group_name TEXT NOT NULL,
        text TEXT NOT NULL,
        tags TEXT NOT NULL,
        times_used INTEGER NOT NULL,
        position INTEGER NOT NULL
      );

      CREATE TABLE answers (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        origin TEXT NOT NULL,
        times_reused INTEGER NOT NULL,
        position INTEGER NOT NULL
      );

      CREATE TABLE sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        autonomy TEXT NOT NULL,
        via TEXT NOT NULL,
        max_autonomy TEXT,
        last_polled_at TEXT,
        position INTEGER NOT NULL
      );

      -- Non-secret settings and profile singletons (preferences, skills), one JSON value per key.
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE run_summaries (
        id INTEGER PRIMARY KEY,
        at TEXT NOT NULL,
        found INTEGER NOT NULL,
        new_after_dedup INTEGER NOT NULL,
        passed_filters INTEGER NOT NULL,
        drafted INTEGER NOT NULL
      );

      CREATE TABLE usage_records (
        id INTEGER PRIMARY KEY,
        at TEXT NOT NULL,
        step TEXT NOT NULL,
        tokens INTEGER NOT NULL,
        job_id TEXT,
        run_id INTEGER
      );
      CREATE INDEX usage_records_at ON usage_records (at);
    `,
  },
  {
    version: 2,
    name: 'source poll counts',
    sql: `
      -- Polls per source per local day, for each board's daily limit (SPEC F10).
      CREATE TABLE source_polls (
        source_id TEXT NOT NULL,
        day TEXT NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (source_id, day)
      );
    `,
  },
  {
    version: 3,
    name: 'run details',
    sql: `
      -- Per-reason drop counts and each source's outcome, as JSON; shown, never queried by.
      ALTER TABLE run_summaries ADD COLUMN details TEXT;
    `,
  },
  {
    version: 4,
    name: 'input and output tokens',
    sql: `
      -- \`tokens\` stays the total the budget counts; these split it for the usage page (SPEC F10).
      ALTER TABLE usage_records ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE usage_records ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 5,
    name: 'send log',
    sql: `
      -- One row per job that was (or is being) sent: the double-send guard and the record of exactly what went out (SPEC F7).
      CREATE TABLE sends (
        job_id TEXT PRIMARY KEY REFERENCES jobs (id) ON DELETE CASCADE,
        channel TEXT NOT NULL,
        state TEXT NOT NULL,
        claimed_at TEXT NOT NULL,
        sent_at TEXT,
        recipient TEXT,
        subject TEXT,
        body TEXT,
        attachments TEXT
      );
      CREATE INDEX sends_channel_claimed ON sends (channel, claimed_at);
    `,
  },
  {
    version: 6,
    name: 'apply url',
    sql: `
      -- The ATS form a job is applied through; \`url\` stays the board page that's credited.
      ALTER TABLE jobs ADD COLUMN apply_url TEXT;
    `,
  },
];
