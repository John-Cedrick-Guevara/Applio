import { DOC_CSS, resumeBody } from '../../../shared/templates/application-documents';
import type { Draft, Profile } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { useAsync } from '../../hooks/use-async';

/**
 * The locked résumé layout with the operator's own header and fact-bank
 * sections (up to three lines each), so they can check how it prints before
 * any job is drafted (SPEC F4). Each application picks and rewords its own lines.
 */
export function TemplatePreview({ profile }: { profile: Profile }) {
  const api = useApi();
  // Name and email live in Settings; the preview shows them as the résumé will.
  const settings = useAsync(() => api.getSettings(), [api]).data;
  const name = settings?.fullName ?? '';
  const email = settings?.gmailAddress ?? '';
  const sample: Draft = {
    jobId: 'preview', kind: 'cover-letter', edited: false, answers: [], createdAt: '', coverLetter: '',
    headline: profile.preferences.targetRoles[0] ?? 'Your target role',
    summary: 'Three lines at most, rewritten for each job from your fact bank, leading with scale and real numbers.',
    resume: profile.factGroups.flatMap((g) => {
      const items = profile.facts.filter((f) => f.group === g.name).slice(0, 3).map((f) => ({ text: f.text, factId: f.id }));
      return items.length ? [{ heading: g.name, group: g.name, items }] : [];
    }),
  };
  const html = resumeBody(sample, { name, email, contact: profile.contact, groups: profile.factGroups });
  return (
    <section className="card" aria-label="Resume template preview">
      <div className="spread">
        <h2 className="card-title">Résumé layout</h2>
        <span className="cell-sub">One page · A4 · Times · single column · real text, no tables or images</span>
      </div>
      <div className="doc-well">
        <div className="doc-paper">
          <style>{DOC_CSS}</style>
          <div className="applio-doc" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </section>
  );
}
