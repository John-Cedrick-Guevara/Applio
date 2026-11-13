import type { AppStatus, ScanPhase } from '../../shared/types';
import { formatClock, formatTokens } from '../lib/format';

const PHASE: Record<ScanPhase, string> = {
  fetching: 'fetching posts',
  filtering: 'removing duplicates and filtering',
  scoring: 'scoring matches',
  drafting: 'drafting strong matches',
};

/** Past this, the bar warns the budget is getting low. */
const WARN_AT = 80;

/** "1:12" from milliseconds. */
const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

/** Whole thousands past 10k, so "126.4k / 150k" stays short in the bar. */
const tokens = (n: number) => formatTokens(n >= 10_000 && n < 1_000_000 ? Math.round(n / 1000) * 1000 : n);

export interface Activity {
  running: { kind: 'scan' | 'drafting' | 'idle' | 'stopped'; text: string };
  auto: { kind: 'paused' | 'off' | 'on'; text: string };
  budget: { pct: number; tone: 'ok' | 'warn' | 'stop'; text: string };
  /** Set when the AI engine can't run at all. */
  engine?: string;
}

/**
 * What the activity bar says, from main's status plus the two settings it isn't
 * pushed with. Running work shows the busiest thing (a scan, else drafts, else the
 * last scan); auto-send is "on" only when some enabled source is Autonomous.
 */
export function activityModel(status: AppStatus, ctx: { autoSendThreshold: number; autonomousSources: number; now: number }): Activity {
  const running: Activity['running'] = status.scan
    ? { kind: 'scan', text: `Scanning · ${PHASE[status.scan.phase]} · ${clock(Math.max(0, ctx.now - Date.parse(status.scan.startedAt)))}` }
    : status.budgetStop
    ? { kind: 'stopped', text: 'AI paused · budget used' }
    : status.drafting?.length
    ? { kind: 'drafting', text: `Drafting ${status.drafting.length} · you can keep working` }
    : { kind: 'idle', text: `Nothing running · ${status.lastRun ? `last scan ${formatClock(status.lastRun.at)}` : 'no scans yet'}` };

  const auto: Activity['auto'] = status.paused
    ? { kind: 'paused', text: 'Auto-send paused · nothing goes out without your click' }
    : ctx.autonomousSources === 0
    ? { kind: 'off', text: 'Auto-send off · every source waits for your approval' }
    : { kind: 'on', text: `Auto-send on · email and ATS forms at ${ctx.autoSendThreshold}+` };

  const pct = Math.min(100, Math.round((status.tokensToday / Math.max(1, status.dailyTokenBudget)) * 100));
  const budget: Activity['budget'] = {
    pct,
    tone: status.budgetStop ? 'stop' : pct >= WARN_AT ? 'warn' : 'ok',
    text: `${tokens(status.tokensToday)} / ${tokens(status.dailyTokenBudget)}`,
  };

  return { running, auto, budget, ...(status.engineReady ? {} : { engine: 'Claude needs setup' }) };
}
