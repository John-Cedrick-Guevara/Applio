import type {
  Answer,
  AppStatus,
  ConnectionKind,
  Draft,
  Fact,
  InterviewPrep,
  Job,
  JobInput,
  JobPreview,
  JobStatus,
  Preferences,
  Profile,
  Contact,
  OpenQuestions,
  QuestionAnswer,
  FactExtraction,
  FactGroup,
  FactSource,
  ResumeImport,
  RunSummary, ScanOptions,
  SecretKey,
  SendRecord,
  Settings,
  Source,
  Usage,
  UsagePeriod,
} from './types';

/** Filter accepted by `listJobs`; all fields are optional and AND-ed. */
export interface JobFilter {
  statuses?: JobStatus[];
  minScore?: number;
  search?: string;
}

/**
 * The full surface the renderer may call. Implemented by the preload bridge
 * (`window.applio`) in Electron and by an in-memory mock during UI development.
 * The renderer never touches the DB, network or secrets directly — only this.
 *
 * Rejected promises carry an operator-readable `Error.message`; implementations
 * log technical detail on their side and never put secrets in messages.
 */
export interface ApplioApi {
  // Jobs & drafts (SPEC F3–F5)
  listJobs(filter?: JobFilter): Promise<Job[]>;
  getJob(id: string): Promise<Job>;
  getDraft(jobId: string): Promise<Draft | null>;
  /** The job's send log: exactly what went out, or a send that never finished. Null when Applio never sent it. */
  getSend(jobId: string): Promise<SendRecord | null>;
  updateCoverLetter(jobId: string, coverLetter: string): Promise<Draft>;
  /** Approves a draft; the main process sends it if the channel allows, else hands off. */
  approveDraft(jobId: string): Promise<Job>;
  /** Drafts a scored job the operator chose, below the threshold or not, in the background. @returns The job as it is now (still scored). */
  draftJob(jobId: string): Promise<Job>;
  /** Scores one job a scan left unscored, now, through the quota guard. @returns The scored job. @throws When it isn't unscored, the budget is used up, or scoring failed. */
  scoreJob(jobId: string): Promise<Job>;
  /** Drops a waiting draft and drafts the job again from the current profile, in the background. */
  redraft(jobId: string): Promise<Job>;
  /** Prints a draft's résumé and letter again (no AI, no tokens), after a failed save. @throws when the job has no draft or printing fails. */
  saveDraftFiles(jobId: string): Promise<Job>;
  skipJob(jobId: string): Promise<Job>;
  /** Takes a skipped job out of the Trash, back to the status it had before the skip. @throws When the job isn't in the Trash. */
  restoreJob(jobId: string): Promise<Job>;
  /** Logs an application the operator submitted themselves (manual handoff). */
  markApplied(jobId: string): Promise<Job>;
  setStatus(jobId: string, status: JobStatus, note?: string): Promise<Job>;
  /** Sends an operator-approved follow-up email and logs it on the timeline. */
  sendFollowUp(jobId: string, text: string): Promise<Job>;
  getInterviewPrep(jobId: string): Promise<InterviewPrep>;

  // Automation (SPEC F2, F6)
  getStatus(): Promise<AppStatus>;
  /** Runs a scan now (or joins the one running): the chosen sources, drafting only when asked (SPEC F2). */
  runDiscovery(options?: ScanOptions): Promise<RunSummary>;
  /** Asks the running scan to stop after its current phase; what it found is kept. */
  stopScan(): Promise<void>;
  /** Pauses or resumes auto-sends. Scans and drafts still work while paused. */
  setAutomationPaused(paused: boolean): Promise<AppStatus>;

  // OS integration
  openExternal(url: string): Promise<void>;
  openJobFolder(jobId: string): Promise<void>;
  /**
   * Assisted fill (SPEC F5 channels 3–4): opens the platform or career-site form in an
   * Applio window with the operator's own sign-in and fills what it can. Never submits.
   */
  assistFill(jobId: string): Promise<{ filled: number; missing: string[] }>;
  /** Opens the job's résumé or letter (PDF, or proposal.md) in the system viewer. */
  openDraftFile(jobId: string, file: 'resume' | 'letter'): Promise<void>;
  chooseFolder(): Promise<string | null>;
  openOutputFolder(): Promise<void>;

  // Add job (clip / paste, SPEC F2)
  /** Reads and scores a pasted post or link without saving it. */
  analyzeJob(input: JobInput): Promise<JobPreview>;
  /** Adds an analyzed job to the review queue and starts drafting. */
  addJob(preview: JobPreview): Promise<Job>;

