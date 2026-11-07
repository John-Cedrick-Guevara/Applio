import { useState } from 'react';
import type { Contact, ContactLink } from '../../../shared/types';
import { useApi } from '../../api/api-context';
import { Button } from '../../components/button';
import { useAction } from '../../hooks/use-action';

/**
 * Résumé header and letter sign-off details (phone, location, links, education)
 * plus personal rules for Claude. The résumé prints these as written; Claude
 * can't change them.
 */
export function ContactCard({ contact, onSaved }: { contact: Contact; onSaved: (c: Contact) => void }) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="card profile-contact">
      <div className="spread">
        <h2 className="card-title">Contact and links</h2>
        {editing ? null : <Button size="sm" aria-label="Edit contact and links" onClick={() => setEditing(true)}>Edit</Button>}
      </div>
      {editing ? (
        <ContactForm
          contact={contact}
          onDone={(next) => {
            setEditing(false);
            if (next) onSaved(next);
          }}
        />
      ) : (
        <dl className="prefs-grid">
          <div><dt>Phone</dt><dd>{contact.phone || '—'}</dd></div>
          <div><dt>Location line</dt><dd>{contact.location || '—'}</dd></div>
          <div>
            <dt>Links</dt>
            <dd className="tag-row">
              {contact.links.length ? contact.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label}</a>) : '—'}
            </dd>
          </div>
          <div><dt>Education</dt><dd>{contact.education || '—'}</dd></div>
          <div className="span-2"><dt>Notes for Claude</dt><dd className="pre-line">{contact.notes || '—'}</dd></div>
        </dl>
      )}
    </section>
  );
}

/** One link per line, "Label https://…"; the label is everything before the last space. */
const parseLinks = (text: string): { links: ContactLink[] } | { error: string } => {
  const links: ContactLink[] = [];
  const lines = text.split('\n');
  for (const [i, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line) continue;
    const cut = line.lastIndexOf(' ');
    const label = cut > 0 ? line.slice(0, cut).trim() : '';
    const url = line.slice(cut + 1);
    if (!label || !/^https?:\/\/\S+$/i.test(url)) return { error: `Line ${i + 1} needs a label and a link starting with https://, e.g. "GitHub https://github.com/you".` };
    links.push({ label, url });
  }
  return { links };
};

function ContactForm({ contact, onDone }: { contact: Contact; onDone: (c: Contact | null) => void }) {
  const api = useApi();
  const action = useAction();
  const [draft, setDraft] = useState({ ...contact, links: contact.links.map((l) => `${l.label} ${l.url}`).join('\n') });
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof draft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key === 'links') setError(null);
  };

  const save = async () => {
    const parsed = parseLinks(draft.links);
    if ('error' in parsed) return setError(parsed.error);
    const saved = await action.run('save contact details', () => api.saveContact({ ...draft, links: parsed.links }), 'Contact details saved. New résumés use them.');
    if (saved) onDone(saved);
  };

  return (
    <>
      <div className="prefs-form">
        <div className="field">
          <label htmlFor="c-phone">Phone</label>
          <input id="c-phone" className="input" value={draft.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="c-loc">Location line</label>
          <input id="c-loc" className="input" placeholder="Philippines • Open to Remote" value={draft.location} onChange={(e) => set('location', e.target.value)} />
        </div>
        <div className="field span-2">
          <label htmlFor="c-links">Links <span className="label-aside">· one per line: label, then the link</span></label>
          <textarea id="c-links" className="textarea" rows={3} value={draft.links} aria-invalid={error ? true : undefined} onChange={(e) => set('links', e.target.value)} />
          {error ? <p className="field-error" role="alert">{error}</p> : null}
        </div>
        <div className="field span-2">
          <label htmlFor="c-edu">Education</label>
          <input id="c-edu" className="input" value={draft.education} onChange={(e) => set('education', e.target.value)} />
        </div>
        <div className="field span-2">
          <label htmlFor="c-notes">Notes for Claude <span className="label-aside">· personal rules, one per line</span></label>
          <textarea id="c-notes" className="textarea" rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="form-actions">
        <Button variant="ghost" size="sm" onClick={() => onDone(null)}>Cancel</Button>
        <Button variant="strong" size="sm" busy={action.pending} onClick={save}>Save contact and links</Button>
      </div>
    </>
  );
}
