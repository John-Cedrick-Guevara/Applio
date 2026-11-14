import { quotaLevel, quotaPercent } from '../../../shared/quota';
import type { Quota } from '../../../shared/types';
import { formatTokens } from '../../lib/format';

/** Token counts get compact formatting; small counters (emails, polls) stay exact. */
const amount = (q: Quota, n: number) => (q.unit === 'tokens' ? formatTokens(n) : n.toLocaleString('en-US'));

/** State label and badge for a quota row. Expected daily stops get friendlier wording. */
function stateOf(q: Quota): { label: string; badge: string; meter: string } {
  if (q.off) return { label: 'Off', badge: 'badge-muted', meter: '' };
  const level = quotaLevel(q);
  if (level === 'stop') return { label: q.doneLabel ?? 'Stopped', badge: 'badge-ink', meter: 'meter-stop' };
  if (level === 'warn') return { label: 'Warning', badge: 'badge-warning', meter: 'meter-warn' };
  return { label: 'OK', badge: 'badge-success', meter: '' };
}

/** Free-limit guard (SPEC F10): every free tier with its level and the warning mark. */
export function QuotaTable({ quotas }: { quotas: Quota[] }) {
  return (
    <section className="card card-flush">
      <div className="card-header">
        <div>
          <h2 id="guard-title">Free-limit guard</h2>
          <p>Warns on Telegram at 80%. Stops at 100%.</p>
        </div>
        <a href="#/settings/guard" className="edit-limits">Edit limits</a>
      </div>
      <div className="table-scroll">
        <table className="table guard-table" aria-labelledby="guard-title">
          <thead>
            <tr>
              <th scope="col">Resource</th>
              <th scope="col" className="num">Used</th>
              <th scope="col" className="num">Limit</th>
              <th scope="col" className="col-level">Level</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {quotas.map((q) => {
              const state = stateOf(q);
              const pct = q.off ? 0 : quotaPercent(q);
              return (
                <tr key={q.id}>
                  <td>
                    <span className="quota-name">{q.label}</span>
                    <span className="cell-sub quota-sub">{q.sub}</span>
                  </td>
                  <td className="num">{q.off ? '—' : amount(q, q.used)}</td>
                  <td className="num cell-sub">{amount(q, q.limit)}</td>
                  <td>
                    <div className={`meter ${state.meter}`} role="meter" aria-label={`${q.label}, ${q.sub}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                      <div className="meter-fill" style={{ width: `${pct}%` }} />
                      <span className="meter-tick" style={{ left: `${q.warnAt * 100}%` }} aria-hidden="true" />
                    </div>
                  </td>
                  <td><span className={`badge ${state.badge}`}>{state.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
