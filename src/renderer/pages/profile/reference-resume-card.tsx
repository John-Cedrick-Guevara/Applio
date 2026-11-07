import type { ReferenceResume, ResumeImport } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { FileIcon } from '../../components/icons';
import { useToast } from '../../components/toast';
import { useAction } from '../../hooks/use-action';
import { formatShortDate } from '../../lib/format';

interface Props {
  resume?: ReferenceResume;
  templateOpen: boolean;
  onToggleTemplate: () => void;
  onImported: (result: ResumeImport) => void;
}

/** The uploaded resume that suggests facts for the bank and sets tone (SPEC F1). Parsing happens in main. */
export function ReferenceResumeCard({ resume, templateOpen, onToggleTemplate, onImported }: Props) {
  const api = useApi();
  const action = useAction();
  const toast = useToast();

  const replace = async () => {
    const next = await action.run('import the resume', () => api.importResume());
    if (!next) return; // null = picker cancelled
    const n = next.suggestions.length;
    toast.show(n ? `Found ${n} new fact${n === 1 ? '' : 's'} in ${next.resume.fileName}. Add the ones that are right.` : `Nothing new in ${next.resume.fileName}: every fact is already in your bank.`, 'success');
    onImported(next);
  };

  return (
    <section className="card profile-resume">
      <h2 className="card-title">Reference resume</h2>
      <div className="file-row">
        <FileIcon />
        <div className="file-row-text">
          <div className="file-row-name">{resume?.fileName ?? 'No resume yet'}</div>
          <div className="cell-sub">
            {resume ? `Uploaded ${formatShortDate(resume.uploadedAt)} · found ${resume.factsFound} ${resume.factsFound === 1 ? 'fact' : 'facts'}` : 'Upload a PDF or DOCX to find facts for your bank.'}
          </div>
        </div>
      </div>
      <p className="cell-sub">Sets tone and section order for every tailored resume. Output always uses the one ATS-safe template.</p>
      <div className="row card-actions">
        <Button busy={action.pending} onClick={replace}>{action.pending ? 'Reading…' : resume ? 'Replace' : 'Upload resume'}</Button>
        <Button aria-expanded={templateOpen} onClick={onToggleTemplate}>{templateOpen ? 'Hide template' : 'Preview template'}</Button>
      </div>
    </section>
  );
}
