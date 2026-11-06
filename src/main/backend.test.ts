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
import { createSecretStore, type Encryptor } from '../infra/secrets/secret-store';
import { seedJobs } from '../shared/mock/fixtures';
import { createToolPorts } from '../mcp/db-ports';
import { createTools } from '../mcp/tools';
import { createBackend, type BackendDeps } from './backend';

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

/** Messages "sent" through the fake SMTP transport, newest last. */
let outbox: { to?: unknown; subject?: unknown; text?: unknown; attachments?: unknown }[] = [];
beforeEach(() => (outbox = []));

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
    mailTransport: () => ({ sendMail: async (m) => void outbox.push(m) }),
    // Stands in for Applio's form window: "submits" and reports what it filled.
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
    // The dropped job isn't stored, so it's new again and dropped again, for free.
    expect(await api.runDiscovery()).toMatchObject({ found: 2, newAfterDedup: 1, passedFilters: 0 });
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
    // Stands in for Claude calling save_match through the tools.
    const complete = vi.fn(async ({ jobIds }: { jobIds: readonly string[] }) => {
      for (const id of jobIds) createJobsRepo(deps.db).saveMatch(id, { score: 60, roleSummary: 'APIs', descriptionSummary: 'Remote', strengths: [], gaps: [] });
      return { text: 'done', inputTokens: 900, outputTokens: 100 };
    });
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
      for (const jobId of jobIds) {
        if (prompt.startsWith('Score')) call('save_match', { jobId, score: 90, roleSummary: 'APIs', descriptionSummary: 'Remote', strengths: [{ text: 'Fast APIs', factId: fact.id }], gaps: [] });
        else call('save_draft', { jobId, kind: 'cover-letter', headline: 'h', summary: 's', resume: [{ heading: 'Acme', items: [{ text: 'Cut latency 40%', factId: fact.id }] }], coverLetter: 'Dear team', answers: [] });
      }
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

  it('says plainly when there is no draft to edit', async () => {
    const { api } = backendIn();
    await expect(api.updateCoverLetter('nope', 'x')).rejects.toThrow('No draft for job nope');
  });

  /** A backend that has run once and drafted one job, with Claude played through the real tools. */
  const draftedBackend = async () => {
    const b = await searchingBackend();
    await b.api.saveSettings({ fullName: 'Sam Rivera' });
    const fact = await b.api.saveFact({ group: 'Acme — Engineer', text: 'Cut API latency 40%' });
    b.deps.engines['claude-code'] = {
      check: async () => ({ ready: true, message: 'ok' }),
      complete: async ({ prompt, jobIds }) => {
        const tools = createTools(createToolPorts(b.deps.db, jobIds, () => new Date()));
        const call = (name: string, input: unknown) => tools.find((t) => t.name === name)!.call(input);
        for (const jobId of jobIds) {
          if (prompt.startsWith('Score')) call('save_match', { jobId, score: 90, roleSummary: 'APIs', descriptionSummary: 'Remote', strengths: [{ text: 'Fast APIs', factId: fact.id }], gaps: [] });
          else call('save_draft', { jobId, kind: 'cover-letter', headline: 'Backend engineer', summary: 's', resume: [{ heading: 'Acme', items: [{ text: 'Cut latency 40%', factId: fact.id }] }], coverLetter: 'Dear team', answers: [] });
        }
        return { text: 'done', inputTokens: 900, outputTokens: 100 };
      },
    };
    await b.api.runDiscovery();
    const [job] = await b.api.listJobs({ statuses: ['drafted'] });
    return { ...b, job: job! };
  };

  it('writes the résumé and letter PDFs and job.md into the month folder, with the name on them', async () => {
    const { job, deps } = await draftedBackend();
    expect(job.folderPath).toMatch(/Applio\/\d{4}-\d{2}\/Acme — Senior Backend Engineer \(90%\)$/);
    expect(readdirSync(job.folderPath!).sort()).toEqual(['cover-letter.pdf', 'job.md', 'resume.pdf']);
    expect(readFileSync(join(job.folderPath!, 'resume.pdf'), 'utf8')).toContain('<h1>Sam Rivera</h1>');
    expect(readFileSync(join(job.folderPath!, 'job.md'), 'utf8')).toContain(`applio_job_id: ${job.id}`);
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
        for (const jobId of jobIds) {
          if (prompt.startsWith('Score')) call('save_match', { jobId, score: 90, roleSummary: 'r', descriptionSummary: 'd', strengths: [], gaps: [] });
          else call('save_draft', { jobId, kind: 'cover-letter', headline: 'h', summary: 's', resume: [{ heading: 'A', items: [{ text: 'Shipped APIs', factId: fact.id }] }], coverLetter: 'Hi', answers: [] });
        }
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
    expect(outbox[0]).toMatchObject({ to: 'jobs@acme.com', subject: 'Application: Senior Backend Engineer — Sam Rivera', text: 'Dear team' });
    expect(readFileSync(join(job.folderPath!, 'sent.md'), 'utf8')).toContain('To: jobs@acme.com');
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
});
