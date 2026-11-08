import { DEFAULT_SOURCES } from '../defaults';
import type {
  Draft,
  Job,
  JobStatus,
  Profile,
  RunSummary,
  Settings,
  Source,
  Usage,
  UsagePeriod,
  UsageStep,
} from '../types';

/**
 * Seed data for the mock API. Realistic enough to exercise every view and
 * status, small enough to read. Timestamps are relative to `now` so the UI
 * always shows fresh-looking data.
 */

const hoursAgo = (now: Date, h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

/** Builds a status history that walks the pipeline up to `status`. */
function historyTo(now: Date, status: JobStatus, startHoursAgo: number): Job['history'] {
  const flow: JobStatus[] = ['found', 'scored', 'drafted', 'approved', 'applied', 'replied', 'interview', 'offer'];
  const end = flow.indexOf(status);
  // Closed applications were sent first; skipped jobs never got past scoring.
  const steps: JobStatus[] =
    end !== -1 ? flow.slice(0, end + 1)
    : status === 'skipped' ? ['found', 'scored', 'skipped']
    : [...flow.slice(0, flow.indexOf('applied') + 1), status];
  return steps.map((s, i) => ({ status: s, at: hoursAgo(now, startHoursAgo - i * 2) }));
}

type JobSeed = Pick<Job, 'id' | 'sourceId' | 'sourceName' | 'company' | 'title' | 'channel' | 'status' | 'applyTarget'> &
  Partial<Pick<Job, 'sentBy' | 'score' | 'salary' | 'employmentType' | 'platform' | 'tags' | 'strengths' | 'gaps' | 'roleSummary' | 'description' | 'factsUsed' | 'tokensUsed'>> & {
    hoursAgo: number;
  };

const JOB_SEEDS: JobSeed[] = [
  {
    id: 'j1', sourceId: 'remoteok', sourceName: 'RemoteOK', company: 'Northwind Labs', title: 'Senior Backend Engineer',
    channel: 'email', status: 'drafted', applyTarget: 'jobs@northwind-labs.example', score: 88, hoursAgo: 2, factsUsed: 12, tokensUsed: 18_200,
    tags: ['Remote · UTC−5 to UTC+2', 'Full-time', '$120k–150k', 'Node.js · PostgreSQL · AWS'],
    roleSummary: 'Own the billing and usage-metering services for a B2B analytics product. Team of six engineers, async-first, on-call one week in six.',
    strengths: ['5 years Node.js / TypeScript in production', 'PostgreSQL schema design and query tuning', 'AWS: ECS, RDS, SQS'],
    gaps: ['Kafka is listed; nothing in your fact bank covers it'],
    description: 'Senior Backend Engineer — Northwind Labs\nRemote (UTC−5 to UTC+2) · Full-time · $120k–150k\n\nYou will own billing and usage metering for our analytics platform.\n\nRequirements\n• 5+ years backend experience (Node.js or Go)\n• Strong PostgreSQL\n• AWS in production\n• Kafka or similar streaming (nice to have)\n\nApply: email jobs@northwind-labs.example with your resume.',
  },
  {
    id: 'j2', sourceId: 'himalayas', sourceName: 'Himalayas', company: 'Fieldwork', title: 'Full-stack Engineer (TypeScript)',
    channel: 'ats', status: 'drafted', applyTarget: 'boards.greenhouse.io/fieldwork', score: 82, hoursAgo: 5, factsUsed: 10, tokensUsed: 14_600,
    tags: ['Remote · Worldwide', 'Full-time', '$95k–125k', 'React · Node.js'],
    roleSummary: 'Build scheduling and dispatch tools for field-service teams. Product-minded full-stack role; you ship features end to end.',
    strengths: ['React + TypeScript front ends', 'Node.js APIs', 'Shipped features solo, end to end'],
    gaps: ['GraphQL: one small project only'],
    description: 'Full-stack Engineer (TypeScript) — Fieldwork\nRemote · Worldwide · $95k–125k\n\nWe build scheduling and dispatch software for field-service teams.\n\nApply through our Greenhouse page.',
  },
  {
    id: 'j3', sourceId: 'clip', sourceName: 'clipped from LinkedIn', company: 'Ledgerly', title: 'Platform Engineer',
    channel: 'platform', status: 'drafted', applyTarget: 'LinkedIn Easy Apply', platform: 'LinkedIn', score: 79, hoursAgo: 26, factsUsed: 9, tokensUsed: 12_900,
    employmentType: 'contract',
    tags: ['Remote · EMEA hours', 'Contract, 12 months', 'Kubernetes · Terraform'],
    roleSummary: 'Run and improve the Kubernetes platform behind a fintech ledger API. Heavy on Terraform, observability and CI.',
    strengths: ['4 years Kubernetes in production', 'Terraform for all infrastructure', 'CI/CD on GitHub Actions'],
    gaps: ['EMEA hours: 5h overlap from your time zone'],
    description: 'Platform Engineer — Ledgerly\nRemote (EMEA hours) · 12-month contract\n\nApply with LinkedIn Easy Apply.',
  },
  {
    id: 'j4', sourceId: 'upwork', sourceName: 'Upwork API', company: 'Upwork client', title: 'Electron desktop app MVP',
    channel: 'platform', status: 'drafted', applyTarget: 'Upwork proposal · costs 16 Connects', platform: 'Upwork', score: 76, hoursAgo: 1, factsUsed: 7, tokensUsed: 9_800,
    employmentType: 'freelance',
    tags: ['Fixed price · $4,000', 'Payment verified', 'Client 4.9 · 23 hires'],
    roleSummary: 'Build a cross-platform Electron app that syncs a local SQLite database with an existing REST API. Six-week timeline.',
    strengths: ['Shipped two Electron apps', 'SQLite sync with REST backends'],
    gaps: ['Asks for code signing on Windows; not in your fact bank'],
    description: 'Electron desktop app MVP\nFixed price $4,000 · 6 weeks\n\nNeed a desktop app that syncs SQLite with our REST API.',
  },
  { id: 'j5', sourceId: 'remotive', sourceName: 'Remotive', company: 'Orbital Health', title: 'Senior Software Engineer, Platform', channel: 'ats', status: 'scored', applyTarget: 'jobs.lever.co/orbital', score: 67, hoursAgo: 3, gaps: ['Healthcare compliance (HIPAA)'] },
  { id: 'j6', sourceId: 'jobicy', sourceName: 'Jobicy', company: 'Fernwood', title: 'Frontend Developer', channel: 'email', status: 'found', applyTarget: 'hiring@fernwood.example', hoursAgo: 1 },
  { id: 'j7', sentBy: 'you-app', sourceId: 'ats', sourceName: 'Lever watchlist', company: 'Quanta Robotics', title: 'Software Engineer II', channel: 'ats', status: 'applied', applyTarget: 'jobs.lever.co/quanta', score: 86, hoursAgo: 50 },
  { id: 'j8', sentBy: 'you-telegram', sourceId: 'remoteok', sourceName: 'RemoteOK', company: 'Paperplane', title: 'TypeScript Engineer', channel: 'email', status: 'replied', applyTarget: 'team@paperplane.example', score: 90, hoursAgo: 120 },
  { id: 'j9', sentBy: 'autonomous', sourceId: 'ats', sourceName: 'Lever watchlist', company: 'Corvid Health', title: 'Backend Engineer, Integrations', channel: 'ats', status: 'interview', applyTarget: 'jobs.lever.co/corvid', score: 86, hoursAgo: 300 },
  { id: 'j10', sentBy: 'autonomous', sourceId: 'hn', sourceName: 'HN Who is hiring', company: 'Tessellate', title: 'Senior Node.js Developer', channel: 'email', status: 'applied', applyTarget: 'jobs@tessellate.example', score: 81, hoursAgo: 240 },
  { id: 'j11', sentBy: 'you-app', sourceId: 'ats', sourceName: 'Ashby watchlist', company: 'Brightwave', title: 'API Engineer', channel: 'ats', status: 'rejected', applyTarget: 'jobs.ashbyhq.com/brightwave', score: 77, hoursAgo: 450 },
  { id: 'j12', sourceId: 'remotive', sourceName: 'Remotive', company: 'Bergmann GmbH', title: 'Backend Engineer (Java)', channel: 'custom', status: 'skipped', applyTarget: 'karriere.bergmann.example', score: 41, hoursAgo: 30, gaps: ['Java-heavy stack', 'German required'] },
  { id: 'j13', sentBy: 'autonomous', sourceId: 'wwr', sourceName: 'WeWorkRemotely', company: 'Quillstack', title: 'Backend Engineer', channel: 'email', status: 'ghosted', applyTarget: 'apply@quillstack.example', score: 80, hoursAgo: 640 },
];

/** Expands compact seeds into full `Job` records with sensible defaults. */
export function seedJobs(now: Date): Job[] {
  return JOB_SEEDS.map(({ hoursAgo: age, ...s }) => ({
    url: `https://example.com/jobs/${s.id}`,
    location: 'Remote',
    employmentType: 'full-time',
    postedAt: hoursAgo(now, age + 24),
    description: `${s.company} is hiring a ${s.title}. Remote-first, async team.`,
    tags: ['Remote', 'Full-time'],
    strengths: [],
    gaps: [],
    factsUsed: s.score ? 8 : 0,
    tokensUsed: s.score ? 1_800 + s.score * 120 : 0,
    roleSummary: s.score ? `${s.title} on a small remote product team.` : undefined,
    descriptionSummary: undefined,
    folderPath: s.score && s.score >= 75 ? `~/JobApps/2026-11/${s.company} — ${s.title} (${s.score}%)` : undefined,
    history: historyTo(now, s.status, age),
    ...s,
  }));
}

const DRAFT_COPY: Record<string, Pick<Draft, 'headline' | 'summary' | 'resume' | 'coverLetter'>> = {
  j1: {
    headline: 'Senior Backend Engineer',
    summary: 'Backend engineer focused on billing, payments and event pipelines. Five years shipping Node.js and PostgreSQL services on AWS for distributed teams.',
    resume: [
      { heading: '[Previous Company] — Senior Software Engineer · 2022 – now', items: [
        { text: 'Redesigned the invoicing schema in PostgreSQL; p95 query time dropped from 900 ms to 120 ms.', factId: 'f1' },
        { text: 'Built the usage-metering pipeline on SQS and ECS with idempotent consumers, so retries never double-billed.', factId: 'f2' },
        { text: 'Owned on-call for payments across three time zones.', factId: 'f3' },
      ] },
    ],
    coverLetter: 'Hi Northwind team,\n\nI am applying for the Senior Backend Engineer role. For the last five years I have built and run Node.js services in production, most recently the payments service at Acme, where I redesigned the invoicing schema and cut p95 query time from 900 ms to 120 ms.\n\nYour post mentions usage metering. I built exactly that: an SQS and ECS pipeline with idempotent consumers, so retries never double-billed a customer.\n\nI work async-first across time zones and I am comfortable owning on-call for what I ship.\n\nResume attached. Happy to walk through any of it.\n\nSam Rivera',
  },
  j2: {
    headline: 'Full-stack Engineer',
    summary: 'Full-stack TypeScript engineer who ships product features end to end, from React UI to Node.js APIs and the database.',
    resume: [
      { heading: '[Earlier Company] — Software Engineer · 2020 – 2022', items: [
        { text: 'Shipped the customer self-serve portal in React and TypeScript, end to end.', factId: 'f4' },
        { text: 'Built Node.js APIs serving the web and mobile apps.', factId: 'f2' },
      ] },
    ],
    coverLetter: 'Hi Fieldwork team,\n\nI build product features end to end in TypeScript, from React screens down to the Node.js API and the database. At Acme I shipped the customer self-serve portal on my own, working directly with design and support.\n\nScheduling tools for field teams is a problem I would enjoy, and I would like to bring that end-to-end habit to it.\n\nSam Rivera',
  },
  j3: {
    headline: 'Platform Engineer',
    summary: 'Platform engineer running Kubernetes and Terraform for payment systems, focused on reliability and fast CI.',
    resume: [
      { heading: '[Earlier Company] — Software Engineer · 2020 – 2022', items: [
        { text: 'Migrated services to Kubernetes with zero-downtime rollouts.', factId: 'f5' },
      ] },
    ],
    coverLetter: 'Hi Ledgerly team,\n\nI run Kubernetes platforms for payment systems and keep every piece of infrastructure in Terraform. At Acme I moved our services to Kubernetes with zero-downtime rollouts and cut CI time in half.\n\nSam Rivera',
  },
  j4: {
    headline: 'Full-stack Developer',
    summary: 'Developer who has shipped two Electron desktop apps with offline-first SQLite storage.',
    resume: [
      { heading: 'Projects', items: [{ text: 'Shipped an offline-first Electron app syncing SQLite with a REST API.', factId: 'f6' }] },
    ],
    coverLetter: 'Hi,\n\nI have shipped two Electron apps that keep a local SQLite database in sync with a REST API, which is the core of what you describe. I can deliver a working build every week so you see progress early.\n\nProposed plan: week 1 schema and sync, weeks 2–4 screens, weeks 5–6 packaging and fixes.\n\nSam Rivera',
  },
};

/** Drafts exist for every job that reached generation. */
export function seedDrafts(jobs: Job[], now: Date): Draft[] {
  return jobs
    .filter((j) => !['found', 'scored', 'skipped'].includes(j.status))
    .map((j) => ({
      jobId: j.id,
      kind: j.employmentType === 'freelance' ? 'proposal' : 'cover-letter',
      createdAt: hoursAgo(now, 4),
      edited: false,
      ...(DRAFT_COPY[j.id] ?? {
        headline: j.title,
        summary: `${j.title} with five years of production TypeScript and Node.js.`,
        resume: [{ heading: '[Previous Company] — Senior Software Engineer · 2022 – now', items: [{ text: 'Redesigned the invoicing schema in PostgreSQL; p95 query time dropped from 900 ms to 120 ms.', factId: 'f1' }] }],
        coverLetter: `Hi ${j.company} team,\n\nI am applying for the ${j.title} role. For the last five years I have built and run Node.js services in production.\n\nSam Rivera`,
      }),
      answers: [
        { question: 'How many years of experience do you have with Kubernetes?', answer: '4', origin: 'bank', tokens: 0 },
        { question: 'Will you now or in the future require visa sponsorship?', answer: 'No. I work remotely as a contractor from [Your country].', origin: 'bank', tokens: 0 },
        { question: 'Expected rate (USD per hour)', answer: '[Your rate]', origin: 'bank', tokens: 0 },
        { question: `Why are you interested in ${j.company}?`, answer: 'That is the work I like: boring, reliable infrastructure with fast CI so engineers ship safely.', origin: 'ai', tokens: 600 },
      ],
    }));
}

/** Profile seed: fact groups, facts, skills, answers and preferences from the prototype. */
export function seedProfile(now: Date): Profile {
  const prev = '[Previous Company] — Senior Software Engineer';
  const earlier = '[Earlier Company] — Software Engineer';
  return {
    referenceResume: { fileName: 'reference-resume.pdf', uploadedAt: hoursAgo(now, 24 * 8), factsFound: 38 },
    factGroups: [
      { name: prev, kind: 'experience', dates: '2022 – now', context: 'B2B billing platform; payments for 400+ businesses.' },
      { name: earlier, kind: 'experience', dates: '2020 – 2022' },
      { name: 'Projects', kind: 'project' },
    ],
    contact: {
      phone: '+1 555 0100', location: 'Remote · UTC−5 to UTC+2',
      links: [{ label: 'Portfolio', url: 'https://example.com' }, { label: 'GitHub', url: 'https://github.com/example' }],
      education: 'BS Computer Science', notes: '',
    },
    facts: [
      { id: 'f1', group: prev, text: 'Redesigned the invoicing schema in PostgreSQL; p95 query time dropped from 900 ms to 120 ms.', tags: ['PostgreSQL', 'metric'], timesUsed: 14 },
      { id: 'f2', group: prev, text: 'Built the usage-metering pipeline on SQS and ECS with idempotent consumers.', tags: ['AWS', 'Node.js'], timesUsed: 11 },
      { id: 'f3', group: prev, text: 'Owned on-call for payments across three time zones.', tags: ['on-call'], timesUsed: 6 },
      { id: 'f4', group: earlier, text: 'Shipped the customer self-serve portal in React and TypeScript, end to end.', tags: ['React', 'TypeScript'], timesUsed: 8 },
      { id: 'f5', group: earlier, text: 'Migrated services to Kubernetes with zero-downtime rollouts.', tags: ['Kubernetes'], timesUsed: 4 },
      { id: 'f6', group: 'Projects', text: 'Shipped an offline-first Electron app syncing SQLite with a REST API.', tags: ['Electron', 'SQLite'], timesUsed: 2 },
    ],
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'AWS', 'React', 'Kubernetes', 'Terraform', 'Redis', 'Electron', 'SQLite', 'GitHub Actions', 'GraphQL (basic)'],
    answers: [
      { id: 'a1', question: 'Years of experience with Node.js', answer: '5', origin: 'you', timesReused: 22 },
      { id: 'a2', question: 'Years of experience with Kubernetes', answer: '4', origin: 'you', timesReused: 7 },
      { id: 'a3', question: 'Will you require visa sponsorship?', answer: 'No. I work remotely as a contractor from [Your country].', origin: 'you', timesReused: 18 },
      { id: 'a4', question: 'Expected salary (USD per year)', answer: '[Your number]', origin: 'you', timesReused: 15 },
      { id: 'a5', question: 'Notice period', answer: '2 weeks', origin: 'you', timesReused: 12 },
      { id: 'a6', question: 'Why are you interested in Ledgerly?', answer: 'Ledger APIs need a platform that never surprises anyone...', origin: 'ai', timesReused: 0 },
    ],
    preferences: {
      targetRoles: ['Backend Engineer', 'Full-stack Engineer', 'Platform Engineer'],
      seniority: 'Mid to Senior',
      employmentTypes: ['full-time', 'contract', 'freelance'],
      remoteOnly: true,
      hoursOverlap: 'At least 4h with UTC−5 to UTC+2',
      minimumPay: '[Your minimum] / year or [rate] / hour',
    },
  };
}

