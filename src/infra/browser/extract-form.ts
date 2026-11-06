/// <reference lib="dom" />
import type { FormField, ReadForm } from '../../core/apply/ats-form';

/**
 * Reads an application form from a page: each control, its label, whether it's
 * required, and whether a CAPTCHA is showing. It runs inside the ATS page (sent as
 * source, so it must use nothing outside its own body and the page's globals) and
 * in tests over saved pages.
 */
export function extractForm(given: Document | null): ReadForm {
  // In the page it's called with null and reads the page's own document.
  const doc = given ?? document;
  // Labels end in a required mark ("*", "✱") on most boards, sometimes after an invisible character; neither is part of the question.
  const clean = (s: string | null | undefined) => (s ?? '').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').replace(/\s*[*✱]+\s*$/, '').trim();
  const cssEscape = (s: string) => s.replace(/(["\\])/g, '\\$1');
  const byIds = (ids: string | null) => clean((ids ?? '').split(/\s+/).map((id) => doc.getElementById(id)?.textContent ?? '').join(' '));
  const selectorFor = (el: Element) => {
    const id = el.getAttribute('id');
    if (id) return `[id="${cssEscape(id)}"]`;
    const name = el.getAttribute('name');
    return name ? `${el.tagName.toLowerCase()}[name="${cssEscape(name)}"]` : '';
  };
  const labelOf = (el: Element): string => {
    const id = el.getAttribute('id');
    const forLabel = id ? doc.querySelector(`label[for="${cssEscape(id)}"]`) : null;
    return (
      clean(forLabel?.textContent) ||
      byIds(el.getAttribute('aria-labelledby')) ||
      clean(el.getAttribute('aria-label')) ||
      clean(el.closest('label')?.textContent) ||
      clean(el.closest('fieldset')?.querySelector('legend')?.textContent) ||
      clean(el.getAttribute('placeholder')) ||
      clean(el.getAttribute('name'))
    );
  };
  const isRequired = (el: Element) => el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';

  const fields: FormField[] = [];
  const radioGroups = new Map<string, FormField>();
  for (const el of Array.from(doc.querySelectorAll('input, textarea, select'))) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') ?? (tag === 'input' ? 'text' : tag)).toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image', 'search'].includes(type)) continue;
    if (el.hasAttribute('disabled') || el.getAttribute('readonly') === 'true' || el.hasAttribute('readonly')) continue;
    const selector = selectorFor(el);
    if (!selector) continue;

    if (type === 'radio') {
      const name = el.getAttribute('name') ?? selector;
      const optionLabel = labelOf(el);
      let group = radioGroups.get(name);
      if (!group) {
        const fieldset = el.closest('fieldset, [role="radiogroup"], [role="group"]');
        const question = clean(fieldset?.querySelector('legend')?.textContent) || byIds(fieldset?.getAttribute('aria-labelledby') ?? null) || name;
        group = { selector, kind: 'radio', label: question, required: false, options: [] };
        radioGroups.set(name, group);
        fields.push(group);
      }
      group.required ||= isRequired(el);
      group.options!.push({ label: optionLabel === group.label ? clean(el.getAttribute('value')) : optionLabel, value: clean(el.getAttribute('value')), selector });
      continue;
    }

    // A typed dropdown (role=combobox) acts like a select Applio can't fill safely.
    const kind: FormField['kind'] =
      tag === 'textarea' ? 'textarea'
      : tag === 'select' || el.getAttribute('role') === 'combobox' ? 'select'
      : (['email', 'tel', 'url', 'file', 'checkbox'] as const).find((k) => k === type) ?? 'text';
    const field: FormField = { selector, kind, label: labelOf(el), required: isRequired(el) };
    if (tag === 'select') {
      field.options = Array.from(el.querySelectorAll('option'))
        .filter((o) => clean(o.getAttribute('value')) !== '')
        .map((o) => ({ label: clean(o.textContent), value: clean(o.getAttribute('value')) }));
    }
    fields.push(field);
  }

  const buttons = Array.from(doc.querySelectorAll('button, input[type="submit"]'));
  const submitEl = buttons.find((b) => b.getAttribute('type') === 'submit') ?? buttons.find((b) => /submit|apply/i.test(clean(b.textContent) || clean(b.getAttribute('value'))));
  // A visible challenge frame; the invisible score-only kind doesn't stop a submit.
  const captcha = Array.from(doc.querySelectorAll('iframe')).some((f) => {
    const src = f.getAttribute('src') ?? '';
    const box = (f as HTMLElement).getBoundingClientRect?.();
    return /recaptcha\/.*bframe|hcaptcha\.com\/captcha|challenges\.cloudflare\.com/.test(src) && (!box || box.width * box.height > 2500);
  });
  return { fields, ...(submitEl ? { submit: selectorFor(submitEl) || 'button[type="submit"]' } : {}), captcha };
}
