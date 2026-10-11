import manifest from "../../../package.json";
import { githubToken } from "./auth/token";

/**
 * Whether a newer Jotdown is out, read from the latest release of its GitHub repository.
 *
 * The repository is private for now, so the check asks with the signed-in
 * token, and says nothing when there is none. GitHub is asked at most once an
 * hour; the answer in between is the last one.
 */

const LATEST = "https://api.github.com/repos/markomitranic/Jotdown/releases/latest";
const HOUR = 3_600_000;

/** A release newer than the running app: its version and the page to download it from. */
export type Update = { version: string; url: string };

const memory = globalThis as { jotdownUpdate?: { at: number; update: Promise<Update | null> } };

/**
 * The newer release, or null when this is the newest or GitHub cannot say.
 *
 * @example await availableUpdate(); // { version: "0.3.0", url: "https://github.com/markomitranic/Jotdown/releases/tag/v0.3.0" }
 */
export function availableUpdate() {
  if (!memory.jotdownUpdate || Date.now() - memory.jotdownUpdate.at > HOUR)
    memory.jotdownUpdate = { at: Date.now(), update: askGitHub() };
  return memory.jotdownUpdate.update;
}

async function askGitHub(): Promise<Update | null> {
  const token = await githubToken();
  if (!token) return null;

  const response = await fetch(LATEST, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!response?.ok) return null;

  const release: { tag_name: string; html_url: string } = await response.json();
  const version = release.tag_name.replace(/^v/, "");
  return isNewer(version, manifest.version) ? { version, url: release.html_url } : null;
}

/**
 * Whether one `major.minor.patch` version comes after another.
 *
 * @example isNewer("0.10.0", "0.9.2"); // true
 */
export function isNewer(version: string, than: string) {
  const [a, b] = [version, than].map((text) => text.split(".").map((part) => Number.parseInt(part, 10) || 0));
  for (let at = 0; at < 3; at++) if ((a?.[at] ?? 0) !== (b?.[at] ?? 0)) return (a?.[at] ?? 0) > (b?.[at] ?? 0);
  return false;
}
