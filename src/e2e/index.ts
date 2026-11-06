import { app, session } from 'electron';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FillInput } from '../core/apply/ats-plan';
import { fillPlatformForm, submitAtsForm } from '../infra/browser/ats-window';

/*
 * End-to-end check of Applio's form windows against local fake ATS pages
 * (`npm run e2e`). The real submit and fill code runs in real Electron windows;
 * every request that isn't to this local server is blocked, so nothing can reach
 * a real company. Exits 1 if any scenario doesn't end as expected.
 */

const labelled = (id: string, label: string, input: string) => `<label for="${id}">${label}</label>${input}`;
const field = (id: string, label: string, extra = '') => labelled(id, label, `<input id="${id}" name="${id}" ${extra}>`);

/** A Greenhouse-like form: a real multipart POST, then a thank-you page. */
const standard = (extra = '') => `<!doctype html><html><body><h1>Backend Engineer</h1>
<form method="post" action="/submit/standard" enctype="multipart/form-data">
${field('first_name', 'First Name', 'required')}${field('last_name', 'Last Name', 'required')}
${field('email', 'Email', 'type="email" required')}${field('phone', 'Phone', 'type="tel"')}
${labelled('resume', 'Resume/CV', '<input id="resume" name="resume" type="file" required>')}
${labelled('cover', 'Cover Letter', '<textarea id="cover" name="cover"></textarea>')}
${extra}<button type="submit">Submit application</button></form></body></html>`;

/** A React-style form: values only count once an input event updates its state; it posts JSON. */
const reactLike = `<!doctype html><html><body><h1>Engineer</h1><div id="app">
${field('fullName', 'Full name', 'required')}${field('email', 'Email', 'type="email" required')}
${labelled('cv', 'Resume', '<input id="cv" type="file" required>')}
<button type="submit" id="go">Apply</button></div>
<script>
const state = {};
for (const el of document.querySelectorAll('input:not([type=file])')) el.addEventListener('input', (e) => { state[e.target.id] = e.target.value; });
document.getElementById('cv').addEventListener('change', (e) => { const f = e.target.files[0]; state.cv = f ? f.name + ':' + f.size : ''; });
document.getElementById('go').addEventListener('click', async () => {
  await fetch('/submit/react', { method: 'POST', body: JSON.stringify(state) });
  location.href = '/thanks';
});
</script></body></html>`;

/** Says "Thank you for your interest" before anything happens, then fails validation on submit. */
const invalid = `<!doctype html><html><body><p>Thank you for your interest in Acme.</p>
${field('email', 'Email', 'type="email" required')}<button type="submit" id="go">Submit</button>
<p id="err"></p><script>document.getElementById('go').addEventListener('click', () => { document.getElementById('err').textContent = 'Something went wrong. Please try again.'; });</script>
</body></html>`;

const thanks = '<!doctype html><html><body><h1>Thank you for applying!</h1><p>We received your application.</p></body></html>';

interface Received {
  path: string;
  body: string;
}

