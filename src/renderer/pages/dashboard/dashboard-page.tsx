import { useState } from 'react';
import type { AppStatus, Job, OpenQuestions, Settings, Source } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { buttonClass } from '../../components/button';
import { Icon } from '../../components/icons';
import { useAsync } from '../../hooks/use-async';
import { useJobsVersion } from '../../hooks/use-jobs-version';
import { formatClock, formatTokens } from '../../lib/format';
import { activityModel } from '../../layout/activity-model';
import { budgetCard, needs, pipeline, sentSeries, upNext, weekCard, type PipelinePeriod, type SentRange } from './dashboard-model';
import './dashboard.css';

const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

/** n filled blocks out of total, as a decorative meter; the numbers beside it say the same in words. */
function Blocks({ filled, total, tone, gap = 4 }: { filled: number; total: number; tone: 'lavender' | 'ice'; gap?: number }) {
  return (
    <div className="dash-blocks" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`, gap }}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < filled ? `on on-${tone}` : undefined} />)}
    </div>
  );
}

/**
 * Dashboard (v5 home): what needs the operator, how the week and the AI budget stand,
 * what was sent, what is next, and how far jobs got. Read-only: every number comes
 * from job and status records, and nothing here spends tokens or sends anything.
 */
export default function DashboardPage() {
  const api = useApi();
  const jobsChanges = useJobsVersion();
  const state = useAsync(async () => {
    // perf: loads every job; fine at personal scale (thousands). Page the history if it grows past that.
    const [jobs, questions, status, settings, sources] = await Promise.all([api.listJobs(), api.listQuestions(), api.getStatus(), api.getSettings(), api.listSources()]);
    return { jobs, questions, status, settings, sources };
  }, [api, jobsChanges]);

  return (
    <div className="dash">
      <AsyncView state={state} what="your dashboard" rows={6}>
        {(data) => <DashboardView {...data} />}
      </AsyncView>
    </div>
  );
}

interface Data {
  jobs: Job[];
  questions: OpenQuestions[];
  status: AppStatus;
  settings: Settings;
  sources: Source[];
}

function DashboardView({ jobs, questions, status, settings, sources }: Data) {
  const now = new Date();
  const [range, setRange] = useState<SentRange>('day');
  const [period, setPeriod] = useState<PipelinePeriod>('all');
  const [picked, setPicked] = useState<number | null>(null);

  const running = activityModel(status, { autoSendThreshold: 0, autonomousSources: 0, now: now.getTime() }).running;
  const queue = jobs.filter((j) => j.status === 'drafted' || j.status === 'approved');
  const asking = new Set(questions.map((q) => q.jobId)).size;
  const n = needs(queue, asking);
  const week = weekCard(jobs, settings.weeklyGoal, now);
  const budget = budgetCard(status);
  const series = sentSeries(jobs, range, now);
  const next = upNext(jobs, { followUpDays: settings.followUpDays, lastRunAt: status.lastRun?.at, sources: sources.filter((s) => s.enabled).length, now });
  const pipe = pipeline(jobs, period, now);
  const selected = Math.min(picked ?? series.labels.length - 1, series.labels.length - 1);
  const H = 180;
  const seg = (count: number) => (count ? Math.max(6, Math.round((count / series.max) * H) - 2) : 0);

  const header = (
    <header className="dash-head">
      <div>
        <p className="dash-date">{dateFormat.format(now)}</p>
        <h1 className="dash-title">My <strong>job hunt</strong></h1>
      </div>
      <div className="dash-head-actions">
        <span role="status" aria-label="Activity" className="dash-chip">
          <span aria-hidden="true" className={`dash-dot${running.kind === 'stopped' ? ' dash-dot-stop' : ''}`} />
          {running.text}
        </span>
        <a className={`${buttonClass('strong')} dash-getjobs`} href="#/get-jobs"><Icon name="plus" size={16} strokeWidth={2} />Get jobs</a>
      </div>
    </header>
  );

  if (jobs.length === 0 && asking === 0) {
    return (
      <>
        {header}
        <section className="dash-card dash-first" aria-labelledby="first-h">
          <h2 id="first-h">Nothing here yet.</h2>
          <p className="muted">Scans only run when you start one. Get your first jobs and this page fills in from what really happens.</p>
          <a className={buttonClass('strong')} href="#/get-jobs">Get jobs</a>
        </section>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="dash-top">
        <section aria-labelledby="needs-h" className="dash-card dash-dark">
          <div className="dash-row">
            <h2 id="needs-h">Needs you</h2>
            <span className="dash-big" aria-label={`${n.total} in total`}>{n.total}</span>
          </div>
          {n.total === 0 ? (
            <p className="dash-dim">Nothing needs you right now.</p>
          ) : (
            <ul className="list-plain dash-needs">
              {n.rows.map((r) => (
                <li key={r.key}>
                  <a className="dash-need" href="#/inbox">
                    <span aria-hidden="true" className={`dash-pip dash-pip-${r.key}`} />
                    <span className="dash-need-text">{r.label} <span className="dash-dim">· {r.hint}</span></span>
                    <span className="dash-need-n">{r.count}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <a className="dash-open" href="#/inbox">Open Inbox <Icon name="chevronRight" size={16} /></a>
        </section>

        <section aria-labelledby="week-h" className="dash-card dash-lavender">
          <div className="dash-row">
            <h2 id="week-h">Sent this week</h2>
            <span className="dash-pill">{week.pct}% of goal</span>
          </div>
          <p className="dash-hero"><span>{week.sent}</span> <span className="muted">/ {week.goal} goal</span></p>
          <Blocks filled={week.blocks.filled} total={week.blocks.total} tone="lavender" />
          <p className="dash-line">{week.line}</p>
        </section>

        <section aria-labelledby="budget-h" className="dash-card dash-ice">
          <div className="dash-row">
            <h2 id="budget-h">AI budget today</h2>
            <span className="dash-pill">{budget.pct}% used</span>
          </div>
          <p className="dash-hero"><span>{formatTokens(budget.used)}</span> <span className="muted">/ {formatTokens(budget.total)} tokens</span></p>
          <Blocks filled={budget.blocks.filled} total={budget.blocks.total} tone="ice" gap={6} />
          <p className="dash-line">
            {budget.stopped
              ? <>AI is paused: today's budget is used. <a href="#/settings">Raise budget</a></>
              : `Hard stop at ${formatTokens(budget.total)}. Resets at midnight.`}
          </p>
        </section>
      </div>

      <div className="dash-two">
        <section aria-labelledby="act-h" className="dash-card dash-white">
          <div className="dash-row dash-wrap">
            <h2 id="act-h">Applications sent</h2>
            <span className="dash-legend"><span aria-hidden="true" className="dash-key dash-key-app" />Sent by Applio</span>
            <span className="dash-legend"><span aria-hidden="true" className="dash-key dash-key-you" />You applied (hand-off)</span>
            <label htmlFor="dash-range" className="visually-hidden">Range</label>
            <select id="dash-range" className="input dash-select" value={range} onChange={(e) => { setRange(e.target.value as SentRange); setPicked(null); }}>
              <option value="day">Last 10 days</option>
              <option value="week">Last 8 weeks</option>
            </select>
          </div>
          <div className="dash-chart">
            <div className="dash-ticks" aria-hidden="true">
              {[3, 2, 1, 0].map((i) => <span key={i}>{Math.round((series.max * i) / 3)}</span>)}
            </div>
            <div className="dash-bars" style={{ gridTemplateColumns: `repeat(${series.labels.length}, minmax(0, 1fr))` }}>
              {series.labels.map((label, i) => {
                const a = series.app[i]!;
                const y = series.you[i]!;
                const text = `${label}: ${a + y} sent, ${a} by Applio, ${y} by you`;
                const on = i === selected;
                return (
                  <button key={label} type="button" className="dash-bar" aria-label={text} aria-pressed={on} onClick={() => setPicked(i)} onMouseEnter={() => setPicked(i)} onFocus={() => setPicked(i)}>
                    <span className="dash-bar-col">
                      {on ? <span className="dash-tip" style={{ bottom: Math.round(((a + y) / series.max) * H) + 8 }}>{a + y ? `${a + y} sent · ${a} Applio, ${y} you` : 'None sent'}</span> : null}
                      {y ? <span className="dash-seg dash-seg-you" style={{ height: seg(y) }} /> : null}
                      {a ? <span className="dash-seg dash-seg-app" style={{ height: seg(a) }} /> : null}
                    </span>
                    <span className={`dash-bar-label${on ? ' on' : ''}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section aria-labelledby="next-h" className="dash-card dash-white">
          <h2 id="next-h">Up next</h2>
          <div className="dash-tiles">
            <a className="dash-tile" href="#/applications"><span className="dash-tile-icon dash-tint-pink" aria-hidden="true"><Icon name="applications" size={20} /></span><strong>{next.replies ? `${next.replies} ${next.replies === 1 ? 'reply' : 'replies'}` : 'No replies'}</strong><span className="muted">{next.replies ? 'Companies that wrote back' : 'None waiting'}</span></a>
            <a className="dash-tile" href="#/applications"><span className="dash-tile-icon dash-tint-amber" aria-hidden="true"><Icon name="check" size={20} /></span><strong>{next.followUps ? `${next.followUps} follow-up${next.followUps === 1 ? '' : 's'} due` : 'No follow-ups due'}</strong><span className="muted">{next.followUps ? `No reply after ${settings.followUpDays} days` : 'None due'}</span></a>
            <a className="dash-tile" href="#/matches/new"><span className="dash-tile-icon dash-tint-lavender" aria-hidden="true"><Icon name="matches" size={20} /></span><strong>{next.newMatches ? `${next.newMatches} new match${next.newMatches === 1 ? '' : 'es'}` : 'No new matches'}</strong><span className="muted">{next.newMatches ? 'Since the last scan' : 'None since the last scan'}</span></a>
            <a className="dash-tile" href="#/get-jobs"><span className="dash-tile-icon dash-tint-ice" aria-hidden="true"><Icon name="search" size={20} /></span><strong>{next.lastRunAt ? `Last scan ${formatClock(next.lastRunAt)}` : 'No scans yet'}</strong><span className="muted">{next.sources} source{next.sources === 1 ? '' : 's'} on · scans run when you start one</span></a>
          </div>
        </section>
      </div>

      <section aria-labelledby="pipe-h" className="dash-card dash-white">
        <div className="dash-row dash-wrap">
          <h2 id="pipe-h">Pipeline</h2>
          <span className="muted">How far your jobs got</span>
          <div role="group" aria-label="Period" className="dash-seg-control">
            {([['month', 'This month'], ['all', 'All time']] as const).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)}>{label}</button>
            ))}
          </div>
        </div>
        <ul className="list-plain dash-stages">
          {pipe.stages.map((s) => (
            <li key={s.label} className="dash-stage">
              <span className="dash-stage-label">{s.label}</span>
              <span className="dash-stage-track" aria-hidden="true"><span style={{ width: `${s.n ? Math.max(1.5, s.width) : 0}%` }} /></span>
              <span className="dash-stage-n">{s.n}</span>
              <span className="dash-stage-conv muted">{s.conv}</span>
            </li>
          ))}
        </ul>
        <p className="dash-closed muted">{period === 'month' ? 'Closed this month' : 'Closed'}: {pipe.closed.rejected} rejected · {pipe.closed.noReply} no reply · {pipe.closed.skipped} skipped by you</p>
      </section>
    </>
  );
}
