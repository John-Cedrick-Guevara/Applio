// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
}));
vi.mock('electron', () => electron);

// A throwaway home, so `~/…` paths resolve somewhere the test controls.
const home = vi.hoisted(() => ({ dir: '' }));
vi.mock('node:os', async (original) => ({ ...(await original<typeof import('node:os')>()), homedir: () => home.dir }));

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJobsRepo, openDatabase } from '../infra/db';
import type { AiEngine } from '../core/ai/engine';
import type { JobSource } from '../core/jobs/source';
import { discovered } from '../core/triage/test-jobs';
import type { InboxClient } from '../infra/email/inbox';
import { createSecretStore, type Encryptor } from '../infra/secrets/secret-store';
import { seedJobs } from '../shared/mock/fixtures';
import type { Job } from '../shared/types';
import { createToolPorts } from '../mcp/db-ports';
import { createTools } from '../mcp/tools';
import type { ApplioApi } from '../shared/api';
import { createBackend, type Backend, type BackendDeps } from './backend';

const fakeEncryptor: Encryptor = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from([...s].reverse().join('')),
  decryptString: (b) => [...b.toString()].reverse().join(''),
};
const RESUMES = join(__dirname, '../infra/resume/fixtures');

/** One board that always lists the same two jobs; only one fits a "Backend Engineer" search. */
const fakeBoard: JobSource = {
  id: 'remotive', name: 'Remotive', dailyPollLimit: 4, hosts: [],
  fetchJobs: vi.fn(async () => ({
    jobs: [discovered({ externalId: '1', title: 'Senior Backend Engineer' }), discovered({ externalId: '2', title: 'Sales Manager' })],
    dropped: 0,
  })),
};

/** Engines that only answer readiness; what they report is set per test. */
const fakeEngine = (ready: boolean, message: string): AiEngine => ({
  complete: async () => Promise.reject(new Error('not used here')),
  check: vi.fn(async () => ({ ready, message })),
});

/** Stores the prototype's seeded jobs, so tests that need a job with or without a folder have one. */
const withSeededJobs = (deps: BackendDeps) => {
  const repo = createJobsRepo(deps.db);
  for (const job of seedJobs(new Date('2026-11-04T09:00:00.000Z'))) repo.insert(job, { dedupKey: job.id, createdAt: '2026-11-04T09:00:00.000Z' });
};

/** URLs the fake web was asked for. */
let pages: string[] = [];
beforeEach(() => (pages = []));

/** Bot API calls made, and button presses waiting for the next getUpdates. */
let telegram: { method: string; body: Record<string, unknown> }[] = [];
let telegramUpdates: unknown[] = [];
beforeEach(() => ((telegram = []), (telegramUpdates = [])));

/** Messages "sent" through the fake SMTP transport, newest last. */
let outbox: { to?: unknown; subject?: unknown; text?: unknown; attachments?: unknown }[] = [];
/** Set to make the fake SMTP refuse the next sends, like a wrong app password or a dropped network. */
let smtpRefuses: string | undefined;
/** Set to make the fake SMTP sign-in fail with nodemailer's code: EAUTH for a wrong password, ETIMEDOUT for no network. */
let smtpSignIn: 'EAUTH' | 'ETIMEDOUT' | undefined;
beforeEach(() => ((outbox = []), (smtpRefuses = undefined), (smtpSignIn = undefined)));

/** A fake Gmail inbox holding the given messages, so no test reaches real IMAP. */
const fakeInbox = (messages: { uid: number; envelope: object; headers?: Buffer; bodyStructure?: object }[] = []) => (): InboxClient =>
  ({
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: () => (async function* () { yield* messages; })(),
    download: async () => ({ content: (await import('node:stream')).Readable.from([Buffer.from("We'd love to schedule an interview next week.")]) }),
    logout: async () => {},
  }) as unknown as InboxClient;