/** Runs the scenarios against a local server and reports each as PASS or FAIL. */
async function main() {
  const received: Received[] = [];
  const read = (req: IncomingMessage) => new Promise<string>((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('latin1')));
  });
  const pages: Record<string, string> = {
    '/standard': standard(),
    '/unknown': standard(field('company', 'Current company', 'required')),
    '/captcha': standard('<iframe src="https://newassets.hcaptcha.com/captcha/v1/abc" width="300" height="80"></iframe>'),
    '/react': reactLike,
    '/invalid': invalid,
    '/assist': standard(),
    '/thanks': thanks,
  };
  const server = createServer(async (req, res) => {
    if (req.method === 'POST') {
      received.push({ path: req.url ?? '', body: await read(req) });
      res.writeHead(303, { location: '/thanks' }).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' }).end(pages[req.url ?? ''] ?? 'not found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // Nothing leaves this machine: both form sessions may only reach the local server.
  for (const partition of ['persist:ats', 'persist:platform']) {
    session.fromPartition(partition).webRequest.onBeforeRequest((details, done) => done({ cancel: !details.url.startsWith(base) && !details.url.startsWith('devtools:') }));
  }

  const dir = mkdtempSync(join(tmpdir(), 'applio-e2e-'));
  const resume = join(dir, 'resume.pdf');
  writeFileSync(resume, '%PDF-1.7 e2e résumé');
  const input: FillInput = {
    applicant: { fullName: 'Sam Rivera', email: 'sam@example.com' },
    files: { resume },
    letter: 'Dear team, I build APIs.',
    answers: [{ question: 'Phone', answer: '+63 917 555 0100' }],
  };

  const results: { name: string; ok: boolean; detail: string }[] = [];
  const check = (name: string, ok: boolean, detail: string) => results.push({ name, ok, detail });
  const postsTo = (path: string) => received.filter((r) => r.path === path);

  // A scenario that throws is reported as a failure, and the rest still run.
  const attempt = async <T>(name: string, run: () => Promise<T>): Promise<T | undefined> => {
    console.log(`[e2e] running: ${name}`);
    return run().catch((err: unknown) => (check(`${name}: ran without crashing`, false, err instanceof Error ? err.message : String(err)), undefined));
  };
  const none = { kind: 'crashed' } as const;

  const standardRun = (await attempt('standard form', () => submitAtsForm({ url: `${base}/standard`, input, visible: false }))) ?? none;
  const posted = postsTo('/submit/standard')[0]?.body ?? '';
  check('standard form: submitted and confirmed', standardRun.kind === 'submitted', standardRun.kind);
  check('standard form: name, email, phone and letter arrived', ['Sam', 'Rivera', 'sam@example.com', '+63 917 555 0100', 'Dear team, I build APIs.'].every((v) => posted.includes(v)), posted.slice(0, 0));
  check('standard form: the résumé file arrived', posted.includes('filename="resume.pdf"') && posted.includes('%PDF-1.7'), posted.includes('filename=') ? 'file part present' : 'no file part');
  check('standard form: a confirmation screenshot was taken', standardRun.kind === 'submitted' && (standardRun.screenshot?.length ?? 0) > 1000, standardRun.kind === 'submitted' ? `${standardRun.screenshot?.length ?? 0} bytes` : standardRun.kind);

  const reactRun = (await attempt('react', () => submitAtsForm({ url: `${base}/react`, input, visible: false }))) ?? none;
  const reactBody = postsTo('/submit/react')[0]?.body ?? '{}';
  const state = JSON.parse(reactBody) as Record<string, string>;
  check('React-style form: submitted and confirmed', reactRun.kind === 'submitted', reactRun.kind);
  check('React-style form: its state saw the typed values', state.fullName === 'Sam Rivera' && state.email === 'sam@example.com', reactBody);
  check('React-style form: its state saw the attached file', /^resume\.pdf:\d+$/.test(state.cv ?? ''), state.cv ?? 'none');

  const unknownRun = (await attempt('unknown', () => submitAtsForm({ url: `${base}/unknown`, input, visible: false }))) ?? none;
  check('unanswered required question: handed over, not sent', unknownRun.kind === 'handoff' && /Current company/.test(unknownRun.reason) && postsTo('/submit/standard').length === 1, unknownRun.kind === 'handoff' ? unknownRun.reason : unknownRun.kind);

  const captchaRun = (await attempt('captcha', () => submitAtsForm({ url: `${base}/captcha`, input, visible: false }))) ?? none;
  check('CAPTCHA: handed over, not sent', captchaRun.kind === 'handoff' && /CAPTCHA/.test(captchaRun.reason) && postsTo('/submit/standard').length === 1, captchaRun.kind === 'handoff' ? captchaRun.reason : captchaRun.kind);

  const invalidRun = (await attempt('invalid', () => submitAtsForm({ url: `${base}/invalid`, input, visible: false }))) ?? none;
  check('failed submit on a page that already said "thank you": not counted as sent', invalidRun.kind === 'unconfirmed', invalidRun.kind);

  const before = received.length;
  const assist = (await attempt('assisted fill', () => fillPlatformForm({ url: `${base}/assist`, input }))) ?? { filled: 0, missing: [] };
  await new Promise((r) => setTimeout(r, 2000));
  check('assisted fill: filled the form', assist.filled >= 5, `${assist.filled} fields, missing: ${assist.missing.join('; ') || 'none'}`);
  check('assisted fill: never submitted', received.length === before, `${received.length - before} posts`);

  const outside = received.length;
  check('nothing was sent anywhere but the local server', outside === 2, `${outside} local posts`);

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  (${r.detail})`}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `${failed} of ${results.length} failed` : `all ${results.length} passed`);
  server.close();
  app.exit(failed ? 1 : 0);
}

app.whenReady().then(main).catch((err: unknown) => {
  console.error('[e2e] crashed', err);
  app.exit(1);
});
