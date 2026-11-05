import { Menu, nativeImage, Tray } from 'electron';

// A plain ring, black on transparent so macOS can tint it as a template image.
// ponytail: generated placeholder; swap for the app icon once there is one.
const ICON_1X = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAV0lEQVR4nK1TsQ0AIAxi6i1+5/+TLroYCzVIwgakaAtwxOITGoCRsClzJ+bN7pjTEDZ2qc5NcIJqlJnqwgiILwF2BflAFY39jXAX6SUkNVfqyGM6Ic95Ai4KgG0Irgc5AAAAAElFTkSuQmCC';
const ICON_2X = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAzElEQVR4nNVXwQ3DIAw8VmADpskMzJCukNlbVYqlBlUYO4ZrT7pPJHyHbYgB/hgJQD6ZVglWAE+FNdrQO9gxINzyiDCyOYRbbl7xPUBcuDPFzSYi0u4uR5ooLuw25mi3PwCUj3Xl/DZ6Om7tXoM7CyOXzCi0ONWzyApzPK3mVmg9cYFW//Jdo4ti6YMcnH5BL2b+KQP0EmhupzehZmDJMaRfRPSrGOyfkSULd6jOidSBREAdyWaYMIsLqGO5gPowaY1QnmY9Q0sfp1PwAv+T25T9GgCnAAAAAElFTkSuQmCC';

export interface TrayActions {
  open: () => void;
  runNow: () => void;
  isPaused: () => boolean;
  setPaused: (paused: boolean) => void;
  quit: () => void;
}

/**
 * The tray (menu bar on macOS) that keeps Applio running with the window
 * closed (scheduler AC-6). The menu is rebuilt on each status change so the
 * Pause / Resume item says what it will do.
 * @returns A function that refreshes the menu.
 */
export function createTray(actions: TrayActions): () => void {
  const icon = nativeImage.createFromBuffer(Buffer.from(ICON_1X, 'base64'));
  icon.addRepresentation({ scaleFactor: 2, buffer: Buffer.from(ICON_2X, 'base64') });
  icon.setTemplateImage(true);
  const tray = new Tray(icon);
  tray.setToolTip('Applio');
  tray.on('click', actions.open);

  const refresh = () => {
    const paused = actions.isPaused();
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open Applio', click: actions.open },
        { label: 'Run discovery now', enabled: !paused, click: actions.runNow },
        { label: paused ? 'Resume automation' : 'Pause automation', click: () => actions.setPaused(!paused) },
        { type: 'separator' },
        { label: 'Quit Applio', click: actions.quit },
      ]),
    );
  };
  refresh();
  return refresh;
}
