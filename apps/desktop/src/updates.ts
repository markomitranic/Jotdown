import { Updater } from "electrobun/bun";

const EVERY = 10 * 60_000;

/** Keeps the app up to date: what is downloaded and waiting for a restart, and the restart that installs it. */
export type Updates = { ready: () => string | null; restart: () => Promise<void> };

/**
 * Checks Jotdown's latest release now and every ten minutes, and downloads a newer one in the background.
 *
 * A check reads one small file from the release, so ten minutes stays far from
 * any limit. A check or download that fails tries again at the next one. A
 * dev build is never updated.
 *
 * @example const updates = keepUpdated(); updates.ready(); // "0.3.2" once it is downloaded
 */
export function keepUpdated(): Updates {
  let ready: string | null = null;

  async function check() {
    const found = await Updater.checkForUpdate().catch(() => null);
    if (!found?.updateAvailable) return;
    if (!found.updateReady) await Updater.downloadUpdate().catch(() => null);
    if (Updater.updateInfo().updateReady) ready = found.version;
  }

  check();
  setInterval(check, EVERY);

  return { ready: () => ready, restart: () => Updater.applyUpdate() };
}
