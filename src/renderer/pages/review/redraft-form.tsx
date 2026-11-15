import { useState } from 'react';
import type { Draft, RedraftInput } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { useAsync } from '../../hooks/use-async';

const MAX_INSTRUCTION = 1000;

interface RedraftFormProps {
  /** Names the letter part: a proposal for freelance jobs. */
  kind: Draft['kind'];
  busy: boolean;
  onStart: (input: RedraftInput) => void;
  onCancel: () => void;
}

/**
 * Asks which part of a waiting draft to redraft and what to change in it. Nothing is
 * preselected, so no tokens are spent on a part by accident (spec: redraft-instructions AC-1).
 */
export function RedraftForm({ kind, busy, onStart, onCancel }: RedraftFormProps) {
  const api = useApi();
  const sections = useAsync(async () => (await api.getProfile()).factGroups, [api]);
  const [part, setPart] = useState<RedraftInput['part']>();
  const [instruction, setInstruction] = useState('');
  const [fact, setFact] = useState('');
  const [group, setGroup] = useState('');

  const letter = kind === 'proposal' ? 'Proposal' : 'Cover letter';
  const parts: { value: RedraftInput['part']; label: string }[] = [{ value: 'resume', label: 'Résumé' }, { value: 'letter', label: letter }, { value: 'both', label: 'Both' }];
  /** Why Start is off, said beside it. */
  const block = !part ? 'Choose what to redraft.' : fact.trim() && !group ? 'Pick the section this fact belongs to.' : undefined;

  const start = () => {
    if (!part || block) return;
    const said = instruction.trim();
    onStart({ part, ...(said ? { instruction: said } : {}), ...(fact.trim() ? { fact: { group, text: fact.trim() } } : {}) });
  };

  return (
    <form className="redraft-form" aria-label="Redraft" onSubmit={(e) => { e.preventDefault(); start(); }}>
      <fieldset className="field">
        <legend>What should Claude redraft?</legend>
        <div className="row">
          {parts.map((p) => (
            <label key={p.value} className="row">
              <input type="radio" name="redraft-part" checked={part === p.value} onChange={() => setPart(p.value)} />
              {p.label}
            </label>
          ))}
        </div>
        <p className="field-hint">The part you don't pick stays exactly as it is, so nothing is spent on it.</p>
      </fieldset>
      <div className="field">
        <label htmlFor="redraft-instruction">What should change? (optional)</label>
        <textarea id="redraft-instruction" className="textarea" rows={3} maxLength={MAX_INSTRUCTION} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
        <p className="field-hint">For this redraft only. Claude won't see it again next time.</p>
      </div>
      <div className="field">
        <label htmlFor="redraft-fact">Add a fact (optional)</label>
        <input id="redraft-fact" className="input" maxLength={MAX_INSTRUCTION} value={fact} onChange={(e) => setFact(e.target.value)} />
        <label htmlFor="redraft-section">Section</label>
        <select id="redraft-section" className="select" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">Choose a section</option>
          {(sections.data ?? []).map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
        </select>
        <p className="field-hint">Something true that isn't in your profile yet. It's saved to your fact bank so Claude can use it, here and on later jobs.</p>
      </div>
      <div className="form-actions">
        {block ? <span className="field-hint grow">{block}</span> : null}
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="strong" size="sm" type="submit" busy={busy} disabled={!!block}>Start redraft</Button>
      </div>
    </form>
  );
}
