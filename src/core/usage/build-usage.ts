import type { ApplyChannel, Quota, SentBy, Settings, Usage, UsagePeriod, UsageStep } from '../../shared/types';

/** Tokens a reused bank answer would have cost to write. ponytail: one estimate; per-answer cost isn't recorded separately. */
const TOKENS_PER_ANSWER = 200;
const STEPS: readonly UsageStep[] = ['tailor', 'score', 'answers', 'prep', 'follow-up'];
const SENDING_CHANNELS = 2; // email and ATS: the only channels Applio sends on

export interface UsageInput {
  now: Date;
  /** AI usage rows from at least the start of the month and the last 7 days. */
  usage: { at: string; step: UsageStep; tokens: number }[];
  /** Applications sent, each by its Applied event, with what it cost overall. */
  sent: { at: string; sentBy: SentBy; channel: ApplyChannel; tokens: number }[];
  /** Bank answers reused, per draft. */
  bankAnswersReused: { at: string; count: number }[];
  /** Today's polls per board against its daily limit. */
  polls: { id: string; name: string; used: number; limit: number }[];
  settings: Pick<Settings, 'dailyTokenBudget' | 'monthlyTokenBudget' | 'maxPerChannelPerDay'>;
  gmailDailyCap: number;
  /** Each discovery run's prefilter counts, from its stored details. */
  runs: { at: string; found: number; duplicates: number; passed: number; dropped: Partial<Record<string, number>> }[];
}

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * The Usage page from recorded data (SPEC F10): tiles, tokens by step and by
 * day, and every free limit's state. Pure, so the numbers are testable without
 * a database; the limits' hard stops live where the work happens.
 */
export function buildUsage(period: UsagePeriod, input: UsageInput): Usage {
  const { now, settings } = input;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const since = period === 'today' ? dayStart : monthStart;
  const inPeriod = <T extends { at: string }>(rows: T[], from = since) => rows.filter((r) => Date.parse(r.at) >= from);

  const usage = inPeriod(input.usage);
  const sent = inPeriod(input.sent);
  const reused = sum(inPeriod(input.bankAnswersReused).map((r) => r.count));
  const tokens = sum(usage.map((u) => u.tokens));
  const tokensToday = sum(inPeriod(input.usage, dayStart).map((u) => u.tokens));
  const tokensMonth = sum(inPeriod(input.usage, monthStart).map((u) => u.tokens));
  const emailsToday = inPeriod(input.sent, dayStart).filter((s) => s.channel === 'email').length;

  const days = Array.from({ length: 7 }, (_, i) => localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i))));
  const byDay = new Map(days.map((d) => [d, 0]));
  for (const u of input.usage) {
    const d = localDate(new Date(u.at));
    if (byDay.has(d)) byDay.set(d, byDay.get(d)! + u.tokens);
  }

  const quotas: Quota[] = [
    { id: 'tokens-day', label: 'Claude tokens', sub: 'Daily budget', used: tokensToday, limit: settings.dailyTokenBudget, warnAt: 0.8, unit: 'tokens' },
    { id: 'tokens-month', label: 'Claude tokens', sub: 'Monthly budget', used: tokensMonth, limit: settings.monthlyTokenBudget, warnAt: 0.8, unit: 'tokens' },
    { id: 'gmail', label: 'Gmail sends', sub: 'Per day · Gmail allows about 500', used: emailsToday, limit: input.gmailDailyCap, warnAt: 0.8, unit: 'emails' },
    ...input.polls.map((p): Quota => ({ id: p.id, label: p.name, sub: 'Polls per day', used: p.used, limit: p.limit, warnAt: 0.8, unit: 'polls', ...(p.used >= p.limit ? { doneLabel: 'Done for today' } : {}) })),
    { id: 'upwork', label: 'Upwork API', sub: 'Not available yet · use paste', used: 0, limit: 0, warnAt: 0.8, unit: 'requests', off: true },
    { id: 'jsearch', label: 'JSearch', sub: 'Optional · free tier, per month · not set up', used: 0, limit: 200, warnAt: 0.8, unit: 'calls', off: true },
  ];

  return {
    period,
    dailyTokenBudget: settings.dailyTokenBudget,
    summary: {
      tokens,
      tokenBudget: period === 'today' ? settings.dailyTokenBudget : settings.monthlyTokenBudget,
      sent: sent.length,
      ...(period === 'today' ? { sentLimit: settings.maxPerChannelPerDay * SENDING_CHANNELS } : {}),
      sentBreakdown: {
        autonomous: sent.filter((s) => s.sentBy === 'autonomous').length,
        approved: sent.filter((s) => s.sentBy === 'you-app' || s.sentBy === 'you-telegram').length,
        manual: sent.filter((s) => s.sentBy === 'you-manual').length,
      },
      avgTokensPerApplication: sent.length ? Math.round(sum(sent.map((s) => s.tokens)) / sent.length) : 0,
      avgNote: sent.length ? `Across ${sent.length} application${sent.length === 1 ? '' : 's'}: scoring, tailoring, answers` : 'No applications sent yet',
      savedByAnswerBank: { tokens: reused * TOKENS_PER_ANSWER, answersReused: reused },
    },
    prefilter: prefilterOf(inPeriod(input.runs)),
    tokensByStep: STEPS.map((step) => ({ step, tokens: sum(usage.filter((u) => u.step === step).map((u) => u.tokens)) })),
    tokensByDay: days.map((date) => ({ date, tokens: byDay.get(date)! })),
    quotas,
  };
}

/** What the free prefilter did over the period: totals, and drops per reason, biggest first (zero reasons left out). */
function prefilterOf(runs: UsageInput['runs']): NonNullable<Usage['prefilter']> {
  const dropped = new Map<string, number>();
  for (const r of runs) for (const [reason, n] of Object.entries(r.dropped)) dropped.set(reason, (dropped.get(reason) ?? 0) + (n ?? 0));
  return {
    found: sum(runs.map((r) => r.found)),
    duplicates: sum(runs.map((r) => r.duplicates)),
    passed: sum(runs.map((r) => r.passed)),
    dropped: [...dropped].filter(([, count]) => count > 0).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };
}
