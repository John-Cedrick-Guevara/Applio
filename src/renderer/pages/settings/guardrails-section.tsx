import { useState, type KeyboardEvent } from 'react';
import type { Settings } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { Card } from '../../components/card';
import { useAction } from '../../hooks/use-action';
import { parseGuardrails, toGuardrailsDraft, type GuardrailErrors, type GuardrailsDraft } from './guardrails-model';

const FIELDS: { key: keyof GuardrailsDraft; label: string }[] = [
  { key: 'draft', label: 'Draft bar (match score)' },
  { key: 'auto', label: 'Auto-send at (match score)' },
  { key: 'perDay', label: 'Max applications per channel per day' },
  { key: 'tokens', label: 'Claude tokens per day' },
  { key: 'monthTokens', label: 'Claude tokens per month' },
];

/** Guardrails (SPEC F6, F10): thresholds, daily caps and the company blocklist. Saved on blur. */
export function GuardrailsSection({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const api = useApi();
  const action = useAction();
  const [draft, setDraft] = useState<GuardrailsDraft>(() => toGuardrailsDraft(settings));
  const [errors, setErrors] = useState<GuardrailErrors>({});

  const save = async () => {
    const result = parseGuardrails(draft);
    if (!result.ok) return setErrors(result.errors);
    const changed = (Object.keys(result.value) as (keyof typeof result.value)[]).some((k) => result.value[k] !== settings[k]);
    if (!changed) return;
    const next = await action.run('save guardrails', () => api.saveSettings(result.value), 'Saved');
    if (next) onChange(next);
  };

  return (
    <Card title="Guardrails" description="Applied on every run, in every mode.">
      <div className="guard-grid">
        {FIELDS.map((f) => (
          <div key={f.key} className="field">
            <label htmlFor={`g-${f.key}`}>{f.label}</label>
            <input
              id={`g-${f.key}`}
              className="input mono"
              inputMode="numeric"
              value={draft[f.key]}
              aria-invalid={errors[f.key] ? true : undefined}
              onChange={(e) => {
                setDraft((d) => ({ ...d, [f.key]: e.target.value }));
                setErrors((er) => ({ ...er, [f.key]: undefined }));
              }}
              onBlur={save}
            />
            {errors[f.key] ? <p className="field-error" role="alert">{errors[f.key]}</p> : null}
          </div>
        ))}
      </div>
      <Blocklist settings={settings} onChange={onChange} />
      <p className="cell-sub">
        The same company and role are never applied to twice, whichever source they came from. All free-tier limits are on <a href="#/usage">Usage &amp; limits</a>.
      </p>
    </Card>
  );
}

/** "Never apply to": removable chips plus an inline add field (Enter adds, Escape cancels). */
function Blocklist({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const api = useApi();
  const action = useAction();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const save = async (blocklist: string[], message: string) => {
    const next = await action.run('update the blocklist', () => api.saveSettings({ blocklist }), message);
    if (next) onChange(next);
  };

  const add = async () => {
    const n = name.trim();
    setAdding(false);
    setName('');
    if (!n || settings.blocklist.includes(n)) return;
    await save([...settings.blocklist, n], `${n} added to your blocklist`);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') void add();
    if (e.key === 'Escape') {
      setAdding(false);
      setName('');
    }
  };

  return (
    <div>
      <div className="field-label">Never apply to</div>
      <div className="row blocklist">
        {settings.blocklist.map((b) => (
          <span key={b} className="block-chip">
            {b}
            <button type="button" className="chip-remove" aria-label={`Remove ${b}`} title={`Remove ${b}`} onClick={() => save(settings.blocklist.filter((x) => x !== b), `${b} removed from your blocklist`)}>
              ×
            </button>
          </span>
        ))}
        {adding ? (
          <span className="row">
            <label htmlFor="block-name" className="visually-hidden">Company to block</label>
            <input id="block-name" className="input chip-input" placeholder="Company name" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} />
            <Button size="sm" variant="strong" onClick={add}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setName(''); }}>Cancel</Button>
          </span>
        ) : (
          <button type="button" className="chip-add" onClick={() => setAdding(true)}>Add company</button>
        )}
      </div>
    </div>
  );
}
