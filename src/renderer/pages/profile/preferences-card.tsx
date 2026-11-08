import { useState } from 'react';
import type { EmploymentType, Preferences } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { Toggle } from '../../components/form';
import { useAction } from '../../hooks/use-action';
import { EMPLOYMENT_LABEL } from '../../lib/labels';
import { CURRENCIES, fromDraft, PAY_PERIODS, payNeedsDetail, SENIORITY_LEVELS, toDraft, type PayPeriod, type PreferencesDraft } from './preferences-model';

const WORK_TYPES = Object.keys(EMPLOYMENT_LABEL) as EmploymentType[];

/**
 * "What you are looking for": read view with an inline editor (SPEC F1). Drives the free prefilter.
 * `location`: the profile's location line, which picks the default pay currency.
 */
export function PreferencesCard({ preferences, location = '', onSaved }: { preferences: Preferences; location?: string; onSaved: (p: Preferences) => void }) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="card profile-prefs">
      <div className="spread">
        <h2 className="card-title">What you are looking for</h2>
        {editing ? null : (
          <Button size="sm" aria-label="Edit preferences" onClick={() => setEditing(true)}>Edit</Button>
        )}
      </div>
      {editing ? (
        <PreferencesForm
          preferences={preferences}
          location={location}
          onDone={(next) => {
            setEditing(false);
            if (next) onSaved(next);
          }}
        />
      ) : (
        <dl className="prefs-grid">
          <div>
            <dt>Target roles</dt>
            <dd className="tag-row">{preferences.targetRoles.map((r) => <span key={r} className="tag">{r}</span>)}</dd>
          </div>
          <div><dt>Seniority</dt><dd>{preferences.seniority || 'Any'}</dd></div>
          <div><dt>Work type</dt><dd>{preferences.employmentTypes.length ? preferences.employmentTypes.map((t) => EMPLOYMENT_LABEL[t]).join(' · ') : 'Any'}</dd></div>
          <div><dt>Location</dt><dd>{preferences.remoteOnly ? 'Remote only · international clients' : 'Remote or on-site'}</dd></div>
          <div><dt>Hours overlap</dt><dd>{preferences.hoursOverlap || 'Any'}</dd></div>
          <div>
            <dt>Minimum pay</dt>
            <dd>{preferences.minimumPay || 'None'}</dd>
            {payNeedsDetail(preferences.minimumPay) ? (
              <p className="field-error">
                Pick a currency and period so Applio can compare pay. Until then it filters nothing on pay.{' '}
                <Button size="sm" variant="link" onClick={() => setEditing(true)}>Fix it</Button>
              </p>
            ) : null}
          </div>
        </dl>
      )}
    </section>
  );
}

function PreferencesForm({ preferences, location, onDone }: { preferences: Preferences; location: string; onDone: (p: Preferences | null) => void }) {
  const api = useApi();
  const action = useAction();
  const [draft, setDraft] = useState<PreferencesDraft>(() => toDraft(preferences, location));
  const [error, setError] = useState<string | null>(null);
  // A value typed before the select existed stays choosable, so opening the editor never changes it silently.
  const levels: readonly string[] = draft.seniority && !(SENIORITY_LEVELS as readonly string[]).includes(draft.seniority) ? [draft.seniority, ...SENIORITY_LEVELS] : SENIORITY_LEVELS;

  const set = <K extends keyof PreferencesDraft>(key: K, value: PreferencesDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  };
  /** A pay edit: from now on the form's pay replaces the saved minimum. */
  const setPay = <K extends 'payAmount' | 'payCurrency' | 'payPeriod'>(key: K, value: PreferencesDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value, payTouched: true }));
    setError(null);
  };
  const toggleType = (type: EmploymentType, on: boolean) =>
    set('types', on ? WORK_TYPES.filter((t) => t === type || draft.types.includes(t)) : draft.types.filter((t) => t !== type));

  const save = async () => {
    const result = fromDraft(draft, preferences);
    if (!result.ok) return setError(result.error);
    const saved = await action.run('save preferences', () => api.savePreferences(result.value), 'Preferences saved. Filters update on the next run.');
    if (saved) onDone(saved);
  };

  return (
    <>
      <div className="prefs-form">
        <div className="field span-2">
          <label htmlFor="p-roles">Target roles <span className="label-aside">· comma separated</span></label>
          <input id="p-roles" className="input" value={draft.roles} onChange={(e) => set('roles', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="p-sen">Seniority</label>
          <select id="p-sen" className="select" value={draft.seniority} onChange={(e) => set('seniority', e.target.value)}>
            <option value="">Any</option>
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <p className="field-hint">Entry and Intern skip Senior, Staff and Lead titles; Mid skips Staff and above.</p>
        </div>
        <div className="field">
          <label htmlFor="p-hours">Hours overlap</label>
          <input id="p-hours" className="input" value={draft.hours} onChange={(e) => set('hours', e.target.value)} />
        </div>
        <fieldset className="field span-2 prefs-fieldset">
          <legend>Work type</legend>
          <div className="row">
            {WORK_TYPES.map((t) => (
              <label key={t} className="row">
                <input type="checkbox" checked={draft.types.includes(t)} onChange={(e) => toggleType(t, e.target.checked)} />
                {EMPLOYMENT_LABEL[t]}
              </label>
            ))}
          </div>
          <p className="field-hint">None checked means any work type.</p>
        </fieldset>
        <div className="span-2">
          <Toggle label="Remote only" description="Skip jobs a board marks as on-site." checked={draft.remoteOnly} onChange={(on) => set('remoteOnly', on)} />
        </div>
        <fieldset className="field span-2 prefs-fieldset">
          <legend>Minimum pay</legend>
          <div className="pay-row">
            <input id="p-pay" className="input mono" inputMode="numeric" aria-label="Minimum pay amount" placeholder="None" value={draft.payAmount} onChange={(e) => setPay('payAmount', e.target.value)} />
            <select className="select" aria-label="Currency" value={draft.payCurrency} onChange={(e) => setPay('payCurrency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="select" aria-label="Per" value={draft.payPeriod} onChange={(e) => setPay('payPeriod', e.target.value as PayPeriod)}>
              {PAY_PERIODS.map((p) => <option key={p} value={p}>per {p}</option>)}
            </select>
          </div>
          <p className="field-hint">Jobs paid in another currency are kept, since Applio doesn't convert.</p>
        </fieldset>
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="form-actions">
        <Button variant="ghost" size="sm" onClick={() => onDone(null)}>Cancel</Button>
        <Button variant="strong" size="sm" busy={action.pending} onClick={save}>Save preferences</Button>
      </div>
    </>
  );
}
