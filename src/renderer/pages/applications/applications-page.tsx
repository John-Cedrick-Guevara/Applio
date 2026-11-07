import { useMemo, useState } from 'react';
import type { Job } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { Button } from '../../components/button';
import { Icon } from '../../components/icons';
import { useAsync } from '../../hooks/use-async';
import { useJobsVersion } from '../../hooks/use-jobs-version';
import { formatShortDate, formatTokens } from '../../lib/format';
import { CHANNEL_LABEL } from '../../lib/labels';
import { ApplicationDetail } from './application-detail';
import { appStats, displayStatus, filterGroup, SENT_BY_LABEL, sentAt, type FilterGroup } from './applications-model';
import { StatusBadge } from './status-badge';
import './applications.css';

const SENT_STATUSES = ['applied', 'replied', 'interview', 'offer', 'rejected', 'ghosted'] as const;

const FILTERS: { id: FilterGroup | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'replied', label: 'Replied' },
  { id: 'interview', label: 'Interview' },
  { id: 'closed', label: 'Closed' },
];

/** Applications (prototype screen 3, SPEC F7): everything sent, with exactly what went out. */
export default function ApplicationsPage() {
  const api = useApi();
  const jobsChanges = useJobsVersion();
  const state = useAsync(async () => {
    const [jobs, settings] = await Promise.all([api.listJobs({ statuses: [...SENT_STATUSES] }), api.getSettings()]);
    const sorted = [...jobs].sort((a, b) => (sentAt(b) ?? '').localeCompare(sentAt(a) ?? ''));
    return { jobs: sorted, followUpDays: settings.followUpDays };
  }, [api, jobsChanges]);

  const replace = (job: Job) => state.setData((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === job.id ? job : j)) }));

  return (
    <AsyncView state={state} what="applications" rows={6}>
      {({ jobs, followUpDays }) => <Applications jobs={jobs} followUpDays={followUpDays} onJob={replace} />}
    </AsyncView>
  );
}

function Applications({ jobs, followUpDays, onJob }: { jobs: Job[]; followUpDays: number; onJob: (job: Job) => void }) {
  const [filter, setFilter] = useState<FilterGroup | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(jobs[0]?.id);
  const now = useMemo(() => new Date(), []);

  const rows = useMemo(() => jobs.map((job) => ({ job, status: displayStatus(job, followUpDays, now) })), [jobs, followUpDays, now]);
  const stats = useMemo(() => appStats(jobs, followUpDays, now), [jobs, followUpDays, now]);
  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (filter === 'all' || filterGroup(r.status) === filter) &&
      (!q || `${r.job.company} ${r.job.title} ${CHANNEL_LABEL[r.job.channel]}`.toLowerCase().includes(q)),
  );
  const selected = rows.find((r) => r.job.id === selectedId);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Applications</h1>
          <p>Everything Applio sent, how it is going, and exactly what went out.</p>
        </div>
        <dl className="app-stats">
          <Stat label="Sent this month" value={stats.sentThisMonth} />
          <Stat label="Replies" value={stats.replies} />
          <Stat label="Interviews" value={stats.interviews} />
          <Stat label="Follow-ups due" value={stats.followUpsDue} />
        </dl>
      </header>

      <div className="spread">
        <div className="row" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className="pill" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label} {f.id === 'all' ? rows.length : rows.filter((r) => filterGroup(r.status) === f.id).length}
            </button>
          ))}
        </div>
        <div className="search-box">
          <Icon name="search" className="search-icon" />
          <label htmlFor="app-search" className="visually-hidden">Search applications</label>
          <input id="app-search" type="search" placeholder="Company, role, channel" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="split">
        <section className="card card-flush app-list" aria-label="Application list">
          <div className="table-scroll">
            <table className="table app-table">
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col" className="num">Match</th>
                  <th scope="col">Channel</th>
                  <th scope="col">Sent by</th>
                  <th scope="col">Status</th>
                  <th scope="col">Date</th>
                  <th scope="col" className="num">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ job, status }) => {
                  const sent = sentAt(job);
                  return (
                    <tr key={job.id} className={job.id === selectedId ? 'is-selected' : undefined}>
                      <td>
                        <button type="button" className="row-button" aria-pressed={job.id === selectedId} onClick={() => setSelectedId(job.id)}>
                          <span className="row-role">{job.title}</span>
                          <span className="cell-sub">{job.company}</span>
                        </button>
                      </td>
                      <td className="num">{job.score ?? '—'}</td>
                      <td className="cell-secondary">{job.platform ? job.applyTarget.split(' · ')[0] : CHANNEL_LABEL[job.channel]}</td>
                      <td className="cell-secondary">{job.sentBy ? SENT_BY_LABEL[job.sentBy] : '—'}</td>
                      <td><StatusBadge status={status} /></td>
                      <td className="cell-sub nowrap">{sent ? formatShortDate(sent) : '—'}</td>
                      <td className="num cell-secondary">{formatTokens(job.tokensUsed)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length === 0 ? (
            <div className="state">
              <h3>No applications yet</h3>
              <p className="muted">Applications show up here once you approve a draft or mark one as applied.</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="state">
              <h3>No applications match</h3>
              <Button size="sm" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</Button>
            </div>
          ) : null}
          <div className="app-list-footer">Showing {visible.length} of {rows.length}</div>
        </section>

        {selected ? (
          <ApplicationDetail key={selected.job.id} job={selected.job} status={selected.status} followUpDays={followUpDays} now={now} onJob={onJob} />
        ) : null}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="mono">{value}</dd>
    </div>
  );
}
