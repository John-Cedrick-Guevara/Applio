import { z } from 'zod';
import type { ApplioApi } from './api';
import { AppError } from './errors';
import { EMAIL_PATTERN } from './patterns';
import type {
  ApplyChannel, Autonomy, ConnectionKind, EmploymentType, JobStatus, SecretKey, AiEngine, UsagePeriod,
} from './types';

/**
 * Argument schemas for every API method — main checks each IPC call against
 * these before it reaches a service, because the renderer is untrusted input
 * (CLAUDE.md §2). They sit beside the types in `shared` so both change together.
 */

/** Compile-time check that an enum list names every member of the union, no more. */
const allOf =
  <T extends string>() =>
  <const A extends readonly [T, ...T[]]>(values: A & ([Exclude<T, A[number]>] extends [never] ? unknown : 'missing a value')) =>
    z.enum(values);

const JobStatusSchema = allOf<JobStatus>()([
  'found', 'scored', 'drafted', 'approved', 'applied', 'replied', 'interview', 'offer', 'rejected', 'ghosted', 'skipped',
]);
const ChannelSchema = allOf<ApplyChannel>()(['email', 'ats', 'platform', 'custom']);
const AutonomySchema = allOf<Autonomy>()(['notify', 'draft', 'autonomous']);
const EmploymentTypeSchema = allOf<EmploymentType>()(['full-time', 'contract', 'freelance']);
const SecretKeySchema = allOf<SecretKey>()(['anthropicApiKey', 'gmailAppPassword', 'telegramBotToken']);
const AiEngineSchema = allOf<AiEngine>()(['claude-code', 'api-key']);
const PeriodSchema = allOf<UsagePeriod>()(['today', 'month']);
const ConnectionSchema = allOf<ConnectionKind>()(['gmail', 'telegram', 'ai']);

const id = z.string().min(1, "id can't be empty").max(100, 'id is too long');
/** A label or one-line field. */
const short = z.string().max(500, 'is too long (500 characters max)');
/** A letter, posting or note body. */
const long = z.string().max(50_000, 'is too long (50,000 characters max)');
const url = z.string().max(2048, 'is too long (2,048 characters max)');
/** A link printed on a résumé: only http(s), so nothing else can become a hyperlink in the PDF. */
const webUrl = url.regex(/^https?:\/\/[^\s]+$/i, 'must be a web link (https://…)');
const score = z.number().finite().min(0).max(100);
const count = (max: number) => z.number().int().min(0).max(max);
const list = <T extends z.ZodType>(item: T, max = 200) => z.array(item).max(max, 'has too many items');

const JobFilterSchema = z.strictObject({
  statuses: list(JobStatusSchema, 20).optional(),
  minScore: score.optional(),
  search: short.optional(),
});

const JobPreviewSchema = z.strictObject({
  previewId: id,
  company: short,
  title: short,
  sourceName: short,
  tags: list(short, 50),
  score,
  summary: long,
  channel: ChannelSchema.nullable(),
  channelLabel: short,
  route: short,
  applyTarget: url,
  maxAutonomy: AutonomySchema,
  tokensUsed: count(10_000_000),
  duplicate: z.strictObject({ jobId: id, status: JobStatusSchema }).optional(),
});

const PreferencesSchema = z.strictObject({
  targetRoles: list(short, 50),
  seniority: short,
  employmentTypes: list(EmploymentTypeSchema, 3),
  remoteOnly: z.boolean(),
  hoursOverlap: short,
  minimumPay: short,
});

/** Everything `saveSettings` may patch. `secretsSet` is derived in main, never written by the page. */
const SettingsPatchSchema = z.strictObject({
  outputFolder: z.string().min(1).max(1024).optional(),
  fullName: z.string().trim().max(120).optional(),
  aiEngine: AiEngineSchema.optional(),
  gmailAddress: z.union([z.literal(''), z.string().max(320).regex(EMAIL_PATTERN, 'is not an email address')]).optional(),
  telegramChatId: short.optional(),
  assistedFill: z.strictObject({ platform: z.boolean(), custom: z.boolean() }).optional(),
  followUpDays: z.number().int().min(1).max(90).optional(),
  draftThreshold: score.optional(),
  autoSendThreshold: score.optional(),
  maxPerChannelPerDay: count(10_000).optional(),
  dailyTokenBudget: z.number().int().min(1).max(100_000_000).optional(),
  monthlyTokenBudget: z.number().int().min(1).max(3_000_000_000).optional(),
  launchAtLogin: z.boolean().optional(),
  blocklist: list(short, 1000).optional(),
});

const none = z.tuple([]);

type ArgsSchemas = { [M in keyof ApplioApi]: z.ZodType<Parameters<ApplioApi[M]>> };