  // Profile (SPEC F1)
  getProfile(): Promise<Profile>;
  saveFact(fact: Pick<Fact, 'group' | 'text'> & { id?: string }): Promise<Fact>;
  deleteFact(id: string): Promise<void>;
  saveAnswer(answer: Pick<Answer, 'question' | 'answer'> & { id?: string }): Promise<Answer>;
  deleteAnswer(id: string): Promise<void>;
  savePreferences(preferences: Preferences): Promise<Preferences>;
  /** Jobs waiting on the operator's answers to Claude's questions, oldest first. */
  listQuestions(): Promise<OpenQuestions[]>;
  /**
   * Answers Claude's questions for a job and drafts it again with them. Answers with
   * `saveTo` become facts in that section; the rest are used for this job only.
   */
  answerQuestions(jobId: string, answers: QuestionAnswer[]): Promise<Job>;
  /** Résumé header and sign-off details (phone, location, links, education, notes for Claude). */
  saveContact(contact: Contact): Promise<Contact>;
  /** Updates a fact-bank section's kind, dates, context and link; returns every section in order. */
  saveFactGroup(group: FactGroup): Promise<FactGroup[]>;
  /** Replaces the skill list (trimmed, blanks and case-insensitive duplicates dropped); returns what was stored. */
  saveSkills(skills: string[]): Promise<string[]>;
  /**
   * Reads pasted résumé or portfolio text, or one portfolio link (Claude Code reads it itself), into
   * suggested facts. Adds nothing to the bank; each suggestion joins it only when the operator accepts it.
   * Spends tokens through the quota guard. Rejects with the reason and next step when it can't run.
   */
  extractFacts(source: FactSource): Promise<FactExtraction>;
  /**
   * Opens a file picker in main, reads the chosen PDF/DOCX résumé and suggests facts from it; null if cancelled.
   * Suggestions join the bank only when the operator accepts each one (via `saveFact`).
   */
  importResume(): Promise<ResumeImport | null>;

  // Sources & guardrails (SPEC F2, F6)
  listSources(): Promise<Source[]>;
  updateSource(id: string, patch: Partial<Pick<Source, 'enabled' | 'autonomy'>>): Promise<Source>;

  // Usage (SPEC F10)
  getUsage(period: UsagePeriod): Promise<Usage>;

  // Settings
  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Omit<Settings, 'secretsSet' | 'checks'>>): Promise<Settings>;
  /** Write-only: secrets go to the OS keychain and are never returned. */
  setSecret(key: SecretKey, value: string): Promise<Settings>;
  /** `command`: a terminal command that fixes it, when there is one (signing in Applio's Claude Code profile). */
  testConnection(kind: ConnectionKind): Promise<{ ok: boolean; message: string; command?: string }>;
}

/**
 * Every method the preload bridge exposes. The bridge forwards only these
 * names over IPC, so this list is the renderer's entire reach into main.
 */
export const API_METHODS = [
  'listJobs', 'getJob', 'getDraft', 'getSend', 'updateCoverLetter', 'approveDraft', 'draftJob', 'scoreJob', 'redraft', 'saveDraftFiles', 'skipJob', 'restoreJob', 'markApplied', 'setStatus',
  'sendFollowUp', 'getInterviewPrep',
  'getStatus', 'runDiscovery', 'stopScan', 'setAutomationPaused',
  'openExternal', 'openJobFolder', 'openDraftFile', 'assistFill', 'chooseFolder', 'openOutputFolder',
  'analyzeJob', 'addJob',
  'getProfile', 'saveFact', 'deleteFact', 'saveAnswer', 'deleteAnswer', 'savePreferences', 'listQuestions', 'answerQuestions', 'saveContact', 'saveFactGroup', 'saveSkills', 'extractFacts', 'importResume',
  'listSources', 'updateSource',
  'getUsage',
  'getSettings', 'saveSettings', 'setSecret', 'testConnection',
] as const satisfies readonly (keyof ApplioApi)[];

/** Compile-time check that API_METHODS lists every ApplioApi method. */
type UnlistedMethod = Exclude<keyof ApplioApi, (typeof API_METHODS)[number]>;
export const API_METHODS_COMPLETE: UnlistedMethod extends never ? true : UnlistedMethod = true;

/** Pushes from main. Separate from `ApplioApi` because nothing here is a request. */
export interface ApplioEvents {
  /** Calls `listener` with each new status; returns the unsubscribe function. */
  onStatus(listener: (status: AppStatus) => void): () => void;
}

declare global {
  interface Window {
    /** Exposed by the preload script via contextBridge; absent in browser dev. */
    applio?: ApplioApi;
    applioEvents?: ApplioEvents;
  }
}
