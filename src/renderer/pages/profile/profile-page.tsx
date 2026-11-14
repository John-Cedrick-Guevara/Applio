import { useMemo, useState } from 'react';
import type { Profile, ResumeImport } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { TabList, TabPanel } from '../../components/tabs';
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
  const tabs = useMemo(() => TAB_LIST.map((t) => ({ ...t, count: counts[t.id] })), [profile.facts.length, profile.answers.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="profile-tabrow">
        <TabList label="Profile sections" idPrefix="profile" tabs={tabs} value={tab} onChange={setTab} />
        {(tab === 'facts' || tab === 'answers') && !adding[tab] ? (
          <Button variant="strong" onClick={() => setAddingFor(tab, true)}>{tab === 'facts' ? 'Add fact' : 'Add answer'}</Button>
        ) : null}
      </div>

      <TabPanel idPrefix="profile" id="facts" active={tab === 'facts'}>
        <section className="card card-flush" aria-label="Fact bank">
          <FactBank profile={profile} adding={adding.facts} onCloseAdd={() => setAddingFor('facts', false)} onChange={(facts) => onChange({ facts })} onGroupsChange={(factGroups) => onChange({ factGroups })} />
        </section>
      </TabPanel>
      <TabPanel idPrefix="profile" id="answers" active={tab === 'answers'}>
        <section className="card card-flush" aria-label="Answer bank">
          <AnswerBank answers={profile.answers} adding={adding.answers} onCloseAdd={() => setAddingFor('answers', false)} onChange={(answers) => onChange({ answers })} />
        </section>
      </TabPanel>
      <TabPanel idPrefix="profile" id="prefs" active={tab === 'prefs'}>
        <PreferencesCard key={profile.contact.location} preferences={profile.preferences} location={profile.contact.location} onSaved={(preferences) => onChange({ preferences })} />
      </TabPanel>
      <TabPanel idPrefix="profile" id="resume" active={tab === 'resume'}>
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
      </TabPanel>
    </>
  );
}
