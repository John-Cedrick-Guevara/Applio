import { useState } from 'react';
import type { Profile, ResumeImport } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { Button } from '../../components/button';
import { PageHeader } from '../../components/page-header';
import { useAsync } from '../../hooks/use-async';
import { AnswerBank } from './answer-bank';
import { ContactCard } from './contact-card';
import { FactBank } from './fact-bank';
import { PreferencesCard } from './preferences-card';
import { ReferenceResumeCard } from './reference-resume-card';
import { ResumeSuggestions } from './resume-suggestions';
import { TemplatePreview } from './template-preview';
import './profile.css';

type Tab = 'facts' | 'answers' | 'prefs' | 'resume';

/** The tabs in order; counts are added at render. */
const TAB_LIST: { id: Tab; label: string }[] = [
  { id: 'facts', label: 'Fact bank' },
  { id: 'answers', label: 'Answer bank' },
  { id: 'prefs', label: 'Preferences' },
  { id: 'resume', label: 'Résumé' },
];

type ProfilePatch = Partial<Profile> | ((current: Profile) => Partial<Profile>);

/** Profile (prototype screen 4, SPEC F1): the only material the AI may write from. */
export default function ProfilePage() {
  const api = useApi();
  const profile = useAsync(() => api.getProfile(), [api]);

  return (
    <div className="profile">
      <PageHeader title={<>My <strong>profile</strong></>} description="The AI writes only from what is here. Nothing else gets into a resume or an answer." />
      <AsyncView state={profile} what="your profile" rows={5}>
        {(p) => <ProfileBody profile={p} onChange={(patch) => profile.setData((cur) => ({ ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) }))} />}
      </AsyncView>
    </div>
  );
}

function ProfileBody({ profile, onChange }: { profile: Profile; onChange: (patch: ProfilePatch) => void }) {
  const [templateOpen, setTemplateOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('facts');
  // One add form per bank, each kept while the operator looks at another tab.
  const [adding, setAdding] = useState({ facts: false, answers: false });
  const setAddingFor = (id: 'facts' | 'answers', on: boolean) => setAdding((cur) => ({ ...cur, [id]: on }));
  // ponytail: suggestions live only on this screen; leaving it drops them — import again to get them back.
  const [imported, setImported] = useState<ResumeImport | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const counts: Partial<Record<Tab, number>> = { facts: profile.facts.length, answers: profile.answers.length };
  const pick = (next: Tab) => setTab(next);
  /** Arrow keys, Home and End move between tabs, wrapping at the ends. */
  const onTabKeys = (e: React.KeyboardEvent) => {
    const at = TAB_LIST.findIndex((t) => t.id === tab);
    const to = e.key === 'ArrowRight' ? (at + 1) % TAB_LIST.length : e.key === 'ArrowLeft' ? (at + TAB_LIST.length - 1) % TAB_LIST.length : e.key === 'Home' ? 0 : e.key === 'End' ? TAB_LIST.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    const next = TAB_LIST[to]!.id;
    setTab(next);
    document.getElementById(`profile-tab-${next}`)?.focus();
  };
  // Every panel stays mounted and only the chosen one shows, so an open editor or the résumé suggestions survive a look at another tab.
  const panel = (id: Tab, children: React.ReactNode) => (
    <div role="tabpanel" id={`profile-${id}`} aria-labelledby={`profile-tab-${id}`} hidden={tab !== id} className="profile-panel">{children}</div>
  );

  return (
    <>
      <div className="profile-tabrow">
        <div className="tabs" role="tablist" aria-label="Profile sections" onKeyDown={onTabKeys}>
          {TAB_LIST.map((t) => (
            <button key={t.id} id={`profile-tab-${t.id}`} type="button" role="tab" className="tab" tabIndex={tab === t.id ? 0 : -1} aria-selected={tab === t.id} aria-controls={`profile-${t.id}`} onClick={() => pick(t.id)}>
              {t.label}{counts[t.id] !== undefined ? <span className="tab-count">{counts[t.id]}</span> : null}
            </button>
          ))}
        </div>
        {(tab === 'facts' || tab === 'answers') && !adding[tab] ? (
          <Button variant="strong" onClick={() => setAddingFor(tab, true)}>{tab === 'facts' ? 'Add fact' : 'Add answer'}</Button>
        ) : null}
      </div>

      {panel('facts', (
        <section className="card card-flush" aria-label="Fact bank">
          <FactBank profile={profile} adding={adding.facts} onCloseAdd={() => setAddingFor('facts', false)} onChange={(facts) => onChange({ facts })} onGroupsChange={(factGroups) => onChange({ factGroups })} />
        </section>
      ))}
      {panel('answers', (
        <section className="card card-flush" aria-label="Answer bank">
          <AnswerBank answers={profile.answers} adding={adding.answers} onCloseAdd={() => setAddingFor('answers', false)} onChange={(answers) => onChange({ answers })} />
        </section>
      ))}
      {panel('prefs', (
        <PreferencesCard key={profile.contact.location} preferences={profile.preferences} location={profile.contact.location} onSaved={(preferences) => onChange({ preferences })} />
      ))}
      {panel('resume', (
        <>
          <ReferenceResumeCard
            resume={profile.referenceResume}
            templateOpen={templateOpen}
            onToggleTemplate={() => setTemplateOpen((o) => !o)}
            onImported={(result) => {
              onChange({ referenceResume: result.resume });
              setImported(result);
              setAddedCount(0);
            }}
          />
          {imported ? (
            <ResumeSuggestions
              key={imported.resume.uploadedAt}
              fileName={imported.resume.fileName}
              suggestions={imported.suggestions}
              onAdded={(fact) => {
                // From the latest profile, not this render's: two quick accepts must both land.
                onChange((cur) => ({ facts: [fact, ...cur.facts] }));
                setAddedCount((n) => n + 1);
              }}
              onDone={() => setImported(null)}
            />
          ) : null}
          {addedCount > 0 ? <p className="cell-sub" role="status">{addedCount} added to your Fact bank.</p> : null}
          <ContactCard contact={profile.contact} onSaved={(contact) => onChange({ contact })} />
          {templateOpen ? <TemplatePreview profile={profile} /> : null}
        </>
      ))}
    </>
  );
}
