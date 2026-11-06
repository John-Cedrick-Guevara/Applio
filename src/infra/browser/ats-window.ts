import { BrowserWindow } from 'electron';
import type { ReadForm } from '../../core/apply/ats-form';
import { planFill, type FillInput, type FillStep } from '../../core/apply/ats-plan';
import type { AtsOutcome } from '../../core/apply/send-application';
import { looksSubmitted } from './confirmation';
import { extractForm } from './extract-form';
import { click, pageText, setValue } from './page-scripts';

const FORM_WAIT_MS = 20_000;
const CONFIRM_WAIT_MS = 30_000;

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

/** Waits up to 20 s for a form with a submit control to show, as pages often build it late. */
const readForm = async (win: BrowserWindow): Promise<ReadForm> => {
  let form: ReadForm = { fields: [], captcha: false };
  for (const start = Date.now(); Date.now() - start < FORM_WAIT_MS; await sleep(500)) {
    form = await inPage<ReadForm>(win, extractForm, null).catch(() => form);
    if (form.fields.length > 0 && form.submit) break;
  }
  return form;
};

/** A window for one application, isolated from the app and from Node, in the given session. */
const formWindow = (partition: string, visible: boolean, title: string) => {
  const win = new BrowserWindow({ width: 1100, height: 900, show: visible, title, webPreferences: { partition, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return win;
};

/**
 * Applies every step, then detaches the DevTools debugger the file uploads needed.
 * A window closed with the debugger still attached crashes the whole app (found by `npm run e2e`).
 */
const applyAll = async (win: BrowserWindow, steps: readonly FillStep[]) => {
  try {
    for (const step of steps) await apply(win, step);
  } finally {
    if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach();
  }
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
 * a thank-you page or message appears that wasn't there before Submit.
 */
export async function submitAtsForm({ url, input, visible }: { url: string; input: FillInput; visible: boolean }): Promise<AtsOutcome> {
  // Its own session: the ATS's cookies never mix with the app's, and nothing here can reach Node.
  const win = formWindow('persist:ats', visible, 'Applio — applying');
  // Approved sends leave the window to the operator; a hidden autonomous run closes it, and the job waits in Review.
  const release = () => (visible ? win.show() : win.close());
  const handoff = (reason: string): AtsOutcome => {
    release();
    return { kind: 'handoff', reason };
  };

  try {
    await win.loadURL(url);
    const form = await readForm(win);
    if (form.fields.length === 0 || !form.submit) return handoff("Applio couldn't find the application form on this page.");
    if (form.captcha) return handoff('The form shows a CAPTCHA, which only you can answer.');

    const plan = planFill(form.fields, input);
    await applyAll(win, plan.steps);
    if (plan.missing.length > 0) return handoff(`It asks things Applio has no saved answer for: ${plan.missing.slice(0, 3).join('; ')}${plan.missing.length > 3 ? '; …' : ''}.`);

    const before = { url: win.webContents.getURL(), text: await inPage<string>(win, pageText).catch(() => '') };
    await inPage(win, click, form.submit);
    for (const start = Date.now(); Date.now() - start < CONFIRM_WAIT_MS; await sleep(1000)) {
      const now = { url: win.webContents.getURL(), text: await inPage<string>(win, pageText).catch(() => '') };
      if (looksSubmitted(before, now)) {
        const screenshot = (await win.webContents.capturePage()).toPNG();
        win.close();
        return { kind: 'submitted', filled: plan.steps, screenshot };
      }
      const after = await inPage<ReadForm>(win, extractForm, null).catch(() => undefined);
      if (after?.captcha) return handoff('A CAPTCHA appeared after Submit, which only you can answer.');
    }
    release();
    return { kind: 'unconfirmed', filled: plan.steps };
  } catch (err) {
    release();
    throw err;
  }
}

/**
 * Assisted fill (SPEC F5 channels 3–4): opens a platform or career-site form in
 * the operator's own signed-in session (`persist:platform`, where they sign in
 * once) and fills what it can. It never presses Submit (MNB-1): there is no
 * submit step here at all, and the window is left to the operator.
 */
export async function fillPlatformForm({ url, input }: { url: string; input: FillInput }): Promise<{ filled: number; missing: string[] }> {
  const win = formWindow('persist:platform', true, 'Applio — check the form, then click Submit yourself');
  await win.loadURL(url);
  const form = await readForm(win);
  if (form.fields.length === 0) return { filled: 0, missing: ['Applio found no form on this page. Sign in or open the application step in the window, then click Fill again.'] };
  const plan = planFill(form.fields, input);
  await applyAll(win, plan.steps);
  return { filled: plan.steps.length, missing: plan.missing };
}
