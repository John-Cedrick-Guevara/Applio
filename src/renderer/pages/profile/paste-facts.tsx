import { useState } from 'react';
import type { FactExtraction, FactGroupKind, Profile } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { useAction } from '../../hooks/use-action';
import { KINDS } from './fact-bank';

const MAX_TEXT = 60_000;
/** A lone web address is a link for Claude to read; anything else is text to read. */
const LINK = /^https?:\/\/\S+$/i;

interface Row {
  id: number;
  group: string;
  kind: FactGroupKind;
  text: string;
  added: boolean;
}

interface Props {
  profile: Profile;
  /** Always given a function of the latest profile, so several quick adds all land. */
  onChange: (patch: (current: Profile) => Partial<Profile>) => void;
}

/**
 * Paste résumé text or a portfolio link and review the facts found in it (SPEC F1).
 * Nothing joins the fact bank until the operator adds it, because the AI may only
 * write from facts they have vouched for (SPEC §1).
 */
export function PasteFacts({ profile, onChange }: Props) {
  const api = useApi();
  const action = useAction();
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [found, setFound] = useState<{ result: FactExtraction; fromLink: boolean; rows: Row[] } | null>(null);

  const find = async () => {
    const text = value.trim();
    if (!text) return setProblem('Paste your résumé text or a portfolio link first.');
    if (text.length > MAX_TEXT) return setProblem(`That text is too long (${MAX_TEXT.toLocaleString('en-US')} characters max). Paste the most relevant part.`);
    setProblem(null);
    const fromLink = LINK.test(text);
    // Quiet: the failure shows inline, with its next step, where the operator is looking.
    const result = await action.run('read that', () => api.extractFacts({ kind: fromLink ? 'link' : 'text', value: text }), undefined, { quiet: true });
    if (result) setFound({ result, fromLink, rows: result.suggestions.map((s, id) => ({ id, group: s.group, kind: s.kind ?? 'other', text: s.text, added: false })) });
  };

  return (
    <section className="card" aria-label="Add facts from text or a link">
      <h2 className="card-title">Add facts from text or a link</h2>
      <p className="cell-sub">Paste your résumé, your portfolio's text or a link to your portfolio. Claude finds facts in it, and you choose which join your fact bank.</p>
      <label htmlFor="paste-facts-input" className="visually-hidden">Résumé text or portfolio link</label>
      <textarea id="paste-facts-input" className="textarea" rows={5} value={value} placeholder="Paste text, or one link starting with https://" onChange={(e) => { setValue(e.target.value); setProblem(null); }} />
      <div className="row">
        <span className="grow" />
        {problem ?? action.error ? <span className="field-error" role="alert">{problem ?? action.error}</span> : null}
        <Button variant="strong" busy={action.pending} onClick={find}>{action.pending ? 'Reading…' : 'Find facts'}</Button>
      </div>
      {found ? (
        <Review
          result={found.result}
          fromLink={found.fromLink}
          rows={found.rows}
          setRows={(rows) => setFound((cur) => (cur ? { ...cur, rows } : cur))}
          groups={profile.factGroups.map((g) => g.name)}
          onChange={onChange}
        />
      ) : null}
    </section>
  );
}

interface ReviewProps {
  result: FactExtraction;
  fromLink: boolean;
  rows: Row[];
  setRows: (rows: Row[]) => void;
  groups: string[];
  onChange: Props['onChange'];
}

/** The suggestions: edit, change section or kind, add, skip, or add all. */
function Review({ result, fromLink, rows, setRows, groups, onChange }: ReviewProps) {
  const api = useApi();
  const action = useAction();
  const left = rows.filter((r) => !r.added);
  const patch = (id: number, change: Partial<Row>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...change } : r)));
  const noun = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  /** Adds rows one at a time from a fresh read of the profile; each is marked added as it lands, so a repeat press can't add it twice. */
  const add = (ids: number[]) =>
    action.run('add the facts', async () => {
      let { skills, factGroups } = await api.getProfile();
      let marked = rows;
      for (const row of rows.filter((r) => ids.includes(r.id) && !r.added)) {
        const text = row.text.trim();
        const group = row.group.trim() || 'Imported';
        if (!text) throw new Error('Write the fact first, or skip it.');
        if (row.kind === 'skills') {
          if (!skills.some((s) => s.toLowerCase() === text.toLowerCase())) {
            skills = await api.saveSkills([...skills, text]);
            onChange(() => ({ skills }));
          }
        } else {
          const fact = await api.saveFact({ group, text });
          onChange((cur) => ({ facts: [fact, ...cur.facts] }));
          // A new section takes the chosen kind; one that already has a kind keeps it.
          const existing = factGroups.find((g) => g.name === group);
          if (!existing?.kind) {
            factGroups = await api.saveFactGroup({ ...(existing ?? { name: group }), kind: row.kind });
            onChange(() => ({ factGroups }));
          }
        }
        marked = marked.map((r) => (r.id === row.id ? { ...r, added: true } : r));
        setRows(marked);
      }
    });

  const notes = (
    <>
      {fromLink ? <p className="cell-sub" role="note">Claude read this page itself, so Applio can't check these facts against it. Read each one before you add it.</p> : null}
      {!fromLink && result.dropped > 0 ? <p className="cell-sub">{noun(result.dropped, 'suggestion', 'suggestions')} dropped: not found in your text.</p> : null}
    </>
  );

  if (rows.length === 0) {
    return (
      <div className="paste-review">
        {notes}
        <p className="cell-sub" role="status">{`Nothing new to add.${result.alreadyInBank ? ` ${result.alreadyInBank} already in your fact bank.` : ''}`}</p>
      </div>
    );
  }

  return (
    <div className="paste-review">
      <div className="row">
        <h3 className="field-label grow">{noun(left.length, 'fact', 'facts')} found</h3>
        {left.length > 0 ? <Button size="sm" variant="strong" busy={action.pending} onClick={() => void add(left.map((r) => r.id))}>Add all</Button> : null}
      </div>
      {notes}
      {result.alreadyInBank > 0 ? <p className="cell-sub">{result.alreadyInBank} already in your fact bank.</p> : null}
      <datalist id="paste-facts-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      <ul className="resume-suggestions">
        {rows.map((r) => (
          <li key={r.id} className="paste-row">
            <label htmlFor={`pf-text-${r.id}`} className="visually-hidden">Fact</label>
            <textarea id={`pf-text-${r.id}`} className="textarea" rows={2} value={r.text} disabled={r.added} onChange={(e) => patch(r.id, { text: e.target.value })} />
            <label htmlFor={`pf-group-${r.id}`} className="visually-hidden">Section</label>
            <input id={`pf-group-${r.id}`} className="input" list="paste-facts-groups" value={r.group} disabled={r.added} onChange={(e) => patch(r.id, { group: e.target.value })} />
            <label htmlFor={`pf-kind-${r.id}`} className="visually-hidden">Kind</label>
            <select id={`pf-kind-${r.id}`} className="select select-auto" value={r.kind} disabled={r.added} onChange={(e) => patch(r.id, { kind: e.target.value as FactGroupKind })}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            {r.added ? (
              <span className="cell-sub" role="status">Added</span>
            ) : (
              <span className="row">
                <Button size="sm" variant="ghost" busy={action.pending} onClick={() => setRows(rows.filter((x) => x.id !== r.id))}>Skip</Button>
                <Button size="sm" busy={action.pending} onClick={() => void add([r.id])}>Add</Button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