let dir = '';
/** A backend over a temp Applio folder; call again with the same folder to simulate a restart. */
const backendIn = (folder = (dir = mkdtempSync(join(tmpdir(), 'applio-backend-')))) => {
  const deps: BackendDeps = {
    db: openDatabase(join(folder, 'applio.db')),
    secrets: createSecretStore(fakeEncryptor, join(folder, 'secrets.json')),
    sources: [fakeBoard],
    httpFor: () => ({ getJson: async () => null, getText: async () => '' }),
    onStatus: vi.fn(),
    setLaunchAtLogin: vi.fn(),
    // Stands in for printToPDF: the "PDF" is the page's HTML, so tests can read what was printed.
    printPdf: vi.fn(async (html: string) => new TextEncoder().encode(html)),
    // Stands in for Gmail's SMTP: records each message instead of sending it.
    mailTransport: () => ({
      sendMail: async (m) => {
        if (smtpSignIn) throw Object.assign(new Error('535 Username and Password not accepted'), { code: smtpSignIn });
        if (smtpRefuses) throw new Error(smtpRefuses);
        outbox.push(m);
      },
      verify: async () => {
        if (smtpSignIn) throw Object.assign(new Error('535 Username and Password not accepted'), { code: smtpSignIn });
        return true;
      },
    }),
    // Stands in for Applio's form window: "submits" and reports what it filled.
    inbox: fakeInbox(),
    // Stands in for the assisted-fill window: reports what it filled; it has no way to submit.
    fillPlatformForm: vi.fn(async () => ({ filled: 5, missing: ['Current company'] })),
    // Stands in for api.telegram.org: answers like the Bot API and records each call.
    telegramFetch: vi.fn(async (url: string, init: RequestInit) => {
      const method = url.split('/').at(-1)!;
      telegram.push({ method, body: JSON.parse(String(init.body)) });
      const result = method === 'getUpdates' ? telegramUpdates.splice(0) : {};
      return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
    }),
    showRoute: vi.fn(),
    // Stands in for the web: one public careers page, and a record of every URL asked for.
    pageFetch: vi.fn(async (url: string) => {
      pages.push(url);
      return new Response('<html><body><h1>Senior TypeScript Engineer</h1><p>Email hiring@brightline.io</p></body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    }),
    submitAts: vi.fn(async ({ input }) => ({ kind: 'submitted' as const, filled: [{ selector: '#email', label: 'Email', action: 'type' as const, value: input.applicant.email }] })),
    engines: {
      'claude-code': fakeEngine(false, "Claude Code isn't signed in. Run `claude auth login` in a terminal, or switch to an Anthropic API key below."),
      'api-key': fakeEngine(true, 'The Anthropic API accepted the key.'),
    },
  };
  return { api: createBackend(() => null, deps), deps, folder };
};

beforeEach(() => {
  home.dir = mkdtempSync(join(tmpdir(), 'applio-home-'));
  electron.shell.openExternal.mockResolvedValue(undefined);
  electron.shell.openPath.mockResolvedValue('');
});
afterEach(() => {
  rmSync(home.dir, { recursive: true, force: true });
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

describe('createBackend OS integration', () => {
  it('opens web links in the system browser and refuses other schemes', async () => {
    const { api } = backendIn();
    await api.openExternal('https://example.com/job');
    expect(electron.shell.openExternal).toHaveBeenCalledWith('https://example.com/job');
    await expect(api.openExternal('file:///etc/passwd')).rejects.toThrow('Only web links can be opened');
    expect(electron.shell.openExternal).toHaveBeenCalledTimes(1);
  });

  it('returns the chosen folder, or null when the picker is cancelled', async () => {
    const { api } = backendIn();
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/Users/me/JobApps'] });
    expect(await api.chooseFolder()).toBe('/Users/me/JobApps');
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await api.chooseFolder()).toBeNull();
  });

  it('imports nothing when the resume picker is cancelled', async () => {
    const { api } = backendIn();
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await api.importResume()).toBeNull();
  });

  it("opens a job's folder with the home directory expanded, and passes on what the OS says when it can't", async () => {
    const { api, deps } = backendIn();
    withSeededJobs(deps);
    const { folderPath } = await api.getJob('j1');
    mkdirSync(join(home.dir, folderPath!.slice(1)), { recursive: true });
    await api.openJobFolder('j1');
    expect(electron.shell.openPath).toHaveBeenCalledWith(join(home.dir, folderPath!.slice(1)));
    electron.shell.openPath.mockResolvedValueOnce('Permission denied');
    await expect(api.openJobFolder('j1')).rejects.toThrow(new Error('The system said: Permission denied'));
  });

  it("says plainly when a job's folder isn't on disk, without asking the OS", async () => {
    const { api, deps } = backendIn();
    withSeededJobs(deps);
    await expect(api.openJobFolder('j1')).rejects.toThrow(new Error("This job's folder isn't on disk yet. Applio creates it when it saves the application."));
    await expect(api.openJobFolder('j6')).rejects.toThrow(new Error('This job has no folder yet'));
    expect(electron.shell.openPath).not.toHaveBeenCalled();
  });

  it("says plainly when the output folder isn't on disk", async () => {
    const { api } = backendIn();
    await api.saveSettings({ outputFolder: '~/Gone' });
    await expect(api.openOutputFolder()).rejects.toThrow(new Error('~/Gone no longer exists. Choose the folder again above.'));
    expect(electron.shell.openPath).not.toHaveBeenCalled();
  });
});

describe('createBackend profile, settings and secrets on disk', () => {
  it('keeps profile, sources and settings edits across a restart', async () => {
    const first = backendIn();
    const fact = await first.api.saveFact({ group: 'Projects', text: 'Built an Electron app.' });
    await first.api.saveAnswer({ question: 'Notice period', answer: '2 weeks' });
    const prefs = { targetRoles: ['Backend'], seniority: 'Senior', employmentTypes: ['contract' as const], remoteOnly: true, hoursOverlap: '4h', minimumPay: '$90k' };
    await first.api.savePreferences(prefs);
    await first.api.updateSource('remoteok', { enabled: false });
    await first.api.saveSettings({ draftThreshold: 70, blocklist: ['Initech'] });
    first.deps.db.close();

    const { api } = backendIn(first.folder);
    const profile = await api.getProfile();
    expect(profile.facts).toEqual([fact]);
    expect(profile.factGroups).toEqual([{ name: 'Projects' }]);
    expect(profile.answers.map((a) => a.answer)).toEqual(['2 weeks']);
    expect(profile.preferences).toEqual(prefs);
    expect((await api.listSources()).find((s) => s.id === 'remoteok')?.enabled).toBe(false);
    expect(await api.getSettings()).toMatchObject({ draftThreshold: 70, blocklist: ['Initech'] });
  });

  it('starts a fresh install with the default sources and guardrails', async () => {
    const { api } = backendIn();
    expect(await api.listSources()).toHaveLength(11);
    expect(await api.getSettings()).toMatchObject({ draftThreshold: 75, autoSendThreshold: 85, maxPerChannelPerDay: 10, dailyTokenBudget: 150_000, assistedFill: { platform: false, custom: false } });
    expect((await api.getProfile()).facts).toEqual([]);
  });

  it('keeps secrets out of the database, the settings and the Applio folder files', async () => {
    const { api, deps, folder } = backendIn();
    const secret = 'sk-ant-test-secret-4242';
    const settings = await api.setSecret('anthropicApiKey', secret);
    expect(settings.secretsSet.anthropicApiKey).toBe(true);
    expect(deps.secrets.get('anthropicApiKey')).toBe(secret);
    expect(JSON.stringify(await api.getSettings())).not.toContain(secret);
    deps.db.close();
    for (const file of readdirSync(folder)) expect(readFileSync(join(folder, file)).toString('latin1')).not.toContain(secret);
  });

  it('checks connection readiness against the saved settings and secrets', async () => {
    const { api } = backendIn();
    expect(await api.testConnection('telegram')).toEqual({ ok: false, message: 'Missing credentials. Fill in the fields above first.' });
    await api.saveSettings({ telegramChatId: '12345' });
    await api.setSecret('telegramBotToken', '123:abc');
    expect(await api.testConnection('telegram')).toMatchObject({ ok: true });
  });

  it("tests the selected AI engine and shows Claude Code's reason when it needs setup", async () => {
    const { api } = backendIn();
    expect(await api.testConnection('ai')).toEqual({ ok: false, message: "Claude Code isn't signed in. Run `claude auth login` in a terminal, or switch to an Anthropic API key below." });
    expect((await api.getStatus()).engineReady).toBe(false);
    await api.saveSettings({ aiEngine: 'api-key' });
    expect(await api.testConnection('ai')).toEqual({ ok: true, message: 'The Anthropic API accepted the key.' });
    expect((await api.getStatus()).engineReady).toBe(true);
  });

  it('checks the engine on start and pushes whether it is ready', async () => {
    const { deps } = backendIn();
    await vi.waitFor(() => expect(deps.onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ engineReady: false })));
  });

  it('suggests facts from an imported resume and adds none until accepted', async () => {
    const { api } = backendIn();
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [join(RESUMES, 'resume.docx')] });
    const result = await api.importResume();
    expect(result?.resume).toMatchObject({ fileName: 'resume.docx', factsFound: 3 });
    expect(result?.suggestions[0]).toEqual({ group: 'Acme Corp - Senior Engineer', text: 'Cut p95 query time from 900 ms to 120 ms by redesigning the invoicing schema.' });
    const profile = await api.getProfile();
    expect(profile.facts).toEqual([]);
    expect(profile.referenceResume?.fileName).toBe('resume.docx');
  });

  it('reports an unreadable resume and changes nothing', async () => {
    const { api } = backendIn();
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [join(RESUMES, 'corrupt.pdf')] });
    await expect(api.importResume()).rejects.toThrow("Applio couldn't read corrupt.pdf");
    expect((await api.getProfile()).referenceResume).toBeUndefined();
  });
});