/** Sources from the prototype, each with its fetch method and autonomy; clipped and Upwork are capped at draft. */
export function seedSources(now: Date): Source[] {
  const polled = hoursAgo(now, 2);
  // Clipped and optional sources have never been polled.
  return DEFAULT_SOURCES.map((s) => (s.id === 'clip' || s.id === 'jsearch' ? { ...s } : { ...s, lastPolledAt: polled }));
}

/** Usage for either period, mirroring the prototype's numbers. */
export function seedUsage(now: Date, period: UsagePeriod): Usage {
  const today = period === 'today';
  const tokensByDay = [62, 88, 104, 71, 132, 54, 82].map((k, i) => ({
    date: new Date(now.getTime() - (6 - i) * 86_400_000).toISOString().slice(0, 10),
    tokens: k * 1_000,
  }));
  return {
    period,
    dailyTokenBudget: 150_000,
    tokensByDay,
    summary: today
      ? { tokens: 82_000, tokenBudget: 150_000, sent: 6, sentLimit: 20, sentBreakdown: { autonomous: 3, approved: 2, manual: 1 }, avgTokensPerApplication: 7_900, avgNote: 'Scoring + tailoring + answers', savedByAnswerBank: { tokens: 4_100, answersReused: 11 } }
      : { tokens: 1_210_000, tokenBudget: 3_000_000, sent: 38, sentBreakdown: { autonomous: 17, approved: 14, manual: 7 }, avgTokensPerApplication: 9_400, avgNote: 'Down from 13k in week 1', savedByAnswerBank: { tokens: 61_000, answersReused: 142 } },
    tokensByStep: (today
      ? [['tailor', 26_400], ['score', 9_100], ['answers', 3_200], ['prep', 2_500], ['follow-up', 0]]
      : [['tailor', 742_000], ['score', 268_000], ['answers', 96_000], ['prep', 71_000], ['follow-up', 33_000]]
    ).map(([step, tokens]) => ({ step: step as UsageStep, tokens: tokens as number })),
    prefilter: today
      ? { found: 83, duplicates: 0, passed: 19, dropped: [{ reason: 'seniority', count: 42 }, { reason: 'location', count: 18 }, { reason: 'role', count: 4 }] }
      : { found: 581, duplicates: 64, passed: 102, dropped: [{ reason: 'seniority', count: 260 }, { reason: 'location', count: 118 }, { reason: 'role', count: 37 }] },
    quotas: [
      { id: 'tokens-day', label: 'Claude tokens', sub: 'Daily budget', used: 82_000, limit: 150_000, warnAt: 0.8, unit: 'tokens' },
      { id: 'tokens-month', label: 'Claude tokens', sub: 'Monthly budget', used: 1_210_000, limit: 3_000_000, warnAt: 0.8, unit: 'tokens' },
      { id: 'gmail', label: 'Gmail sends', sub: 'Per day · Gmail allows about 500', used: 4, limit: 100, warnAt: 0.8, unit: 'emails' },
      { id: 'remotive', label: 'Remotive', sub: 'Polls per day', used: 4, limit: 4, warnAt: 0.8, unit: 'polls', doneLabel: 'Done for today' },
      { id: 'remoteok', label: 'RemoteOK', sub: 'Polls per day', used: 3, limit: 4, warnAt: 0.8, unit: 'polls' },
      { id: 'upwork', label: 'Upwork API', sub: 'Requests per day', used: 83, limit: 100, warnAt: 0.8, unit: 'requests' },
      { id: 'jsearch', label: 'JSearch', sub: 'Optional · free tier, per month', used: 0, limit: 200, warnAt: 0.8, unit: 'calls', off: true },
    ],
  };
}

/** Default settings: SPEC thresholds and caps, assisted fill off, no secrets set. */
export function seedSettings(): Settings {
  return {
    outputFolder: '~/JobApps',
    fullName: '',
    aiEngine: 'claude-code',
    gmailAddress: '',
    telegramChatId: '',
    assistedFill: { platform: false, custom: false },
    followUpDays: 7,
    draftThreshold: 75,
    autoSendThreshold: 85,
    maxPerChannelPerDay: 10,
    dailyTokenBudget: 150_000,
    monthlyTokenBudget: 3_000_000,
    discoveryIntervalHours: 6,
    launchAtLogin: false,
    blocklist: ['[Current employer]', 'Quillstack'],
    secretsSet: { anthropicApiKey: false, gmailAppPassword: false, telegramBotToken: false },
    checks: {},
  };
}

/** Last discovery run, shown in the Review header. */
export function seedLastRun(now: Date): RunSummary {
  const at = new Date(now);
  at.setHours(8, 0, 0, 0);
  return { at: at.toISOString(), found: 62, newAfterDedup: 47, passedFilters: 9, drafted: 4 };
}
