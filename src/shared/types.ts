/**
 * Domain types shared by the main process, the preload bridge and the renderer.
 * Field names mirror SPEC.md so features map 1:1 to the data they show.
 */

/** Application lifecycle (SPEC F7). `skipped` is the operator dismissing a match. */
export type JobStatus =
  | 'found'
  | 'scored'
  | 'drafted'
  | 'approved'
  | 'applied'
  | 'replied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'ghosted'
  | 'skipped';

/** Apply channels detected from the posting (SPEC F5). */
export type ApplyChannel = 'email' | 'ats' | 'platform' | 'custom';

/** How far automation may go for a source (SPEC F6), ordered least → most autonomous. */
export type Autonomy = 'notify' | 'draft' | 'autonomous';

export type EmploymentType = 'full-time' | 'contract' | 'freelance';

/** One entry in a job's status history; drives the brain timeline. */
export interface StatusEvent {
  status: JobStatus;
  at: string; // ISO timestamp
  note?: string;
}

/** A discovered job and everything the pipeline has learned about it. */
export interface Job {
  id: string;
  sourceId: string;
  /** Human source label for lists, e.g. "RemoteOK" or "clipped from LinkedIn". */
  sourceName: string;
  company: string;
  title: string;
  url: string;
  location: string;
  salary?: string;
  employmentType: EmploymentType;
  postedAt: string;
  status: JobStatus;
  channel: ApplyChannel;
  description: string;
  /** AI match score 0–100; absent until scored. */
  score?: number;
  roleSummary?: string;
  descriptionSummary?: string;
  /** Short facets shown as tags: location/hours, type, pay, stack. */
  tags: string[];
  /** Fact-bank strengths that match the posting (the "Fit" list). */
  strengths: string[];
  gaps: string[];
  /** Where the application goes: an email address, ATS host, or platform flow. */
  applyTarget: string;
  /** Platform name for handoff copy, e.g. "LinkedIn" or "Upwork". */
  platform?: string;
  /** Number of fact-bank entries the draft draws on. */
  factsUsed: number;
  tokensUsed: number;
  folderPath?: string;
  /** Who sent it, once sent. */
  sentBy?: SentBy;
  history: StatusEvent[];
}

/** How an application went out: on its own, or approved by the operator somewhere. */
export type SentBy = 'autonomous' | 'you-app' | 'you-telegram' | 'you-manual';

/** Generated prep for a reply or interview (SPEC F7). */
export interface InterviewPrep {
  /** Claims the operator made in what was sent — be ready to back them up. */
  told: string[];
  likelyQuestions: string[];
  askThem: string[];
  tokens: number;
}

/** Where a suggested form answer came from — the bank is free, AI costs tokens. */
export type AnswerOrigin = 'bank' | 'ai';

export interface SuggestedAnswer {
  question: string;
  answer: string;
  origin: AnswerOrigin;
  /** Tokens spent writing it; 0 for answer-bank reuse. */
  tokens: number;
}

/** Tailored resume as structured data; every bullet cites the fact it came from. */
export interface ResumeSection {
  heading: string;
  items: { text: string; factId: string }[];
}

/** Generated application materials awaiting approval (SPEC F4). */
export interface Draft {
  jobId: string;
  /** Freelance gigs get a proposal instead of a cover letter. */
  kind: 'cover-letter' | 'proposal';
  headline: string;
  summary: string;
  resume: ResumeSection[];
  coverLetter: string;
  /** True once the operator edited the generated letter. */
  edited: boolean;
  answers: SuggestedAnswer[];
  createdAt: string;
}

/** A verified fact about the operator — the only material AI may draw from. */
export interface Fact {
  id: string;
  /** Role or section it belongs to, e.g. "[Company] — Senior Engineer" or "Projects". */
  group: string;
  text: string;
  tags: string[];
  /** How many drafts have cited it. */
  timesUsed: number;
}

/** A fact-bank section, in display order. */
export interface FactGroup {
  name: string;
  dates?: string;
}

/** A saved answer to a recurring application-form question. */
export interface Answer {
  id: string;
  question: string;
  answer: string;
  /** "ai" = written by AI for a form, then approved and saved by the operator. */
  origin: 'you' | 'ai';
  timesReused: number;
}

export interface Preferences {
  targetRoles: string[];
  seniority: string;
  employmentTypes: EmploymentType[];
  remoteOnly: boolean;
  /** Required working-hours overlap, free text, e.g. "At least 4h with UTC−5 to UTC+2". */
  hoursOverlap: string;
  /** Minimum pay, free text so it can cover salary and hourly rates. */
  minimumPay: string;
}

