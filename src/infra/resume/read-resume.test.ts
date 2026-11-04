// @vitest-environment node
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readResumeText, ResumeUnreadableError } from './read-resume';

const fixture = (name: string) => join(__dirname, 'fixtures', name);
const BULLET = 'Cut p95 query time from 900 ms to 120 ms by redesigning the invoicing schema.';

describe('readResumeText', () => {
  it('reads the text of a PDF, line by line', async () => {
    const text = await readResumeText(fixture('resume.pdf'));
    expect(text.split('\n')).toContain(`- ${BULLET}`);
  });

  it('reads the text of a DOCX, line by line', async () => {
    const text = await readResumeText(fixture('resume.docx'));
    expect(text.split('\n')).toContain(`- ${BULLET}`);
  });

  it('says so in plain words when a PDF is damaged', async () => {
    await expect(readResumeText(fixture('corrupt.pdf'))).rejects.toThrow(
      new ResumeUnreadableError("Applio couldn't read corrupt.pdf. Try saving it again as a PDF or DOCX."),
    );
  });

  it('says so when a PDF has no text, like a scan', async () => {
    await expect(readResumeText(fixture('blank.pdf'))).rejects.toThrow(/no text Applio can read/);
  });

  it('refuses other file types', async () => {
    await expect(readResumeText(fixture('resume.txt'))).rejects.toThrow(/only PDF and DOCX/);
  });
});
