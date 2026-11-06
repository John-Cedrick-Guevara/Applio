import { BrowserWindow } from 'electron';

/**
 * Renders one page of Applio's own template to PDF with Electron's `printToPDF`
 * (SPEC §2). The window is hidden, sandboxed, has JavaScript off, and loads only
 * the given HTML, which the template has already escaped. Text stays real text,
 * so ATS parsers can read it.
 */
export async function printPdf(html: string): Promise<Uint8Array> {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false, contextIsolation: true, nodeIntegration: false } });
  try {
    // Nothing on the page may load anything: the template links no files, and navigation is refused.
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await win.webContents.printToPDF({ pageSize: 'Letter', printBackground: false, preferCSSPageSize: true });
  } finally {
    win.destroy();
  }
}
