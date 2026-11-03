import { useState } from 'react';
import type { Profile } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { AsyncView } from '../../components/async-view';
import { Button } from '../../components/button';
import { PageHeader } from '../../components/page-header';
import { useAsync } from '../../hooks/use-async';
import { AnswerBank } from './answer-bank';
import { FactBank } from './fact-bank';
import { PreferencesCard } from './preferences-card';
import { ReferenceResumeCard } from './reference-resume-card';
import { TemplatePreview } from './template-preview';
import './profile.css';

type Tab = 'facts' | 'answers';

/** Profile (prototype screen 4, SPEC F1): the only material the AI may write from. */
export default function ProfilePage() {
  const api = useApi();
  const profile = useAsync(() => api.getProfile(), [api]);

  return (
    <div className="profile">
      <PageHeader title="Profile" description="The AI writes only from what is here. Nothing else gets into a resume or an answer." />
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

  const pick = (next: Tab) => {
    setTab(next);
    setAdding(false);
  };

  return (
    <>
      <div className="profile-top">
        <ReferenceResumeCard
          resume={profile.referenceResume}
          templateOpen={templateOpen}
          onToggleTemplate={() => setTemplateOpen((o) => !o)}
          onImported={(referenceResume) => onChange({ referenceResume })}
        />
        <PreferencesCard preferences={profile.preferences} onSaved={(preferences) => onChange({ preferences })} />
      </div>

      {templateOpen ? <TemplatePreview /> : null}

      <section className="card card-flush" aria-label="Fact and answer banks">
        <div className="card-header">
          <div className="tabs" role="tablist" aria-label="Profile data">
            <button type="button" role="tab" className="tab" aria-selected={tab === 'facts'} onClick={() => pick('facts')}>
              Fact bank · {profile.facts.length}
            </button>
            <button type="button" role="tab" className="tab" aria-selected={tab === 'answers'} onClick={() => pick('answers')}>
              Answer bank · {profile.answers.length}
            </button>
          </div>
          {adding ? null : (
            <Button variant="strong" onClick={() => setAdding(true)}>{tab === 'facts' ? 'Add fact' : 'Add answer'}</Button>
          )}
        </div>
        {tab === 'facts' ? (
          <FactBank profile={profile} adding={adding} onCloseAdd={() => setAdding(false)} onChange={(facts) => onChange({ facts })} />
        ) : (
          <AnswerBank answers={profile.answers} adding={adding} onCloseAdd={() => setAdding(false)} onChange={(answers) => onChange({ answers })} />
        )}
      </section>
    </>
  );
}
