/// <reference lib="dom" />
// These run inside the ATS page, sent as source by ats-window.ts, so they're typed against the DOM
// and must use nothing outside their own bodies.

/** Sets a control's value the way typing would, so React and Vue forms see it. Runs in the page. */
export function setValue(selector: string, value: string): boolean {
  const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (!el) return false;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/** Clicks an element. Runs in the page. */
export function click(selector: string): boolean {
  const el = document.querySelector(selector) as HTMLElement | null;
  el?.click();
  return !!el;
}

/** The page's visible text, for spotting a thank-you message. Runs in the page. */
export function pageText(): string {
  return document.body?.innerText ?? '';
}
