import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { AppError } from '../../shared/errors';

/** A résumé file Applio can't get text out of; the message says what to do. */
export class ResumeUnreadableError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super('RESUME_UNREADABLE', message, options);
  }
}

const readers: Record<string, (data: Buffer) => Promise<string>> = {
  '.pdf': async (data) => (await extractText(await getDocumentProxy(new Uint8Array(data)), { mergePages: true })).text,
  '.docx': async (data) => (await mammoth.extractRawText({ buffer: data })).value,
};

/**
 * Extracts plain text from a PDF or DOCX résumé, one line per line or paragraph.
 * @throws ResumeUnreadableError for other file types, damaged files, or files with no text (e.g. scanned images).
 */
export async function readResumeText(path: string): Promise<string> {
  const name = basename(path);
  const read = readers[extname(path).toLowerCase()];
  if (!read) throw new ResumeUnreadableError(`${name} isn't a PDF or DOCX. Applio reads only PDF and DOCX résumés.`);

  let text: string;
  // ponytail: parses on main's thread; fine for a few-page résumé — move to a utility process if imports grow large.
  try {
    text = await read(await readFile(path));
  } catch (err) {
    throw new ResumeUnreadableError(`Applio couldn't read ${name}. Try saving it again as a PDF or DOCX.`, { cause: err });
  }
  // DOCX paragraphs come back blank-line separated; one newline per line keeps both formats alike.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new ResumeUnreadableError(`${name} has no text Applio can read. If it's a scan, export a text PDF or DOCX instead.`);
  return lines.join('\n');
}
