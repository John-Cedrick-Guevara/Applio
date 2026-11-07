import { describe, expect, it } from 'vitest';
import { pdfPageCount } from './page-count';

const pdf = (pages: number) => new TextEncoder().encode(`%PDF-1.4\n1 0 obj << /Type /Pages /Count ${pages} >>\n${Array.from({ length: pages }, (_, i) => `${i + 2} 0 obj << /Type /Page /Parent 1 0 R >>`).join('\n')}\n%%EOF`);

describe('pdfPageCount', () => {
  it('counts the pages of a printed PDF, not the page tree node', () => {
    expect(pdfPageCount(pdf(1))).toBe(1);
    expect(pdfPageCount(pdf(2))).toBe(2);
  });
});
