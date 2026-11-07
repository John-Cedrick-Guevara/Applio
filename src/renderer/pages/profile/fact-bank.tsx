import { useState } from 'react';
import type { Fact, FactGroup, FactGroupKind, Profile } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { Icon } from '../../components/icons';
import { useAction } from '../../hooks/use-action';
import { groupFacts } from './preferences-model';

interface FactBankProps {
  profile: Profile;
  adding: boolean;
  onCloseAdd: () => void;
  onChange: (facts: Fact[]) => void;
  onGroupsChange: (groups: FactGroup[]) => void;
}

/**
 * Fact bank (SPEC F1): facts grouped by role, each with its tags and how often
 * drafts used it. Edit inline; the AI may only select and rephrase these.
 */
export function FactBank({ profile, adding, onCloseAdd, onChange, onGroupsChange }: FactBankProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const sections = groupFacts(profile.factGroups, profile.facts);

  const replace = (fact: Fact) => onChange(profile.facts.map((f) => (f.id === fact.id ? fact : f)));

  return (
    <div>
      {adding ? (
        <AddFactForm
          groups={profile.factGroups.map((g) => g.name)}
          onCancel={onCloseAdd}
          onSaved={(fact) => {
            onChange([fact, ...profile.facts]);
            onCloseAdd();
          }}
        />
      ) : null}
      {sections.map((section) => (
        <section key={section.name} className="fact-group" aria-labelledby={`group-${section.name}`}>
          <div className="fact-group-head">
            <h3 id={`group-${section.name}`}>{section.name}</h3>
            <span className="cell-sub">{section.meta}</span>
            <Button variant="icon" aria-label={`Edit section ${section.name}`} title="Edit section" onClick={() => setEditingGroup(section.name)}>
              <Icon name="edit" />
            </Button>
          </div>
          {editingGroup === section.name ? (
            <GroupEditor
              group={profile.factGroups.find((g) => g.name === section.name) ?? { name: section.name }}
              onDone={(groups) => {
                setEditingGroup(null);
                if (groups) onGroupsChange(groups);
              }}
            />
          ) : (() => {
            const g = profile.factGroups.find((x) => x.name === section.name);
            return g?.context || g?.link ? (
              <div className="group-details cell-sub">
                {g.context ? <span>{g.context}</span> : null}
                {g.link ? <a href={g.link} target="_blank" rel="noreferrer">{g.link.replace(/^https?:\/\//, '')}</a> : null}
              </div>
            ) : null;
          })()}
          {section.facts.map((fact) =>
            fact.id === editingId ? (
              <FactEditor
                key={fact.id}
                fact={fact}
                onCancel={() => setEditingId(null)}
                onSaved={(next) => {
                  setEditingId(null);
                  replace(next);
                }}
                onDeleted={() => {
                  setEditingId(null);
                  onChange(profile.facts.filter((f) => f.id !== fact.id));
                }}
              />
            ) : (
              <div key={fact.id} className="fact-row">
                <div className="fact-text">{fact.text}</div>
                <div className="tag-row">{fact.tags.map((t) => <span key={t} className="mini-tag">{t}</span>)}</div>
                <span className="fact-used mono">used {fact.timesUsed}×</span>
                <Button variant="icon" aria-label="Edit fact" title="Edit fact" onClick={() => setEditingId(fact.id)}>
                  <Icon name="edit" />
                </Button>
              </div>
            ),
          )}
        </section>
      ))}
      <div className="skills">
        <div className="skills-title">Skills</div>
        <div className="tag-row">{profile.skills.map((s) => <span key={s} className="skill-chip">{s}</span>)}</div>
      </div>
    </div>
  );
}

/** New-fact form: one achievement, placed in a role or section. */
function AddFactForm({ groups, onCancel, onSaved }: { groups: string[]; onCancel: () => void; onSaved: (fact: Fact) => void }) {
  const api = useApi();
  const action = useAction();
  const [text, setText] = useState('');
  const [group, setGroup] = useState(groups[0] ?? 'Projects');
  const [error, setError] = useState(false);

  const save = async () => {
    if (!text.trim()) return setError(true);
    const fact = await action.run('save the fact', () => api.saveFact({ group, text: text.trim() }), 'Fact added. The AI can use it from the next run.');
    if (fact) onSaved(fact);
  };

  return (
    <div className="add-panel">
      <label htmlFor="new-fact" className="field-label">
        New fact <span className="label-aside">· one achievement, with a number if you have one</span>
      </label>
      <textarea id="new-fact" className="textarea add-fact-text" value={text} onChange={(e) => { setText(e.target.value); setError(false); }} />
      <div className="row">
        <label htmlFor="new-fact-group" className="cell-secondary">Add to</label>
        <select id="new-fact-group" className="select select-auto" value={group} onChange={(e) => setGroup(e.target.value)}>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="grow" />
        {error ? <span className="field-error" role="alert">Write the fact first.</span> : null}
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="strong" size="sm" busy={action.pending} onClick={save}>Save fact</Button>
      </div>
    </div>
  );
}

/** Inline editor replacing a fact row. Delete lives here so it's always a deliberate second step. */
function FactEditor({ fact, onCancel, onSaved, onDeleted }: { fact: Fact; onCancel: () => void; onSaved: (f: Fact) => void; onDeleted: () => void }) {
  const api = useApi();
  const action = useAction();
  const [text, setText] = useState(fact.text);

  const save = async () => {
    if (!text.trim()) return;
    const next = await action.run('update the fact', () => api.saveFact({ id: fact.id, group: fact.group, text: text.trim() }), 'Fact updated');
    if (next) onSaved(next);
  };

  const remove = async () => {
    const done = await action.run('delete the fact', () => api.deleteFact(fact.id).then(() => true), 'Fact deleted');
    if (done) onDeleted();
  };

  return (
    <div className="fact-row">
      <label htmlFor={`fact-${fact.id}`} className="visually-hidden">Fact text</label>
      <input id={`fact-${fact.id}`} className="input fact-input" value={text} autoFocus onChange={(e) => setText(e.target.value)} />
      <Button variant="danger" size="sm" busy={action.pending} onClick={remove}>Delete fact</Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      <Button variant="strong" size="sm" busy={action.pending} onClick={save}>Save</Button>
    </div>
  );
}

const KINDS: { value: FactGroupKind; label: string }[] = [
  { value: 'experience', label: 'Experience' },
  { value: 'project', label: 'Project' },
  { value: 'skills', label: 'Skills' },
  { value: 'certifications', label: 'Certifications & achievements' },
  { value: 'other', label: 'Other' },
];

/** A section's résumé details: what it is, its dates, its context line and its link. */
function GroupEditor({ group, onDone }: { group: FactGroup; onDone: (groups: FactGroup[] | null) => void }) {
  const api = useApi();
  const action = useAction();
  const [draft, setDraft] = useState({ kind: group.kind ?? '', dates: group.dates ?? '', context: group.context ?? '', link: group.link ?? '' });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof draft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  };
  const id = (k: string) => `g-${k}-${group.name}`;

  const save = async () => {
    const link = draft.link.trim();
    if (link && !/^https?:\/\/\S+$/i.test(link)) return setError('The link should start with https://');
    // Only filled-in details are sent; an emptied field clears that detail.
    const next: FactGroup = { name: group.name };
    if (draft.kind) next.kind = draft.kind as FactGroupKind;
    if (draft.dates.trim()) next.dates = draft.dates.trim();
    if (draft.context.trim()) next.context = draft.context.trim();
    if (link) next.link = link;
    const saved = await action.run('save the section', () => api.saveFactGroup(next), 'Section saved');
    if (saved) onDone(saved);
  };

  return (
    <div className="group-editor">
      <div className="prefs-form">
        <div className="field">
          <label htmlFor={id('kind')}>Kind</label>
          <select id={id('kind')} className="select" value={draft.kind} onChange={(e) => set('kind', e.target.value)}>
            <option value="">Not set</option>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id('dates')}>Dates</label>
          <input id={id('dates')} className="input" placeholder="Jun 2026 – Oct 2026" value={draft.dates} onChange={(e) => set('dates', e.target.value)} />
        </div>
        <div className="field span-2">
          <label htmlFor={id('context')}>Context line</label>
          <input id={id('context')} className="input" placeholder="What the company or project is, and its scale or stack" value={draft.context} onChange={(e) => set('context', e.target.value)} />
        </div>
        <div className="field span-2">
          <label htmlFor={id('link')}>Link</label>
          <input id={id('link')} className="input" placeholder="https://" value={draft.link} aria-invalid={error ? true : undefined} onChange={(e) => set('link', e.target.value)} />
          {error ? <p className="field-error" role="alert">{error}</p> : null}
        </div>
      </div>
      <div className="form-actions">
        <Button variant="ghost" size="sm" onClick={() => onDone(null)}>Cancel</Button>
        <Button variant="strong" size="sm" busy={action.pending} onClick={save}>Save section</Button>
      </div>
    </div>
  );
}
