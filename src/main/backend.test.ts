// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
}));
vi.mock('electron', () => electron);

import { createBackend } from './backend';

beforeEach(() => {
  electron.shell.openExternal.mockResolvedValue(undefined);
  electron.shell.openPath.mockResolvedValue('');
});

describe('createBackend OS integration', () => {
  it('opens web links in the system browser and refuses other schemes', async () => {
    const api = createBackend(() => null);
    await api.openExternal('https://example.com/job');
    expect(electron.shell.openExternal).toHaveBeenCalledWith('https://example.com/job');
    await expect(api.openExternal('file:///etc/passwd')).rejects.toThrow('Only web links can be opened');
    expect(electron.shell.openExternal).toHaveBeenCalledTimes(1);
  });

  it('returns the chosen folder, or null when the picker is cancelled', async () => {
    const api = createBackend(() => null);
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/Users/me/JobApps'] });
    expect(await api.chooseFolder()).toBe('/Users/me/JobApps');
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await api.chooseFolder()).toBeNull();
  });

  it('imports the chosen resume file, or nothing when cancelled', async () => {
    const api = createBackend(() => null);
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/Users/me/cv.pdf'] });
    expect((await api.importResume())?.resume).toMatchObject({ fileName: 'cv.pdf' });
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await api.importResume()).toBeNull();
  });

  it("opens a job's folder with the home directory expanded, and reports OS failures", async () => {
    const api = createBackend(() => null);
    await api.openJobFolder('j1');
    expect(electron.shell.openPath.mock.calls[0]![0]).not.toMatch(/^~/);
    electron.shell.openPath.mockResolvedValueOnce('No such folder');
    await expect(api.openJobFolder('j1')).rejects.toThrow("Couldn't open the folder: No such folder");
    await expect(api.openJobFolder('j6')).rejects.toThrow('This job has no folder yet');
  });
});