describe('createBackend discovery', () => {
  const searchingBackend = async (folder?: string) => {
    const b = backendIn(folder);
    const prefs = (await b.api.getProfile()).preferences;
    await b.api.savePreferences({ ...prefs, targetRoles: ['Backend Engineer'] });
    return b;
  };

  it('runs discovery, keeps the summary across a restart, and saves only the job that fits', async () => {
    const { api, deps, folder } = await searchingBackend();
    expect(await api.runDiscovery()).toMatchObject({ found: 2, newAfterDedup: 2, passedFilters: 1, drafted: 0 });
    deps.db.close();
    const after = backendIn(folder);
    expect((await after.api.getStatus()).lastRun).toMatchObject({ found: 2, passedFilters: 1 });
    expect(after.deps.db.prepare("SELECT title, status FROM jobs").all()).toEqual([{ title: 'Senior Backend Engineer', status: 'found' }]);
  });

  it('does not save the same job again on the next run', async () => {
    const { api } = await searchingBackend();
    await api.runDiscovery();
    // The dropped job isn't stored, but its key is remembered, so it isn't counted as new again (QA 2026-11-07 #14).
    expect(await api.runDiscovery()).toMatchObject({ found: 2, newAfterDedup: 0, passedFilters: 0 });
  });

  it('stays paused across a restart, refuses Run now, and shows no next run', async () => {
    const { api, deps, folder } = backendIn();
    expect((await api.getStatus()).nextRunAt).toBeDefined();
    await api.setAutomationPaused(true);
    deps.db.close();
    const after = backendIn(folder).api;
    expect(await after.getStatus()).toMatchObject({ paused: true, nextRunAt: undefined });
    await expect(after.runDiscovery()).rejects.toThrow('Automation is paused. Resume it to run discovery');
  });

  it('pushes the new status when automation is paused or a run ends', async () => {
    const { api, deps } = await searchingBackend();
    await api.runDiscovery();
    expect(deps.onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ lastRun: expect.objectContaining({ passedFilters: 1 }) }));
    await api.setAutomationPaused(true);
    expect(deps.onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ paused: true }));
  });

  it('pushes status on a tick only when a job changed since the last push, so open pages refresh', async () => {
    const { api, deps } = await searchingBackend();
    await api.runDiscovery();
    const [job] = await api.listJobs({ statuses: ['found'] });
    // Written straight to the database, as Claude's MCP process or a reply check would.
    deps.db.prepare("INSERT INTO status_events (job_id, status, at, note) VALUES (?, 'found', ?, 'x')").run(job!.id, new Date().toISOString());
    deps.onStatus.mockClear();
    await api.tick();
    expect(deps.onStatus).toHaveBeenCalledTimes(1);
    expect(deps.onStatus.mock.calls[0]![0].jobsVersion).toBeGreaterThan(0);
    deps.onStatus.mockClear();
    await api.tick();
    expect(deps.onStatus).not.toHaveBeenCalled();
  });

  it('turns launch at login on and off with the setting', async () => {
    const { api, deps } = backendIn();
    await api.saveSettings({ launchAtLogin: true });
    expect(deps.setLaunchAtLogin).toHaveBeenLastCalledWith(true);
    await api.saveSettings({ dailyTokenBudget: 1000 });
    expect(deps.setLaunchAtLogin).toHaveBeenCalledTimes(1);
  });

  it('reports tokens used today from the usage records', async () => {
    const { api } = backendIn();
    expect((await api.getStatus()).tokensToday).toBe(0);
  });

  it("scores the run's new jobs through the engine, charging the tokens to today", async () => {
    const { api, deps } = await searchingBackend();
    // Stands in for Claude answering a scoring call with JSON.
    const complete = vi.fn(async ({ jobIds }: { jobIds: readonly string[] }) => ({
      text: JSON.stringify(jobIds.map((jobId) => ({ jobId, score: 60, roleSummary: 'APIs', descriptionSummary: 'Remote', strengths: [], gaps: [] }))),
      inputTokens: 900, outputTokens: 100,
    }));
    deps.engines['claude-code'] = { complete, check: async () => ({ ready: true, message: 'ok' }) };
    await api.runDiscovery();
    // Below the draft threshold, so this run scores and drafts nothing.
    const [job] = await api.listJobs({ minScore: 50 });
    expect(job).toMatchObject({ title: 'Senior Backend Engineer', score: 60 });
    expect(await api.getJob(job!.id)).toEqual(job);
    expect((await api.getStatus()).tokensToday).toBe(1000);
    await api.runDiscovery();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('says plainly when a job does not exist', async () => {
    await expect(backendIn().api.getJob('nope')).rejects.toThrow('Job nope not found');
  });

  it('drafts strong matches through the tools after scoring them, and sends nothing', async () => {
    const { api, deps } = await searchingBackend();
    const fact = await api.saveFact({ group: 'Acme — Engineer', text: 'Cut API latency 40%' });
    // Plays Claude: scores through save_match, drafts through save_draft, as the prompts ask.
    const complete = vi.fn(async ({ prompt, jobIds }: { prompt: string; jobIds: readonly string[] }) => {
      const tools = createTools(createToolPorts(deps.db, jobIds, () => new Date()));
      const call = (name: string, input: unknown) => tools.find((t) => t.name === name)!.call(input);
      // Scoring is one turn that answers with JSON; drafting goes through the tools.
      if (prompt.startsWith('Score')) return { text: JSON.stringify(jobIds.map((jobId) => ({ jobId, score: 90, roleSummary: 'APIs', descriptionSummary: 'Remote', strengths: [{ text: 'Fast APIs', factId: fact.id }], gaps: [] }))), inputTokens: 900, outputTokens: 100 };
      for (const jobId of jobIds) call('save_draft', { jobId, kind: 'cover-letter', headline: 'h', summary: 's', resume: [{ group: 'Acme — Engineer', items: [{ text: 'Cut latency 40%', factId: fact.id }] }], coverLetter: 'Dear team', answers: [] });
      return { text: 'done', inputTokens: 900, outputTokens: 100 };
    });
    deps.engines['claude-code'] = { complete, check: async () => ({ ready: true, message: 'ok' }) };
    expect(await api.runDiscovery()).toMatchObject({ passedFilters: 1, drafted: 1 });
    const [job] = await api.listJobs({ statuses: ['drafted'] });
    expect(job).toMatchObject({ factsUsed: 1, tokensUsed: 1000, strengths: ['Fast APIs'] });
    expect((await api.getDraft(job!.id))?.coverLetter).toBe('Dear team');
    expect((await api.getStatus()).lastRun?.drafted).toBe(1);
    expect(await api.listJobs({ statuses: ['applied'] })).toEqual([]);
    await api.updateCoverLetter(job!.id, 'Dear Acme team');
    expect(await api.getDraft(job!.id)).toMatchObject({ coverLetter: 'Dear Acme team', edited: true });
  });

  it.each([
    ['unscored', 'Score'],
    ['undrafted', 'Draft'],
  ])('retries a job an earlier run left %s once the engine works again', async (_, failingStep) => {
    const { api, deps } = await searchingBackend();
    const fact = await api.saveFact({ group: 'Acme — Engineer', text: 'Cut API latency 40%' });
    let down = true;
    const complete = vi.fn(async ({ prompt, jobIds }: { prompt: string; jobIds: readonly string[] }) => {
      if (down && prompt.startsWith(failingStep)) throw new Error('Claude Code couldn\'t finish: API Error: 429');
      if (prompt.startsWith('Score')) return { text: JSON.stringify(jobIds.map((jobId) => ({ jobId, score: 90, roleSummary: 'APIs', descriptionSummary: 'Remote', strengths: [{ text: 'Fast APIs', factId: fact.id }], gaps: [] }))), inputTokens: 900, outputTokens: 100 };
      const tools = createTools(createToolPorts(deps.db, jobIds, () => new Date()));
      for (const jobId of jobIds) await tools.find((t) => t.name === 'save_draft')!.call({ jobId, kind: 'cover-letter', headline: 'h', summary: 's', resume: [{ group: 'Acme — Engineer', items: [{ text: 'Cut latency 40%', factId: fact.id }] }], coverLetter: 'Dear team', answers: [] });
      return { text: 'done', inputTokens: 900, outputTokens: 100 };
    });
    deps.engines['claude-code'] = { complete, check: async () => ({ ready: true, message: 'ok' }) };
    expect(await api.runDiscovery()).toMatchObject({ passedFilters: 1, drafted: 0 });
    down = false;
    // The job is a duplicate now, so only the retry can draft it.
    expect(await api.runDiscovery()).toMatchObject({ passedFilters: 0, drafted: 1 });
    expect(await api.listJobs({ statuses: ['drafted'] })).toHaveLength(1);
  });

  it('waits for answers when Claude asks, then drafts with them and keeps the ones saved to the bank', async () => {
    const { api, deps } = await searchingBackend();
    const fact = await api.saveFact({ group: 'Acme — Engineer', text: 'Cut API latency 40%' });
    const prompts: string[] = [];
    deps.engines['claude-code'] = {
      check: async () => ({ ready: true, message: 'ok' }),
      complete: async ({ prompt, jobIds }) => {
        prompts.push(prompt);
        if (prompt.startsWith('Score')) return { text: JSON.stringify(jobIds.map((jobId) => ({ jobId, score: 90, roleSummary: 'APIs', descriptionSummary: 'Remote', strengths: [], gaps: [] }))), inputTokens: 900, outputTokens: 100 };
        const tools = createTools(createToolPorts(deps.db, jobIds, () => new Date()));
        const call = (input: unknown) => tools.find((t) => t.name === 'save_draft')!.call(input);
        for (const jobId of jobIds) {
          if (!prompt.includes('answered')) call({ jobId, questions: ['Can you start in December?', 'Did you lead the Acme migration?'] });
          else call({ jobId, kind: 'cover-letter', headline: 'h', summary: 's', resume: [{ group: 'Acme — Engineer', items: [{ text: 'Cut API latency 40%', factId: fact.id }] }], coverLetter: 'Dear team', answers: [] });
        }
        return { text: 'done', inputTokens: 900, outputTokens: 100 };
      },
    };
    await api.runDiscovery();
    const [open] = await api.listQuestions();
    expect(open).toMatchObject({ questions: ['Can you start in December?', 'Did you lead the Acme migration?'] });
    expect(await api.listJobs({ statuses: ['drafted'] })).toEqual([]);

    const job = await api.answerQuestions(open!.jobId, [
      { question: 'Can you start in December?', answer: 'Yes, from Dec 1.' },
      { question: 'Did you lead the Acme migration?', answer: 'Led the Acme Postgres migration end to end.', saveTo: 'Acme — Engineer' },
    ]);
    await vi.waitFor(async () => expect((await api.getJob(job.id)).status).toBe('drafted'));
    expect(prompts.at(-1)).toContain('Q: Can you start in December?\nA: Yes, from Dec 1.');
    expect(await api.listQuestions()).toEqual([]);
    const facts = (await api.getProfile()).facts.map((f) => [f.group, f.text]);
    expect(facts).toContainEqual(['Acme — Engineer', 'Led the Acme Postgres migration end to end.']);
    expect(facts).not.toContainEqual(['Acme — Engineer', 'Yes, from Dec 1.']);
  });

  it('refuses answers for a job with no open questions', async () => {
    await expect(backendIn().api.answerQuestions('nope', [{ question: 'Q', answer: 'A' }])).rejects.toThrow('There are no open questions for this job.');
  });

  it('says plainly when there is no draft to edit', async () => {
    const { api } = backendIn();
    await expect(api.updateCoverLetter('nope', 'x')).rejects.toThrow('No draft for job nope');
  });

  /** A backend that has run once and drafted one job, with Claude played through the real tools. */
  /** `print`: what the fake printer outputs for a page's HTML (default: the HTML itself). */
  const draftedBackend = async (print?: (html: string) => string) => {
    const b = await searchingBackend();
    if (print) b.deps.printPdf.mockImplementation(async (html: string) => new TextEncoder().encode(print(html)));
    await b.api.saveSettings({ fullName: 'Sam Rivera' });
    const fact = await b.api.saveFact({ group: 'Acme — Engineer', text: 'Cut API latency 40%' });
    b.deps.engines['claude-code'] = {
      check: async () => ({ ready: true, message: 'ok' }),
      complete: async ({ prompt, jobIds }) => {
        const tools = createTools(createToolPorts(b.deps.db, jobIds, () => new Date()));
        const call = (name: string, input: unknown) => tools.find((t) => t.name === name)!.call(input);
        // Scoring is one turn that answers with JSON; drafting goes through the tools.
        if (prompt.startsWith('Score')) return { text: JSON.stringify(jobIds.map((jobId) => ({ jobId, score: 90, roleSummary: 'APIs', descriptionSummary: 'Remote', strengths: [{ text: 'Fast APIs', factId: fact.id }], gaps: [] }))), inputTokens: 900, outputTokens: 100 };
        for (const jobId of jobIds) call('save_draft', { jobId, kind: 'cover-letter', headline: 'Backend engineer', summary: 's', resume: [{ group: 'Acme — Engineer', items: [{ text: 'Cut latency 40%', factId: fact.id }] }], coverLetter: 'Dear team', answers: [] });
        return { text: 'done', inputTokens: 900, outputTokens: 100 };
      },
    };
    await b.api.runDiscovery();
    const [job] = await b.api.listJobs({ statuses: ['drafted'] });
    return { ...b, job: job! };
  };

  it('drafts a job scored below the threshold when the operator asks, in the background', async () => {
    const b = await searchingBackend();
    const fact = await b.api.saveFact({ group: 'Acme', text: 'Shipped APIs' });
    b.deps.engines['claude-code'] = {
      check: async () => ({ ready: true, message: 'ok' }),
      complete: async ({ prompt, jobIds }) => {
        const call = (name: string, input: unknown) => createTools(createToolPorts(b.deps.db, jobIds, () => new Date())).find((t) => t.name === name)!.call(input);
        if (prompt.startsWith('Score')) return { text: JSON.stringify(jobIds.map((jobId) => ({ jobId, score: 40, roleSummary: 'r', descriptionSummary: 'd', strengths: [], gaps: [] }))), inputTokens: 1, outputTokens: 1 };
        for (const jobId of jobIds) call('save_draft', { jobId, kind: 'cover-letter', headline: 'h', summary: 's', resume: [{ group: 'Acme', items: [{ text: 'Shipped APIs', factId: fact.id }] }], coverLetter: 'Hi', answers: [] });
        return { text: 'done', inputTokens: 1, outputTokens: 1 };
      },
    };
    expect(await b.api.runDiscovery()).toMatchObject({ drafted: 0 });
    const [below] = await b.api.listJobs({ statuses: ['scored'] });
    await b.api.draftJob(below!.id);
    await vi.waitFor(async () => expect((await b.api.getJob(below!.id)).status).toBe('drafted'));
    await expect(b.api.draftJob(below!.id)).rejects.toThrow('Only scored jobs can be drafted');
  });

  it("keeps Claude's email subject and keywords with the draft", async () => {
    const { api, job, deps } = await draftedBackend();
    const draft = (await api.getDraft(job.id))!;
    deps.db.prepare('UPDATE drafts SET subject = ?, keywords = ? WHERE job_id = ?').run('Backend Engineer — Sam Rivera', JSON.stringify({ claimed: [], gaps: ['Go'] }), job.id);
    expect(await api.getDraft(job.id)).toMatchObject({ ...draft, subject: 'Backend Engineer — Sam Rivera', keywords: { claimed: [], gaps: ['Go'] }, check: expect.any(Object) });
  });

  it('marks a draft stale once the fact bank changes, and redrafts it from the current profile', async () => {
    const { api, job } = await draftedBackend();
    expect((await api.getDraft(job.id))?.check).toMatchObject({ stale: false, unverified: [], forbidden: [] });
    await api.saveFact({ group: 'Acme — Engineer', text: 'Led the billing migration' });
    expect((await api.getDraft(job.id))?.check?.stale).toBe(true);
    await api.redraft(job.id);
    await vi.waitFor(async () => expect((await api.getJob(job.id)).status).toBe('drafted'));
    expect((await api.getDraft(job.id))?.check?.stale).toBe(false);
  });

  it('flags cover-letter lines that state something no fact does', async () => {
    const { api, job } = await draftedBackend();
    await api.updateCoverLetter(job.id, 'Dear team,\nI am based in Marikina City.');
    expect((await api.getDraft(job.id))?.check?.unverified).toEqual([{ line: 'I am based in Marikina City.', terms: ['Marikina', 'City'] }]);
  });

  it('writes the résumé and letter PDFs and job.md into the month folder, with the name on them', async () => {
    const { job, deps } = await draftedBackend();
    expect(job.folderPath).toMatch(/Applio\/\d{4}-\d{2}\/Acme — Senior Backend Engineer \(90%\)$/);
    expect(readdirSync(job.folderPath!).sort()).toEqual(['cover-letter.pdf', 'job.md', 'resume.pdf']);
    expect(readFileSync(join(job.folderPath!, 'resume.pdf'), 'utf8')).toContain('<h1 class="name">SAM RIVERA</h1>');
    expect(readFileSync(join(job.folderPath!, 'job.md'), 'utf8')).toContain(`applio_job_id: ${job.id}`);
    expect(deps.printPdf).toHaveBeenCalledTimes(2);
  });

  it('notes a résumé that prints past one page, so it is never sent as a two-pager unnoticed', async () => {
    const { job, deps } = await draftedBackend((html) => (html.includes('<title>Resume</title>') ? '/Type /Page\n/Type /Page' : '/Type /Page'));
    expect(job.history.map((e) => e.note)).toContain('The résumé prints on 2 pages. Trim a bullet or two in the draft, or approve as it is.');
    expect(deps.printPdf).toHaveBeenCalledTimes(2);
  });

  it('prints the letter again when the operator edits it', async () => {
    const { api, job } = await draftedBackend();
    await api.updateCoverLetter(job.id, 'Dear Acme team');
    expect(readFileSync(join(job.folderPath!, 'cover-letter.pdf'), 'utf8')).toContain('Dear Acme team');
  });

  it('re-links a renamed folder by job id, so Open folder still works', async () => {
    const { api, job } = await draftedBackend();
    const renamed = join(job.folderPath!, '..', 'Acme (my notes)');
    renameSync(job.folderPath!, renamed);
    await api.openJobFolder(job.id);
    expect(electron.shell.openPath).toHaveBeenLastCalledWith(renamed);
    expect((await api.getJob(job.id)).folderPath).toBe(renamed);
  });

  it('opens the résumé or letter PDF in the system viewer', async () => {
    const { api, job } = await draftedBackend();
    await api.openDraftFile(job.id, 'resume');
    expect(electron.shell.openPath).toHaveBeenLastCalledWith(join(job.folderPath!, 'resume.pdf'));
    await api.openDraftFile(job.id, 'letter');
    expect(electron.shell.openPath).toHaveBeenLastCalledWith(join(job.folderPath!, 'cover-letter.pdf'));
  });

  it('keeps the draft and notes why when the files cannot be written', async () => {
    const b = await searchingBackend();
    vi.mocked(b.deps.printPdf).mockRejectedValue(new Error('printing failed'));
    const fact = await b.api.saveFact({ group: 'Acme', text: 'Shipped APIs' });
    b.deps.engines['claude-code'] = {
      check: async () => ({ ready: true, message: 'ok' }),
      complete: async ({ prompt, jobIds }) => {
        const call = (name: string, input: unknown) => createTools(createToolPorts(b.deps.db, jobIds, () => new Date())).find((t) => t.name === name)!.call(input);
        // Scoring is one turn that answers with JSON; drafting goes through the tools.
        if (prompt.startsWith('Score')) return { text: JSON.stringify(jobIds.map((jobId) => ({ jobId, score: 90, roleSummary: 'r', descriptionSummary: 'd', strengths: [], gaps: [] }))), inputTokens: 900, outputTokens: 100 };
        for (const jobId of jobIds) call('save_draft', { jobId, kind: 'cover-letter', headline: 'h', summary: 's', resume: [{ group: 'Acme', items: [{ text: 'Shipped APIs', factId: fact.id }] }], coverLetter: 'Hi', answers: [] });
        return { text: 'done', inputTokens: 1, outputTokens: 1 };
      },
    };
    expect(await b.api.runDiscovery()).toMatchObject({ drafted: 1 });
    const [job] = await b.api.listJobs({ statuses: ['drafted'] });
    expect(job!.history.at(-1)?.note).toBe("Couldn't save the files: printing failed");
    expect(existsSync(join(home.dir, 'Applio'))).toBe(false);
  });

  const PASSWORD = 'abcd efgh ijkl mnop';
  /** A drafted job switched to the email channel, with Gmail set up. */
  const emailJob = async () => {
    const b = await draftedBackend();
    b.deps.db.prepare("UPDATE jobs SET channel = 'email', apply_target = 'jobs@acme.com' WHERE id = ?").run(b.job.id);
    await b.api.saveSettings({ gmailAddress: 'sam@gmail.com' });
    await b.api.setSecret('gmailAppPassword', PASSWORD);
    return b;
  };

  it('sends an approved email application with the résumé, logs it in sent.md, and marks it applied', async () => {
    const { api, job } = await emailJob();
    expect(await api.approveDraft(job.id)).toMatchObject({ status: 'applied', sentBy: 'you-app' });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: 'jobs@acme.com', subject: 'Application: Senior Backend Engineer — Sam Rivera', text: 'Dear team\n\nSam Rivera' });
    expect(readFileSync(join(job.folderPath!, 'sent.md'), 'utf8')).toContain('To: jobs@acme.com');
  });

  it('refuses to approve while Gmail is not set up, leaving the draft in Review with nothing logged', async () => {
    const { api, job, deps } = await draftedBackend();
    deps.db.prepare("UPDATE jobs SET channel = 'email', apply_target = 'jobs@acme.com' WHERE id = ?").run(job.id);
    await expect(api.approveDraft(job.id)).rejects.toThrow('Set up Gmail in Settings first');
    expect((await api.getJob(job.id)).status).toBe('drafted');
    expect(await api.getSend(job.id)).toBeNull();
    expect(outbox).toEqual([]);
  });

  it('keeps a refused send approved and unlogged, then a retry sends exactly once and logs exactly what went out', async () => {
    const { api, job } = await emailJob();
    smtpRefuses = 'Invalid login: 535 Username and Password not accepted';
    await expect(api.approveDraft(job.id)).rejects.toThrow('Invalid login');
    expect(await api.getJob(job.id)).toMatchObject({ status: 'approved' });
    expect((await api.getJob(job.id)).history.at(-1)?.note).toMatch(/^Not sent: .*Invalid login/);
    expect(await api.getSend(job.id)).toBeNull();

    smtpRefuses = undefined;
    expect((await api.approveDraft(job.id)).status).toBe('applied');
    expect(outbox).toHaveLength(1);
    expect(await api.getSend(job.id)).toMatchObject({ state: 'sent', to: outbox[0]!.to, subject: outbox[0]!.subject, body: outbox[0]!.text });
  });

  it('never sends twice, even on a double click', async () => {
    const { api, job } = await emailJob();
    const results = await Promise.allSettled([api.approveDraft(job.id), api.approveDraft(job.id)]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(outbox).toHaveLength(1);
  });

  it('keeps the app password out of the database and every file it writes', async () => {
    const { api, job, deps, folder } = await emailJob();
    await api.approveDraft(job.id);
    deps.db.close();
    const files = [...readdirSync(folder).map((f) => join(folder, f)), ...readdirSync(job.folderPath!).map((f) => join(job.folderPath!, f))];
    for (const f of files) expect(readFileSync(f).toString('latin1')).not.toContain(PASSWORD);
  });

  it('approves a career-site job without sending anything', async () => {
    const { api, job } = await draftedBackend();
    expect((await api.approveDraft(job.id)).status).toBe('approved');
    expect(outbox).toEqual([]);
  });

  it('logs a manual application and a job the operator chose not to apply to', async () => {
    const { api, job } = await draftedBackend();
    await api.approveDraft(job.id);
    expect(await api.markApplied(job.id)).toMatchObject({ status: 'applied', sentBy: 'you-manual' });
    await expect(api.skipJob(job.id)).rejects.toThrow(`Job ${job.id} is already applied, so it can't be skipped`);
  });

  it('skips a drafted job', async () => {
    const { api, job } = await draftedBackend();
    expect((await api.skipJob(job.id)).status).toBe('skipped');
  });

  it('signs in to Gmail when its credentials are saved, sending nothing, and only then calls it connected', async () => {
    const { api } = backendIn();
    expect((await api.saveSettings({ gmailAddress: 'sam@gmail.com' })).checks.gmail).toBeUndefined();
    const saved = await api.setSecret('gmailAppPassword', PASSWORD);
    expect(saved.checks.gmail).toMatchObject({ ok: true });
    expect(outbox).toEqual([]);
  });

  it('records a rejected app password as a failed check, never as connected', async () => {
    const { api } = backendIn();
    await api.saveSettings({ gmailAddress: 'sam@gmail.com' });
    smtpSignIn = 'EAUTH';
    const saved = await api.setSecret('gmailAppPassword', 'qafakeqafakeqafk');
    expect(saved.checks.gmail).toMatchObject({ ok: false, message: expect.stringContaining('Gmail rejected the address or app password') });
    expect(saved.checks.gmail?.offline).toBeUndefined();
  });

  it('records an unreachable Gmail as not verified, not as a wrong password', async () => {
    const { api } = backendIn();
    await api.saveSettings({ gmailAddress: 'sam@gmail.com' });
    smtpSignIn = 'ETIMEDOUT';
    expect((await api.setSecret('gmailAppPassword', PASSWORD)).checks.gmail).toMatchObject({ ok: false, offline: true });
  });

  it('marks Gmail as failing when a send is rejected for its password, and as working again after a send goes out', async () => {
    const { api, job } = await emailJob();
    smtpSignIn = 'EAUTH';
    await expect(api.approveDraft(job.id)).rejects.toThrow('Gmail rejected');
    expect((await api.getSettings()).checks.gmail).toMatchObject({ ok: false });
    smtpSignIn = undefined;
    await api.approveDraft(job.id);
    expect((await api.getSettings()).checks.gmail).toMatchObject({ ok: true });
  });

  it('checks Telegram with a test message when its token and chat are saved', async () => {
    const { api } = backendIn();
    await api.saveSettings({ telegramChatId: '12345' });
    const saved = await api.setSecret('telegramBotToken', '123:abc');
    expect(saved.checks.telegram).toMatchObject({ ok: true });
    expect(telegram.map((c) => c.method)).toEqual(['sendMessage']);
  });

  it('sends a test email to the operator’s own address', async () => {
    const { api } = backendIn();
    await api.saveSettings({ gmailAddress: 'sam@gmail.com' });
    await api.setSecret('gmailAppPassword', PASSWORD);
    expect(await api.testConnection('gmail')).toEqual({ ok: true, message: 'Test email sent to sam@gmail.com' });
    expect(outbox[0]).toMatchObject({ to: 'sam@gmail.com', subject: 'Applio test email' });
  });

  it('submits an approved ATS application through the form window and logs what it filled', async () => {
    const { api, job, deps } = await draftedBackend();
    deps.db.prepare("UPDATE jobs SET channel = 'ats', apply_target = 'jobs.lever.co', apply_url = 'https://jobs.lever.co/acme/1' WHERE id = ?").run(job.id);
    await api.saveSettings({ gmailAddress: 'sam@gmail.com' });
    await api.saveAnswer({ question: 'Phone', answer: '+63 917 555 0100' });
    expect(await api.approveDraft(job.id)).toMatchObject({ status: 'applied', sentBy: 'you-app' });
    expect(deps.submitAts).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://jobs.lever.co/acme/1/apply' }));
    expect(vi.mocked(deps.submitAts).mock.calls[0]![0].input.answers).toContainEqual({ question: 'Phone', answer: '+63 917 555 0100' });
    expect(readFileSync(join(job.folderPath!, 'sent.md'), 'utf8')).toContain('Email: sam@gmail.com');
  });

  it('sends a strong match from an Autonomous source on its own, as Autonomous, and lists it with the applications', async () => {
    const b = await searchingBackend();
    await b.api.updateSource('remotive', { autonomy: 'autonomous' });
    await b.api.saveSettings({ fullName: 'Sam Rivera', gmailAddress: 'sam@gmail.com' });
    await b.api.setSecret('gmailAppPassword', PASSWORD);
    const fact = await b.api.saveFact({ group: 'Acme', text: 'Shipped APIs' });
    b.deps.engines['claude-code'] = {
      check: async () => ({ ready: true, message: 'ok' }),
      complete: async ({ prompt, jobIds }) => {
        // The board's job applies by email, so the channel allows sending on its own.
        for (const id of jobIds) b.deps.db.prepare("UPDATE jobs SET channel = 'email', apply_target = 'jobs@acme.com' WHERE id = ?").run(id);
        const call = (name: string, input: unknown) => createTools(createToolPorts(b.deps.db, jobIds, () => new Date())).find((t) => t.name === name)!.call(input);
        // Scoring is one turn that answers with JSON; drafting goes through the tools.
        if (prompt.startsWith('Score')) return { text: JSON.stringify(jobIds.map((jobId) => ({ jobId, score: 92, roleSummary: 'r', descriptionSummary: 'd', strengths: [], gaps: [] }))), inputTokens: 900, outputTokens: 100 };
        for (const jobId of jobIds) call('save_draft', { jobId, kind: 'cover-letter', headline: 'h', summary: 's', resume: [{ group: 'Acme', items: [{ text: 'Shipped APIs', factId: fact.id }] }], coverLetter: 'Dear team', answers: [] });
        return { text: 'done', inputTokens: 1, outputTokens: 1 };
      },
    };
    await b.api.runDiscovery();
    const [sent] = await b.api.listJobs({ statuses: ['applied'] });
    expect(sent).toMatchObject({ sentBy: 'autonomous' });
    expect(outbox).toHaveLength(1);
  });

  it('keeps a strong match from a Draft → Approve source waiting in Review', async () => {
    const { api } = await draftedBackend();
    expect(await api.listJobs({ statuses: ['applied'] })).toEqual([]);
    expect(await api.listJobs({ statuses: ['drafted'] })).toHaveLength(1);
  });

  it('follows up in the same Gmail thread as the application, and restarts the window', async () => {
    const { api, job } = await emailJob();
    await api.approveDraft(job.id);
    const followed = await api.sendFollowUp(job.id, 'Hi again, still keen.');
    expect(followed.history.at(-1)).toMatchObject({ status: 'applied', note: 'Follow-up sent' });
    const [application, followUp] = outbox as { messageId?: string; inReplyTo?: string; subject?: string }[];
    expect(followUp).toMatchObject({ inReplyTo: application!.messageId, subject: 'Re: Application: Senior Backend Engineer — Sam Rivera' });
    expect(readFileSync(join(job.folderPath!, 'follow-ups.md'), 'utf8')).toContain('Hi again, still keen.');
  });

  it('generates interview prep once and reuses it on reopen', async () => {
    const { api, job, deps } = await draftedBackend();
    const complete = vi.fn(async () => ({ text: '{"told":["Cut latency 40%"],"likelyQuestions":["How?"],"askThem":["Why now?"]}', inputTokens: 900, outputTokens: 100 }));
    deps.engines['claude-code'] = { complete, check: async () => ({ ready: true, message: 'ok' }) };
    expect(await api.getInterviewPrep(job.id)).toEqual({ told: ['Cut latency 40%'], likelyQuestions: ['How?'], askThem: ['Why now?'], tokens: 1000 });
    expect(await api.getInterviewPrep(job.id)).toMatchObject({ told: ['Cut latency 40%'] });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('lets the operator correct a status within the rules, and logs it', async () => {
    const { api, job } = await draftedBackend();
    await api.markApplied(job.id);
    expect((await api.setStatus(job.id, 'interview', 'Recruiter called')).history.at(-1)).toMatchObject({ status: 'interview', note: 'Recruiter called' });
    await expect(api.setStatus(job.id, 'drafted')).rejects.toThrow('Cannot move job from interview to drafted');
  });

  it('marks an application with no reply in 21 days as No reply on the next tick', async () => {
    const { api, deps } = backendIn();
    await api.setAutomationPaused(true); // no discovery run on this tick, only the time rules
    const old = { ...(seedJobs(new Date())[0] as Job), id: 'old', status: 'applied' as const, history: [{ status: 'applied' as const, at: new Date(Date.now() - 22 * 86_400_000).toISOString() }] };
    createJobsRepo(deps.db).insert(old, { dedupKey: 'old', createdAt: old.history[0]!.at });
    await (api as unknown as { tick: () => Promise<void> }).tick();
    expect((await api.getJob('old')).status).toBe('ghosted');
  });

  it("reads a reply in the application's thread from Gmail and moves the application to Interview", async () => {
    const { api, job, deps } = await emailJob();
    await api.approveDraft(job.id);
    const sentId = (outbox[0] as { messageId: string }).messageId;
    deps.inbox = fakeInbox([{ uid: 7, envelope: { from: [{ name: 'Maria', address: 'maria@acme.com' }], subject: 'Re: Application', date: new Date(), inReplyTo: sentId }, bodyStructure: { type: 'text/plain', part: '1' } }]);
    // The inbox is chosen when the backend is built, so rebuild over the same folder, as a restart would.
    deps.db.close();
    const after = (() => {
      const d: BackendDeps = { ...deps, db: openDatabase(join(dir, 'applio.db')) };
      return createBackend(() => null, d);
    })();
    await after.tick();
    expect((await after.getJob(job.id)).history.at(-1)).toMatchObject({ status: 'interview', note: "Reply from maria@acme.com: We'd love to schedule an interview next week." });
  });

  const TOKEN = '123456:ABC-secret-token';
  /** Sets Telegram up, then forgets the setup check's test message so tests see only what came after. */
  const withTelegram = async (api: ApplioApi) => {
    await api.saveSettings({ telegramChatId: '42' });
    await api.setSecret('telegramBotToken', TOKEN);
    telegram = [];
  };

  it('tells Telegram about a draft waiting for approval, with Approve, Open and Skip', async () => {
    const b = await searchingBackend();
    await withTelegram(b.api);
    const fact = await b.api.saveFact({ group: 'Acme', text: 'Shipped APIs' });
    b.deps.engines['claude-code'] = {
      check: async () => ({ ready: true, message: 'ok' }),
      complete: async ({ prompt, jobIds }) => {
        const call = (name: string, input: unknown) => createTools(createToolPorts(b.deps.db, jobIds, () => new Date())).find((t) => t.name === name)!.call(input);
        // Scoring is one turn that answers with JSON; drafting goes through the tools.
        if (prompt.startsWith('Score')) return { text: JSON.stringify(jobIds.map((jobId) => ({ jobId, score: 90, roleSummary: 'Builds APIs.', descriptionSummary: 'd', strengths: [], gaps: [] }))), inputTokens: 900, outputTokens: 100 };
        for (const jobId of jobIds) call('save_draft', { jobId, kind: 'cover-letter', headline: 'h', summary: 's', resume: [{ group: 'Acme', items: [{ text: 'Shipped APIs', factId: fact.id }] }], coverLetter: 'Dear team, this letter stays private.', answers: [] });
        return { text: 'done', inputTokens: 1, outputTokens: 1 };
      },
    };
    await b.api.runDiscovery();
    await vi.waitFor(() => expect(telegram.some((t) => t.method === 'sendMessage')).toBe(true));
    const message = telegram.find((t) => t.method === 'sendMessage')!.body;
    expect(message).toMatchObject({ chat_id: '42', text: expect.stringContaining('Draft ready · 90%') });
    expect(JSON.stringify(message)).not.toContain('this letter stays private');
    expect(message.reply_markup).toEqual({ inline_keyboard: [[expect.objectContaining({ text: 'Approve' }), expect.objectContaining({ text: 'Open' }), expect.objectContaining({ text: 'Skip' })]] });
  });

  it('approves from Telegram exactly as in the app, recorded as sent by you on Telegram, and posts the result', async () => {
    const { api, job } = await emailJob();
    await withTelegram(api);
    telegramUpdates.push({ update_id: 5, callback_query: { id: 'cb', data: `approve:${job.id}`, message: { chat: { id: 42 } } } });
    expect(await (api as Backend).telegramPoll()).toBe(true);
    expect(await api.getJob(job.id)).toMatchObject({ status: 'applied', sentBy: 'you-telegram' });
    expect(telegram.at(-1)).toMatchObject({ method: 'sendMessage', body: { text: 'Sent to jobs@acme.com.' } });
  });

  it('approves a career-site job from Telegram without sending, and brings Applio up on the handoff', async () => {
    const { api, job, deps } = await draftedBackend();
    await withTelegram(api);
    telegramUpdates.push({ update_id: 5, callback_query: { id: 'cb', data: `approve:${job.id}`, message: { chat: { id: 42 } } } });
    await (api as Backend).telegramPoll();
    expect((await api.getJob(job.id)).status).toBe('approved');
    expect(deps.showRoute).toHaveBeenCalledWith(`/handoff/${job.id}`);
    expect(outbox).toEqual([]);
  });

  it('sends a real test message to the saved chat, and never logs the token', async () => {
    const { api } = backendIn();
    await withTelegram(api);
    const logged = vi.spyOn(console, 'error');
    expect(await api.testConnection('telegram')).toEqual({ ok: true, message: 'Test message delivered to Telegram' });
    expect(telegram.at(-1)).toMatchObject({ method: 'sendMessage', body: { chat_id: '42' } });
    expect(JSON.stringify(logged.mock.calls)).not.toContain(TOKEN);
  });

  it('does nothing on Telegram until a token and chat are saved', async () => {
    const { api } = backendIn();
    expect(await (api as Backend).telegramPoll()).toBe(false);
    expect(telegram).toEqual([]);
  });

  /** Plays Claude: reads a pasted post into JSON for analysis, and drafts through the tools when asked. */
  const analyzingBackend = async () => {
    const b = backendIn();
    const fact = await b.api.saveFact({ group: 'Acme', text: 'Built Node APIs' });
    b.deps.engines['claude-code'] = {
      check: async () => ({ ready: true, message: 'ok' }),
      complete: async ({ prompt, jobIds }) => {
        if (prompt.startsWith('Analyze')) {
          return { text: JSON.stringify({ company: 'Brightline Studio', title: 'Senior TypeScript Engineer', location: 'Remote', employmentType: 'contract', salary: null, tags: ['Contract'], roleSummary: 'TypeScript back end.', descriptionSummary: 'Async.', applyEmail: 'hiring@brightline.io', applyUrl: null, score: 84, strengths: [{ text: 'Node APIs', factId: fact.id }], gaps: [] }), inputTokens: 900, outputTokens: 100 };
        }
        const call = (name: string, input: unknown) => createTools(createToolPorts(b.deps.db, jobIds, () => new Date())).find((t) => t.name === name)!.call(input);
        for (const jobId of jobIds) call('save_draft', { jobId, kind: 'cover-letter', headline: 'h', summary: 's', resume: [{ group: 'Acme', items: [{ text: 'Built Node APIs', factId: fact.id }] }], coverLetter: 'Dear team', answers: [] });
        return { text: 'done', inputTokens: 500, outputTokens: 100 };
      },
    };
    return b;
  };

  it('adds a pasted post at once and drafts it in the background, showing it as drafting meanwhile, without sending it', async () => {
    const { api, deps } = await analyzingBackend();
    const preview = await api.analyzeJob({ kind: 'text', value: 'Brightline is hiring a Senior TypeScript Engineer. Email hiring@brightline.io' });
    expect(preview).toMatchObject({ company: 'Brightline Studio', score: 84, channel: 'email', route: 'Sends from your Gmail to hiring@brightline.io', sourceName: 'pasted by you' });
    const job = await api.addJob(preview);
    expect(job).toMatchObject({ sourceId: 'clip', channel: 'email', score: 84 });
    expect(deps.onStatus).toHaveBeenCalledWith(expect.objectContaining({ drafting: [job.id] }));
    // Cleared only once the draft and its files are done.
    await vi.waitFor(() => expect(deps.onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ drafting: [] })));
    expect((await api.getJob(job.id)).status).toBe('drafted');
    expect(outbox).toEqual([]);
  });

  it('reads a public page from a pasted link, and never opens a platform page', async () => {
    const { api } = await analyzingBackend();
    expect((await api.analyzeJob({ kind: 'link', value: 'https://careers.brightline.io/jobs/1' })).sourceName).toBe('from careers.brightline.io');
    expect(pages).toEqual(['https://careers.brightline.io/jobs/1']);
    await expect(api.analyzeJob({ kind: 'link', value: 'https://www.linkedin.com/jobs/view/123' })).rejects.toThrow("Applio doesn't open pages on that site.");
    expect(pages).toHaveLength(1);
  });

  it('takes a post copied from LinkedIn as a platform job, from its text alone', async () => {
    const { api } = await analyzingBackend();
    const preview = await api.analyzeJob({ kind: 'text', value: 'Senior TypeScript Engineer at Brightline. https://www.linkedin.com/jobs/view/123' });
    expect(preview).toMatchObject({ channel: 'platform', sourceName: 'clipped from LinkedIn', maxAutonomy: 'draft' });
    expect(pages).toEqual([]);
    // The link stays with the job, so the handoff can open it and assisted fill can fill it.
    expect(await api.addJob(preview)).toMatchObject({ url: 'https://www.linkedin.com/jobs/view/123', applyUrl: 'https://www.linkedin.com/jobs/view/123', platform: 'LinkedIn' });
  });

  it('refuses to add a job Applio already has, naming it', async () => {
    const { api } = await analyzingBackend();
    const first = await api.addJob(await api.analyzeJob({ kind: 'text', value: 'post' }));
    await vi.waitFor(async () => expect((await api.getJob(first.id)).status).toBe('drafted'));
    const again = await api.analyzeJob({ kind: 'text', value: 'post' });
    expect(again.duplicate).toEqual({ jobId: first.id, status: 'drafted' });
    await expect(api.addJob(again)).rejects.toThrow('Senior TypeScript Engineer at Brightline Studio is already in Applio (drafted).');
  });

  it('adds only what it analyzed, whatever the page sends back', async () => {
    const { api } = await analyzingBackend();
    const preview = await api.analyzeJob({ kind: 'text', value: 'post' });
    const job = await api.addJob({ ...preview, score: 100, company: 'Tampered' });
    expect(job).toMatchObject({ company: 'Brightline Studio', score: 84 });
    await expect(api.addJob({ ...preview, previewId: 'unknown' })).rejects.toThrow('Analyze the post again, then add it.');
  });

  it('fills a platform form in the operator’s own session only when assisted fill is on, and never submits', async () => {
    const { api, job, deps } = await draftedBackend();
    deps.db.prepare("UPDATE jobs SET channel = 'platform', platform = 'LinkedIn', apply_url = 'https://www.linkedin.com/jobs/view/1' WHERE id = ?").run(job.id);
    await expect(api.assistFill(job.id)).rejects.toThrow('Assisted fill is off for platform apply. Turn it on in Settings → Apply channels, or apply by hand.');
    await api.saveSettings({ assistedFill: { platform: true, custom: false } });
    expect(await api.assistFill(job.id)).toEqual({ filled: 5, missing: ['Current company'] });
    expect(deps.fillPlatformForm).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://www.linkedin.com/jobs/view/1' }));
    expect((await api.getJob(job.id)).status).toBe('drafted');
    expect((await api.getJob(job.id)).history.at(-1)?.note).toBe('Assisted fill: 5 fields filled. You check them and click Submit.');
  });

  it('never fills an email or ATS job by assisted fill', async () => {
    const { api, job } = await emailJob();
    await api.saveSettings({ assistedFill: { platform: true, custom: true } });
    await expect(api.assistFill(job.id)).rejects.toThrow('Assisted fill is only for platform and career-site jobs.');
  });

  it('reports real usage: tokens, the split by step, sends and every limit', async () => {
    const { api, job } = await emailJob();
    await api.approveDraft(job.id);
    const usage = await api.getUsage('today');
    // One scoring call and one drafting call, 1,000 tokens each.
    expect(usage.summary).toMatchObject({ tokens: 2000, sent: 1, sentBreakdown: { autonomous: 0, approved: 1, manual: 0 } });
    expect(usage.tokensByStep.find((s) => s.step === 'score')?.tokens).toBe(1000);
    expect(usage.tokensByDay.at(-1)?.tokens).toBe(2000);
    expect(usage.quotas.find((q) => q.id === 'gmail')).toMatchObject({ used: 1, limit: 100 });
    expect(usage.quotas.find((q) => q.id === 'remotive')).toMatchObject({ used: 1, limit: 4 });
  });

  it('resumes AI work as soon as the operator raises a used-up budget, without a restart', async () => {
    const { api, job, deps } = await draftedBackend();
    await api.saveSettings({ dailyTokenBudget: 1000, monthlyTokenBudget: 3_000_000 });
    deps.engines['claude-code'] = { complete: async () => ({ text: '{"told":[],"likelyQuestions":["Q"],"askThem":[]}', inputTokens: 10, outputTokens: 10 }), check: async () => ({ ready: true, message: 'ok' }) };
    await expect(api.getInterviewPrep(job.id)).rejects.toThrow(/budget is used up/);
    await api.saveSettings({ dailyTokenBudget: 100_000 });
    expect((await api.getInterviewPrep(job.id)).likelyQuestions).toEqual(['Q']);
  });

  it('warns on Telegram once when the daily token budget passes 80%', async () => {
    const { api, job, deps } = await draftedBackend();
    await withTelegram(api);
    // 2,000 used of 2,600 is 77%; the next call takes it past 80%.
    await api.saveSettings({ dailyTokenBudget: 2600, monthlyTokenBudget: 3_000_000 });
    deps.engines['claude-code'] = { complete: async () => ({ text: '{"told":[],"likelyQuestions":["Q"],"askThem":[]}', inputTokens: 50, outputTokens: 50 }), check: async () => ({ ready: true, message: 'ok' }) };
    await api.getInterviewPrep(job.id);
    await (api as Backend).tick();
    await vi.waitFor(() => expect(telegram.filter((t) => String(t.body.text).startsWith('Budget · Claude tokens')).length).toBe(1));
  });

  it('serves every API method from real data: the main process never imports the mock', () => {
    for (const file of readdirSync(__dirname).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
      expect(readFileSync(join(__dirname, file), 'utf8'), file).not.toMatch(/shared\/mock/);
    }
  });

  it('keeps a sent application exactly as sent: its letter can no longer be edited', async () => {
    const { api, job } = await emailJob();
    await api.approveDraft(job.id);
    const sentMd = readFileSync(join(job.folderPath!, 'sent.md'), 'utf8');
    await expect(api.updateCoverLetter(job.id, 'A different letter')).rejects.toThrow('This application was already sent, so its letter stays as sent.');
    expect((await api.getDraft(job.id))?.coverLetter).toBe('Dear team');
    expect(readFileSync(join(job.folderPath!, 'sent.md'), 'utf8')).toBe(sentMd);
  });

  it('passes on the command that fixes the engine, so Settings can show it', async () => {
    const { api, deps } = backendIn();
    deps.engines['claude-code'] = { complete: async () => ({ text: '', inputTokens: 0, outputTokens: 0 }), check: async () => ({ ready: false, message: 'Not signed in.', command: 'CLAUDE_CONFIG_DIR="/x" claude auth login' }) };
    expect(await api.testConnection('ai')).toEqual({ ok: false, message: 'Not signed in.', command: 'CLAUDE_CONFIG_DIR="/x" claude auth login' });
  });
});
