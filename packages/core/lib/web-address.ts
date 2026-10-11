/**
 * Web addresses as a link card reads them: checked, shortened and named by their host.
 *
 * Shared by the card a reader sees, the editor that turns a pasted link into
 * one, and the server that reads the page behind it, so all three agree on
 * what counts as a link.
 */

/**
 * The address, or null for anything a reader's browser should not be sent to from a card.
 *
 * @example webAddress("https://fumadocs.dev/docs"); // URL { host: "fumadocs.dev", … }
 * @example webAddress("javascript:alert(1)"); // null
 */
export function webAddress(url: string | undefined): URL | null {
  if (!url) return null;

  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * An address as a reader would say it: no scheme, no `www.`, no trailing slash.
 *
 * @example shortAddress(new URL("https://www.fumadocs.dev/docs/")); // "fumadocs.dev/docs"
 */
export function shortAddress(address: URL): string {
  const path = `${address.pathname}${address.search}`.replace(/\/$/, "");
  return `${hostName(address)}${path}`;
}

/**
 * The host without its `www.`, the site's name when the page gives none.
 *
 * @example hostName(new URL("https://www.github.com/x")); // "github.com"
 */
export function hostName(address: URL): string {
  return address.hostname.replace(/^www\./, "");
}
