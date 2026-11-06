import { BrowserWindow } from 'electron';
import type { ReadForm } from '../../core/apply/ats-form';
import { planFill, type FillInput, type FillStep } from '../../core/apply/ats-plan';
import type { AtsOutcome } from '../../core/apply/send-application';
import { extractForm } from './extract-form';
import { click, pageText, setValue } from './page-scripts';

const FORM_WAIT_MS = 20_000;
const CONFIRM_WAIT_MS = 30_000;
const DONE_URL = /thank|confirm|success|submitted|application-received/i;
const DONE_TEXT = /thank(s| you) for (applying|your (application|interest))|application (was |has been )?(received|submitted)|we('ve| have) received your application/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Calls a self-contained function in the page; arguments go in as JSON, so no value can become code. */
const inPage = <T>(win: BrowserWindow, fn: (...args: never[]) => unknown, ...args: unknown[]): Promise<T> =>
  win.webContents.executeJavaScript(`(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`) as Promise<T>;

/** Attaches a file to a file input through the Chrome DevTools Protocol; pages can't set files from script. */
const attachFile = async (win: BrowserWindow, selector: string, path: string) => {
  const dbg = win.webContents.debugger;
  if (!dbg.isAttached()) dbg.attach('1.3');
  const { root } = (await dbg.sendCommand('DOM.getDocument', { depth: -1, pierce: true })) as { root: { nodeId: number } };
  const { nodeId } = (await dbg.sendCommand('DOM.querySelector', { nodeId: root.nodeId, selector })) as { nodeId: number };
  if (!nodeId) throw new Error(`no file input at ${selector}`);
  await dbg.sendCommand('DOM.setFileInputFiles', { nodeId, files: [path] });
};

const apply = async (win: BrowserWindow, step: FillStep) => {
  if (step.action === 'file') return attachFile(win, step.selector, step.value);
  if (step.action === 'check') return void (await inPage(win, click, step.value));
  await inPage(win, setValue, step.selector, step.value);
};

/**
 * Fills and submits one ATS form in Applio's own window (SPEC F5 channel 2). It
 * stops and hands the visible window to the operator for a CAPTCHA, a question
 * with no saved answer, or a page with no form. It reports submitted only when
 * a thank-you page or message appears.
 * ponytail: success is read from common thank-you wording and URLs; add per-ATS
 * signals if a board's confirmation goes unnoticed.
 */
export async function submitAtsForm({ url, input, visible }: { url: string; input: FillInput; visible: boolean }): Promise<AtsOutcome> {
  const win = new BrowserWindow({
    width: 1100, height: 900, show: visible, title: 'Applio — applying',
    // Its own session: the ATS's cookies never mix with the app's, and nothing here can reach Node.
    webPreferences: { partition: 'persist:ats', sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const handoff = (reason: string): AtsOutcome => {
    win.show();
    return { kind: 'handoff', reason };
  };

  try {
    await win.loadURL(url);
    let form: ReadForm = { fields: [], captcha: false };
    for (const start = Date.now(); Date.now() - start < FORM_WAIT_MS; await sleep(500)) {
      form = await inPage<ReadForm>(win, extractForm, null).catch(() => form);
      if (form.fields.length > 0 && form.submit) break;
    }
    if (form.fields.length === 0 || !form.submit) return handoff("Applio couldn't find the application form on this page.");
    if (form.captcha) return handoff('The form shows a CAPTCHA, which only you can answer.');

    const plan = planFill(form.fields, input);
    for (const step of plan.steps) await apply(win, step);
    if (plan.missing.length > 0) return handoff(`It asks things Applio has no saved answer for: ${plan.missing.slice(0, 3).join('; ')}${plan.missing.length > 3 ? '; …' : ''}.`);

    const before = win.webContents.getURL();
    await inPage(win, click, form.submit);
    for (const start = Date.now(); Date.now() - start < CONFIRM_WAIT_MS; await sleep(1000)) {
      const now = win.webContents.getURL();
      const text = await inPage<string>(win, pageText).catch(() => '');
      if ((now !== before && DONE_URL.test(now)) || DONE_TEXT.test(text)) {
        const screenshot = (await win.webContents.capturePage()).toPNG();
        win.destroy();
        return { kind: 'submitted', filled: plan.steps, screenshot };
      }
      const after = await inPage<ReadForm>(win, extractForm, null).catch(() => undefined);
      if (after?.captcha) return handoff('A CAPTCHA appeared after Submit, which only you can answer.');
    }
    win.show();
    return { kind: 'unconfirmed', filled: plan.steps };
  } catch (err) {
    win.show();
    throw err;
  }
}
