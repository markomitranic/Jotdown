import { env } from "@/env";

/**
 * Jotdown's updates, as the desktop app has them.
 *
 * The app checks for a newer release itself and downloads it in the
 * background, so the studio only asks whether one is waiting for a restart,
 * and asks for that restart. Outside the app there is nothing to update.
 */

/** A newer Jotdown, downloaded and installed by the next restart. */
export type Update = { version: string };

/**
 * The downloaded update waiting for a restart, or null when there is none.
 *
 * @example await readyUpdate(); // { version: "0.3.2" }
 */
export async function readyUpdate(): Promise<Update | null> {
  if (!env.JOTDOWN_BRIDGE) return null;
  const answer = await fetch(`${env.JOTDOWN_BRIDGE}/update`).catch(() => null);
  const { version }: { version: string | null } = answer?.ok ? await answer.json() : { version: null };
  return version ? { version } : null;
}

/**
 * Asks the app to look for a newer Jotdown now, answering the update waiting afterwards, or null outside the app.
 *
 * A newer release is downloaded before this answers, so a waiting update can
 * be installed by a restart straight away.
 *
 * @example await checkForUpdate(); // { version: "0.3.2" }
 */
export async function checkForUpdate(): Promise<Update | null> {
  if (!env.JOTDOWN_BRIDGE) return null;
  const answer = await fetch(`${env.JOTDOWN_BRIDGE}/update/check`, { method: "POST" }).catch(() => null);
  const { version }: { version: string | null } = answer?.ok ? await answer.json() : { version: null };
  return version ? { version } : null;
}

/**
 * Asks the app to quit, install the downloaded update and open again, answering whether it agreed.
 *
 * @example await restartToUpdate(); // true
 */
export async function restartToUpdate() {
  if (!env.JOTDOWN_BRIDGE) return false;
  const answer = await fetch(`${env.JOTDOWN_BRIDGE}/update`, { method: "POST" }).catch(() => null);
  return Boolean(answer?.ok);
}
