/**
 * How many pages a PDF that Electron printed has: one `/Type /Page` object per
 * page (the page tree is `/Type /Pages`). Enough for Applio's own PDFs; not a
 * general PDF parser.
 */
export function pdfPageCount(pdf: Uint8Array): number {
  return (Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length;
}
