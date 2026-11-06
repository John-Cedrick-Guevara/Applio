// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it } from 'vitest';
import { createGmail } from './gmail';

const PASS = 'abcd efgh ijkl mnop';
let dir = '';
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

/** nodemailer's stream transport builds the real MIME message without any network. */
const capture = () => {
  const raw: string[] = [];
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  return {
    raw,
    gmail: createGmail({
      user: 'sam@gmail.com', pass: PASS,
      transport: () => ({
        sendMail: async (msg) => {
          const info = await transport.sendMail(msg);
          raw.push((info.message as Buffer).toString());
          return info;
        },
      }),
    }),
  };
};

const failing = (code: string, message: string) =>
  createGmail({ user: 'sam@gmail.com', pass: PASS, transport: () => ({ sendMail: async () => Promise.reject(Object.assign(new Error(message), { code })) }) });

describe('Gmail sender', () => {
  it('sends a plain-text email with the résumé attached', async () => {
    dir = mkdtempSync(join(tmpdir(), 'applio-mail-'));
    writeFileSync(join(dir, 'resume.pdf'), '%PDF-1.7 fake');
    const { gmail, raw } = capture();
    await gmail.send({ from: 'Sam Rivera <sam@gmail.com>', to: 'jobs@acme.com', subject: 'Application: Engineer — Sam Rivera', text: 'Dear team', attachments: [{ filename: 'resume.pdf', path: join(dir, 'resume.pdf') }] });
    expect(raw[0]).toMatch(/^From: Sam Rivera <sam@gmail.com>$/m);
    expect(raw[0]).toMatch(/^To: jobs@acme.com$/m);
    expect(raw[0]).toContain('Dear team');
    expect(raw[0]).toMatch(/filename=resume\.pdf/);
    expect(raw[0]).toContain(Buffer.from('%PDF-1.7 fake').toString('base64'));
  });

  it('sends a test email to the operator’s own address', async () => {
    const { gmail, raw } = capture();
    await gmail.sendTest();
    expect(raw[0]).toMatch(/^To: sam@gmail.com$/m);
    expect(raw[0]).toMatch(/^Subject: Applio test email$/m);
  });

  it.each([
    ['EAUTH', 'Invalid login: 535-5.7.8 Username and Password not accepted', 'Gmail rejected the address or app password. Create an app password at myaccount.google.com/apppasswords and save it below.'],
    ['ECONNECTION', 'connect ECONNREFUSED', "Couldn't reach Gmail. Check the connection and try again."],
    ['EENVELOPE', 'No recipients defined', 'Gmail refused the email: No recipients defined'],
  ])('explains a %s failure without the password', async (code, raw, readable) => {
    const error = await failing(code, raw).send({ from: 'a', to: 'b', subject: 's', text: 't', attachments: [] }).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(readable);
    expect((error as Error).message).not.toContain(PASS);
  });
});