/** One tuple schema per API method: the exact arguments it accepts, nothing extra. */
export const API_ARGS = {
  listJobs: z.tuple([JobFilterSchema.optional()]),
  getJob: z.tuple([id]),
  getDraft: z.tuple([id]),
  getSend: z.tuple([id]),
  updateCoverLetter: z.tuple([id, long]),
  approveDraft: z.tuple([id]),
  draftJob: z.tuple([id]),
  redraft: z.tuple([id]),
  saveDraftFiles: z.tuple([id]),
  skipJob: z.tuple([id]),
  markApplied: z.tuple([id]),
  setStatus: z.tuple([id, JobStatusSchema, short.optional()]),
  sendFollowUp: z.tuple([id, z.string().min(1, "can't be empty").max(10_000, 'is too long (10,000 characters max)')]),
  getInterviewPrep: z.tuple([id]),

  getStatus: none,
  runDiscovery: none,
  setAutomationPaused: z.tuple([z.boolean()]),

  openExternal: z.tuple([url]),
  openJobFolder: z.tuple([id]),
  openDraftFile: z.tuple([id, z.enum(['resume', 'letter'])]),
  assistFill: z.tuple([id]),
  chooseFolder: none,
  openOutputFolder: none,

  analyzeJob: z.tuple([z.strictObject({ kind: z.enum(['text', 'link']), value: long })]),
  addJob: z.tuple([JobPreviewSchema]),

  getProfile: none,
  saveFact: z.tuple([z.strictObject({ id: id.optional(), group: short.min(1, "can't be empty"), text: z.string().min(1, "can't be empty").max(2000, 'is too long (2,000 characters max)') })]),
  deleteFact: z.tuple([id]),
  saveAnswer: z.tuple([z.strictObject({ id: id.optional(), question: z.string().min(1, "can't be empty").max(1000, 'is too long'), answer: z.string().min(1, "can't be empty").max(10_000, 'is too long') })]),
  deleteAnswer: z.tuple([id]),
  savePreferences: z.tuple([PreferencesSchema]),
  listQuestions: none,
  answerQuestions: z.tuple([id, z.array(z.strictObject({
    question: z.string().min(1).max(300, 'is too long'), answer: z.string().trim().min(1, "can't be empty").max(2000, 'is too long'),
    saveTo: short.min(1).optional(),
  })).min(1).max(5)]),
  saveContact: z.tuple([z.strictObject({
    phone: z.string().max(60, 'is too long'), location: short, education: short, notes: z.string().max(4000, 'is too long'),
    links: z.array(z.strictObject({ label: z.string().max(60, 'is too long'), url: webUrl })).max(10, 'has too many links (10 max)'),
  })]),
  saveFactGroup: z.tuple([z.strictObject({
    name: short.min(1, "can't be empty"), dates: z.string().max(80, 'is too long').optional(),
    kind: z.enum(['experience', 'project', 'skills', 'certifications', 'other']).optional(),
    context: short.optional(), link: z.union([z.literal(''), webUrl]).optional(),
  })]),
  importResume: none,

  listSources: none,
  updateSource: z.tuple([id, z.strictObject({ enabled: z.boolean().optional(), autonomy: AutonomySchema.optional() })]),

  getUsage: z.tuple([PeriodSchema]),

  getSettings: none,
  saveSettings: z.tuple([SettingsPatchSchema]),
  setSecret: z.tuple([SecretKeySchema, z.string().min(1, "can't be empty").max(4096, 'is too long')]),
  testConnection: z.tuple([ConnectionSchema]),
} satisfies ArgsSchemas;

/** A renderer call whose arguments don't match the method's schema. Its message never quotes the value. */
export class InvalidRequestError extends AppError {
  constructor(
    readonly method: string,
    readonly issues: readonly { path: string; message: string }[],
  ) {
    super('INVALID_REQUEST', `Applio couldn't do that: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  }
}

/** "argument 1", or the field path inside an object argument ("minScore", "tags.3"). */
const describePath = (path: readonly PropertyKey[]) =>
  path.length > 1 ? path.slice(1).map(String).join('.') : path.length === 1 ? `argument ${Number(path[0]) + 1}` : 'arguments';

/**
 * Checks a call's arguments against its method's schema.
 * @returns The parsed arguments, safe to pass to the backend.
 * @throws InvalidRequestError listing each problem by path, without the offending values.
 */
export function parseApiArgs<M extends keyof ApplioApi>(method: M, args: unknown[]): Parameters<ApplioApi[M]> {
  const result = (API_ARGS[method] as unknown as z.ZodType<Parameters<ApplioApi[M]>>).safeParse(args);
  if (result.success) return result.data;
  throw new InvalidRequestError(
    method,
    result.error.issues.map((i) => ({ path: describePath(i.path), message: i.message })),
  );
}
