import { useState } from 'react';
import type { Preferences } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { useAction } from '../../hooks/use-action';
import { EMPLOYMENT_LABEL } from '../../lib/labels';
import { fromDraft, toDraft, type PreferencesDraft } from './preferences-model';

/** "What you are looking for": read view with an inline editor (SPEC F1). Drives the free prefilter. */
export function PreferencesCard({ preferences, onSaved }: { preferences: Preferences; onSaved: (p: Preferences) => void }) {
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
          <div><dt>Seniority</dt><dd>{preferences.seniority}</dd></div>
          <div><dt>Work type</dt><dd>{preferences.employmentTypes.map((t) => EMPLOYMENT_LABEL[t]).join(' · ')}</dd></div>
          <div><dt>Location</dt><dd>{preferences.remoteOnly ? 'Remote only · international clients' : 'Remote or on-site'}</dd></div>
          <div><dt>Hours overlap</dt><dd>{preferences.hoursOverlap}</dd></div>
          <div><dt>Minimum pay</dt><dd>{preferences.minimumPay}</dd></div>
        </dl>
      )}
    </section>
  );
}

function PreferencesForm({ preferences, onDone }: { preferences: Preferences; onDone: (p: Preferences | null) => void }) {
  const api = useApi();
  const action = useAction();
  const [draft, setDraft] = useState<PreferencesDraft>(() => toDraft(preferences));
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof PreferencesDraft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  };

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
          <input id="p-roles" className="input" value={draft.roles} aria-invalid={error ? true : undefined} onChange={(e) => set('roles', e.target.value)} />
          {error ? <p className="field-error" role="alert">{error}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="p-sen">Seniority</label>
          <input id="p-sen" className="input" value={draft.seniority} onChange={(e) => set('seniority', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="p-hours">Hours overlap</label>
          <input id="p-hours" className="input" value={draft.hours} onChange={(e) => set('hours', e.target.value)} />
        </div>
        <div className="field span-2">
          <label htmlFor="p-pay">Minimum pay</label>
          <input id="p-pay" className="input" value={draft.pay} onChange={(e) => set('pay', e.target.value)} />
        </div>
      </div>
      <div className="form-actions">
        <Button variant="ghost" size="sm" onClick={() => onDone(null)}>Cancel</Button>
        <Button variant="strong" size="sm" busy={action.pending} onClick={save}>Save preferences</Button>
      </div>
    </>
  );
}
