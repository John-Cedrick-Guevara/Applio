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

/** Profile (prototype screen 4, SPEC F1): the only material the AI may write from. */
export default function ProfilePage() {
  const api = useApi();
  const profile = useAsync(() => api.getProfile(), [api]);

  return (
    <div className="profile">
      <PageHeader title={<>My <strong>profile</strong></>} description="The AI writes only from what is here. Nothing else gets into a resume or an answer." />
      <AsyncView state={profile} what="your profile" rows={5}>
        {(p) => <ProfileBody profile={p} onChange={(patch) => profile.setData((cur) => ({ ...cur, ...patch }))} />}
      </AsyncView>
    </div>
  );
}

function ProfileBody({ profile, onChange }: { profile: Profile; onChange: (patch: Partial<Profile>) => void }) {
  const [templateOpen, setTemplateOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('facts');
  const [adding, setAdding] = useState(false);
  // ponytail: suggestions live only on this screen; leaving it drops them — import again to get them back.
  const [imported, setImported] = useState<ResumeImport | null>(null);

  const pick = (next: Tab) => {
    setTab(next);
    setAdding(false);
  };
  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'facts', label: 'Fact bank', count: profile.facts.length },
    { id: 'answers', label: 'Answer bank', count: profile.answers.length },
    { id: 'prefs', label: 'Preferences' },
    { id: 'resume', label: 'Résumé' },
  ];
  // Every panel stays mounted and only the chosen one shows, so an open editor or the résumé suggestions survive a look at another tab.
  const panel = (id: Tab, label: string, children: React.ReactNode) => (
    <div role="tabpanel" id={`profile-${id}`} aria-label={label} hidden={tab !== id} className="profile-panel">{children}</div>
  );

  return (
    <>
      <div className="profile-tabrow">
        <div className="tabs" role="tablist" aria-label="Profile sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} aria-controls={`profile-${t.id}`} onClick={() => pick(t.id)}>
              {t.label}{t.count !== undefined ? <span className="tab-count">{t.count}</span> : null}
            </button>
          ))}
        </div>
        {(tab === 'facts' || tab === 'answers') && !adding ? (
          <Button variant="strong" onClick={() => setAdding(true)}>{tab === 'facts' ? 'Add fact' : 'Add answer'}</Button>
        ) : null}
      </div>

      {panel('facts', 'Fact bank', (
        <section className="card card-flush" aria-label="Fact bank">
          <FactBank profile={profile} adding={adding && tab === 'facts'} onCloseAdd={() => setAdding(false)} onChange={(facts) => onChange({ facts })} onGroupsChange={(factGroups) => onChange({ factGroups })} />
        </section>
      ))}
      {panel('answers', 'Answer bank', (
        <section className="card card-flush" aria-label="Answer bank">
          <AnswerBank answers={profile.answers} adding={adding && tab === 'answers'} onCloseAdd={() => setAdding(false)} onChange={(answers) => onChange({ answers })} />
        </section>
      ))}
      {panel('prefs', 'Preferences', (
        <PreferencesCard preferences={profile.preferences} location={profile.contact.location} onSaved={(preferences) => onChange({ preferences })} />
      ))}
      {panel('resume', 'Résumé', (
        <>
          <ReferenceResumeCard
            resume={profile.referenceResume}
            templateOpen={templateOpen}
            onToggleTemplate={() => setTemplateOpen((o) => !o)}
            onImported={(result) => {
              onChange({ referenceResume: result.resume });
              setImported(result);
            }}
          />
          {imported ? (
            <ResumeSuggestions
              key={imported.resume.uploadedAt}
              fileName={imported.resume.fileName}
              suggestions={imported.suggestions}
              onAdded={(fact) => onChange({ facts: [fact, ...profile.facts] })}
              onDone={() => setImported(null)}
            />
          ) : null}
          <ContactCard contact={profile.contact} onSaved={(contact) => onChange({ contact })} />
          {templateOpen ? <TemplatePreview profile={profile} /> : null}
        </>
      ))}
    </>
  );
}
