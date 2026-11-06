import { useState } from 'react';
import { DOC_CSS, letterBody, resumeBody, type DocumentOwner } from '../../../shared/templates/application-documents';
import type { Draft, Job } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { Icon } from '../../components/icons';
import { useAction } from '../../hooks/use-action';

export type DocTab = 'letter' | 'resume' | 'post';

interface DraftDocumentProps {
  job: Job;
  draft: Draft;
  owner: DocumentOwner;
  tab: DocTab;
  onTab: (tab: DocTab) => void;
  editing: boolean;
  /** Called with the saved draft, or null when editing was cancelled. */
  onEditDone: (draft: Draft | null) => void;
}

/**
 * The draft as a page preview: cover letter (editable), tailored resume, or
 * the original post. Letter and résumé use the same template the PDFs are
 * printed from (draft-files AC-5). Every resume line is drawn from the fact bank (SPEC F4).
 */
export function DraftDocument({ job, draft, owner, tab, onTab, editing, onEditDone }: DraftDocumentProps) {
  const api = useApi();
  const action = useAction();
  const letterWord = draft.kind === 'proposal' ? 'Proposal' : 'Cover letter';
  const file = tab === 'resume' ? 'resume' : tab === 'letter' ? 'letter' : null;
  const tabs: { id: DocTab; label: string }[] = [
    { id: 'letter', label: letterWord },
    { id: 'resume', label: 'Resume' },
    { id: 'post', label: 'Original post' },
  ];

  return (
    <>
      <div className="doc-bar">
        <div className="tabs" role="tablist" aria-label="Draft documents">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="doc-trace">
          <Icon name="shield" strokeWidth={1.8} className="trace-icon" />
          Every claim traced to your fact bank · {job.factsUsed} facts used
        </div>
        {file ? (
          <Button
            size="sm"
            disabled={!job.folderPath}
            title={job.folderPath ? undefined : 'Applio saves the files right after drafting'}
            busy={action.pending}
            onClick={() => action.run('open the file', () => api.openDraftFile(job.id, file))}
          >
            {file === 'letter' && draft.kind === 'proposal' ? 'Open proposal' : 'Open PDF'}
          </Button>
        ) : null}
      </div>
      <div className="doc-well">
        <div className="doc-paper" role="tabpanel">
          {tab === 'letter' && editing ? (
            <LetterEditor draft={draft} label={`Edit ${letterWord.toLowerCase()}`} onDone={onEditDone} />
          ) : null}
          {tab === 'letter' && !editing ? (
            <>
              {draft.edited ? <div className="cell-sub doc-edited">Edited by you</div> : null}
              <TemplatePreview html={letterBody(draft, job, owner)} />
            </>
          ) : null}
          {tab === 'resume' ? <TemplatePreview html={resumeBody(draft, owner)} /> : null}
          {tab === 'post' ? <p className="pre doc-post">{job.description}</p> : null}
        </div>
      </div>
    </>
  );
}

/** Inline letter editor; saves through the API so the edit is what gets sent. */
function LetterEditor({ draft, label, onDone }: { draft: Draft; label: string; onDone: (draft: Draft | null) => void }) {
  const api = useApi();
  const action = useAction();
  const [text, setText] = useState(draft.coverLetter);

  const save = async () => {
    const saved = await action.run('save your edits', () => api.updateCoverLetter(draft.jobId, text), 'Changes saved');
    if (saved) onDone(saved);
  };

  return (
    <div className="stack-sm">
      <label htmlFor="letter-edit" className="field-label">{label}</label>
      <textarea id="letter-edit" className="textarea doc-editor" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="form-actions">
        <Button variant="ghost" size="sm" onClick={() => onDone(null)}>Cancel</Button>
        <Button variant="strong" size="sm" busy={action.pending} disabled={!text.trim()} onClick={save}>Save changes</Button>
      </div>
    </div>
  );
}

/**
 * The exact markup the PDF is printed from, with its stylesheet. Safe to inject:
 * the template escapes every value, and it has no scripts, links or images.
 */
function TemplatePreview({ html }: { html: string }) {
  return (
    <>
      <style>{DOC_CSS}</style>
      <div className="applio-doc" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
