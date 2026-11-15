import { useState } from 'react';
import type { Fact, FactGroup, FactGroupKind, Profile } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { Icon } from '../../components/icons';
import { useAction } from '../../hooks/use-action';
import { factFilterCounts, filterSections, groupFacts, type FactFilter } from './preferences-model';

interface FactBankProps {
  profile: Profile;
  adding: boolean;
  onCloseAdd: () => void;
  onChange: (facts: Fact[]) => void;
  onGroupsChange: (groups: FactGroup[]) => void;
  onSkillsChange: (skills: string[]) => void;
}

/**
 * Fact bank (SPEC F1): facts grouped by role, each with its tags and how often
 * drafts used it. Edit inline; the AI may only select and rephrase these.
 */
export function FactBank({ profile, adding, onCloseAdd, onChange, onGroupsChange, onSkillsChange }: FactBankProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [filter, setFilter] = useState<FactFilter>('all');
  const allSections = groupFacts(profile.factGroups, profile.facts);
  const sections = filterSections(allSections, filter);
  const counts = factFilterCounts(allSections, profile.skills);
  // Adding under a filter offers that kind's sections first; with none, every section stays available.
  const kindGroups = filter === 'all' ? [] : profile.factGroups.filter((g) => g.kind === filter).map((g) => g.name);
  const addGroups = kindGroups.length ? kindGroups : profile.factGroups.map((g) => g.name);

  const replace = (fact: Fact) => onChange(profile.facts.map((f) => (f.id === fact.id ? fact : f)));

  return (
    <div>
      <FilterRow value={filter} counts={counts} onChange={setFilter} />
      {adding ? (
        <AddFactForm
          key={filter}
          groups={addGroups}
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
      {filter !== 'all' && filter !== 'skills' && sections.length === 0 ? (
        <p className="cell-sub fact-empty">{`No ${FILTER_LABELS[filter].toLowerCase()} yet. Set a section's kind to ${KINDS.find((k) => k.value === filter)?.label} with its Edit section button.`}</p>
      ) : null}
      {filter === 'skills' ? (
        <SkillsEditor skills={profile.skills} onChange={onSkillsChange} />
      ) : filter === 'all' ? (
        <div className="skills">
          <div className="skills-title">Skills</div>
          <div className="tag-row">{profile.skills.map((s) => <span key={s} className="skill-chip">{s}</span>)}</div>
        </div>
      ) : null}
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

export const KINDS: { value: FactGroupKind; label: string }[] = [
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

const FILTER_LABELS: Record<FactFilter, string> = { all: 'All', experience: 'Experience', project: 'Projects', skills: 'Skills' };

/** One row of filter buttons (not tabs: they narrow one list); each says how many facts sit behind it. */
function FilterRow({ value, counts, onChange }: { value: FactFilter; counts: Record<FactFilter, number>; onChange: (f: FactFilter) => void }) {
  return (
    <div className="tabs fact-filter" role="group" aria-label="Filter the fact bank">
      {(Object.keys(FILTER_LABELS) as FactFilter[]).map((f) => (
        <button key={f} type="button" className="tab" aria-pressed={value === f} aria-label={`${FILTER_LABELS[f]}, ${counts[f]} ${counts[f] === 1 ? 'fact' : 'facts'}`} onClick={() => onChange(f)}>
          {FILTER_LABELS[f]}
          <span className="tab-count" aria-hidden="true">{counts[f]}</span>
        </button>
      ))}
    </div>
  );
}

/** The skill chips, with add and remove. Skills are stored as one list, saved whole on each change. */
function SkillsEditor({ skills, onChange }: { skills: string[]; onChange: (skills: string[]) => void }) {
  const api = useApi();
  const action = useAction();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(false);

  const save = async (next: string[]) => {
    const saved = await action.run('save the skills', () => api.saveSkills(next));
    if (saved) onChange(saved);
    return saved;
  };
  const add = async () => {
    const skill = draft.trim();
    if (!skill) return setError(true);
    setDraft('');
    if (skills.some((s) => s.toLowerCase() === skill.toLowerCase())) return;
    if (!(await save([...skills, skill]))) setDraft(skill);
  };

  return (
    <div className="skills">
      <div className="tag-row">
        {skills.map((s) => (
          <span key={s} className="skill-chip">
            {s}
            <button type="button" className="chip-remove" aria-label={`Remove ${s}`} onClick={() => void save(skills.filter((x) => x !== s))}>×</button>
          </span>
        ))}
      </div>
      <div className="row">
        <label htmlFor="new-skill" className="visually-hidden">New skill</label>
        <input id="new-skill" className="input" placeholder="Add a skill, e.g. Rust" value={draft} onChange={(e) => { setDraft(e.target.value); setError(false); }} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
        <Button size="sm" busy={action.pending} onClick={() => void add()}>Add skill</Button>
        {error ? <span className="field-error" role="alert">Write a skill first.</span> : null}
      </div>
    </div>
  );
}