export interface ReferenceResume {
  fileName: string;
  uploadedAt: string;
  /** Candidate facts found in it; each one joins the bank only once the operator accepts it. */
  factsFound: number;
}

/** A line from an imported résumé offered as a fact, copied verbatim. */
export interface FactSuggestion {
  group: string;
  text: string;
}

/** Result of importing a résumé: the reference card, plus facts waiting for the operator to accept. */
export interface ResumeImport {
  resume: ReferenceResume;
  suggestions: FactSuggestion[];
}

export interface Profile {
  facts: Fact[];
  factGroups: FactGroup[];
  skills: string[];
  answers: Answer[];
  preferences: Preferences;
  referenceResume?: ReferenceResume;
}

export type SourceKind = 'board' | 'ats-watchlist' | 'api' | 'clip';

/** A job source and its operator-chosen autonomy (SPEC F2, F6). */
export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  enabled: boolean;
  autonomy: Autonomy;
  /** How it's fetched, shown under the name, e.g. "Public JSON API · 4 polls a day". */
  via: string;
  /** Ceiling for this source; clipped and Upwork jobs are never autonomous. */
  maxAutonomy?: Autonomy;
  lastPolledAt?: string;
}

/** One free-limit counter from the quota table (SPEC F10). */
export interface Quota {
  id: string;
  label: string;
  /** What the limit counts, e.g. "Polls per day". */
  sub: string;
  used: number;
  limit: number;
  /** Fraction of `limit` (0–1) at which to warn. */
  warnAt: number;
  unit: string;
  /** Optional sources that are switched off. */
  off?: boolean;
  /** Friendlier wording for an expected daily stop, e.g. "Done for today". */
  doneLabel?: string;
}

export type UsagePeriod = 'today' | 'month';

export type UsageStep = 'tailor' | 'score' | 'answers' | 'prep' | 'follow-up';

/** Headline numbers for the usage tiles. */
export interface UsageSummary {
  tokens: number;
  tokenBudget: number;
  sent: number;
  /** Daily send cap across channels; absent for the monthly view. */
  sentLimit?: number;
  sentBreakdown: { autonomous: number; approved: number; manual: number };
  avgTokensPerApplication: number;
  avgNote: string;
  savedByAnswerBank: { tokens: number; answersReused: number };
}

export interface Usage {
  period: UsagePeriod;
  summary: UsageSummary;
  tokensByStep: { step: UsageStep; tokens: number }[];
  /** Last 7 days, oldest first. */
  tokensByDay: { date: string; tokens: number }[];
  dailyTokenBudget: number;
  quotas: Quota[];
}

export type AiEngine = 'claude-code' | 'api-key';

/** Names of secrets the renderer may set but never read back. */
export type SecretKey = 'anthropicApiKey' | 'gmailAppPassword' | 'telegramBotToken';

/** Non-secret settings. Secrets are represented only by whether they are set. */
export interface Settings {
  outputFolder?: string;
  aiEngine: AiEngine;
  gmailAddress: string;
  telegramChatId: string;
  /** Assisted fill per channel (SPEC F5 channels 3–4) — off means manual handoff. */
  assistedFill: { platform: boolean; custom: boolean };
  followUpDays: number;
  /** Jobs scoring at or above this get a tailored draft. */
  draftThreshold: number;
  /** Autonomous sources send on their own at or above this. */
  autoSendThreshold: number;
  maxPerChannelPerDay: number;
  dailyTokenBudget: number;
  /** Companies never applied to (SPEC F6). */
  blocklist: string[];
  secretsSet: Record<SecretKey, boolean>;
}

export type ConnectionKind = 'gmail' | 'telegram' | 'ai';

/** Outcome of one discovery run, shown in the Review header. */
export interface RunSummary {
  at: string;
  found: number;
  newAfterDedup: number;
  passedFilters: number;
  drafted: number;
}

/** Engine and scheduler state for the sidebar card and Review header. */
export interface AppStatus {
  engine: AiEngine;
  /** False when the API-key engine is selected but no key is saved. */
  engineReady: boolean;
  paused: boolean;
  nextRunAt?: string;
  tokensToday: number;
  dailyTokenBudget: number;
  lastRun?: RunSummary;
}

/** What "Add job" learned from a pasted post or link, before it joins the queue. */
export interface JobPreview {
  company: string;
  title: string;
  sourceName: string;
  tags: string[];
  score: number;
  summary: string;
  /** Null when no apply route was found in the post. */
  channel: ApplyChannel | null;
  channelLabel: string;
  /** How Applio will apply, in words. */
  route: string;
  applyTarget: string;
  maxAutonomy: Autonomy;
  tokensUsed: number;
}

export type JobInput = { kind: 'text' | 'link'; value: string };
