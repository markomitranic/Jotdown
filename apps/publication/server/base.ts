import { readProjectConfig } from "@jotdown/core/server/config";

/**
 * The path a site is hosted under, read from the `url` its config names, or empty at a domain's root.
 *
 * A site on GitHub Pages lives at `https://you.github.io/notes`, so every
 * link, upload and script it writes starts with `/notes`.
 *
 * @example siteBase("/work/notes"); // "/notes" for a config naming "https://you.github.io/notes/"
 */
export function siteBase(repository: string) {
  const { url } = readProjectConfig(repository);
  return url ? new URL(url).pathname.replace(/\/+$/, "") : "";
}
