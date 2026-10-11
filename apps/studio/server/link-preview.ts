/**
 * What a link embed shows, read off the page a link points at.
 *
 * The studio reads a page once, when its link is pasted, and the block keeps
 * the answer in its props, so nothing here runs while anybody reads a page.
 * Every way a page can fail to answer, a timeout, a 404, a sign-in wall, still
 * answers with a preview, an empty one, which the card draws as its address
 * and host. Only an address the studio refuses to fetch is an error.
 */

import type { Element, ElementContent, Root, RootContent } from "hast";
import { fromHtml } from "hast-util-from-html";
import { webAddress } from "@jotdown/core/lib/web-address";
import type { LinkPreview } from "@jotdown/editor/types";

/** An address the studio will not fetch, with the reason to show the editor. */
export class RefusedAddress extends Error {}

const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 5;
const MAX_HEAD_CHARS = 512_000;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 300;
const MAX_ADDRESS = 2048;

const USER_AGENT = "Mozilla/5.0 (compatible; JotdownBot/0.1; +https://github.com/markomitranic/Jotdown)";

const SIGN_IN_TITLE = /\b(sign[\s-]?in|log[\s-]?in|login)\b/i;
const SIGN_IN_PATH = /\/(login|signin|sign-in|sso|oauth2?\/authorize)(?=\/|\.|$)/i;

const UNREAD: LinkPreview = { title: "", description: "", site: "", image: "", favicon: "" };

/**
 * The preview for one address, following its redirects to the page that answers.
 *
 * @example await previewOf("https://fumadocs.dev"); // { title: "Fumadocs", site: "Fumadocs", … }
 */
export async function previewOf(address: string): Promise<LinkPreview> {
  const asked = parsedAddress(address);

  try {
    const { response, reached } = await fetchFollowing(asked);

    if (!response.ok || !isHtml(response)) {
      await response.body?.cancel();
      return UNREAD;
    }

    const tags = headTags(await headOf(response));

    if (behindSignIn(asked, reached, tags.title)) return UNREAD;

    return {
      title: clipped(tags.meta.get("og:title") ?? tags.meta.get("twitter:title") ?? tags.title, MAX_TITLE),
      description: clipped(
        tags.meta.get("og:description") ?? tags.meta.get("twitter:description") ?? tags.meta.get("description") ?? "",
        MAX_DESCRIPTION,
      ),
      site: clipped(tags.meta.get("og:site_name") ?? tags.meta.get("application-name") ?? "", MAX_TITLE),
      image: resolved(tags.meta.get("og:image") ?? tags.meta.get("twitter:image"), reached),
      favicon: resolved(tags.icon ?? "/favicon.ico", reached),
    };
  } catch (error) {
    if (error instanceof RefusedAddress) throw error;
    return UNREAD;
  }
}

/**
 * The address as a URL the studio may fetch, or a refusal naming why not.
 *
 * @example parsedAddress("ftp://example.com"); // throws RefusedAddress
 */
function parsedAddress(address: string): URL {
  const url = webAddress(address);
  if (url === null) throw new RefusedAddress("Only web links can be embedded.");
  if (url.href.length > MAX_ADDRESS) throw new RefusedAddress("That link is too long to embed.");
  return url;
}

/**
 * Fetches a page one redirect at a time, so every hop is checked before it is followed.
 *
 * The studio runs on the editor's own machine, so it may read its own network.
 */
async function fetchFollowing(start: URL): Promise<{ response: Response; reached: URL }> {
  let url = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    });

    const next = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || next === null) return { response, reached: url };

    await response.body?.cancel();
    url = parsedAddress(new URL(next, url).href);
  }

  throw new Error("Too many redirects.");
}

function isHtml(response: Response) {
  return /\b(text\/html|application\/xhtml\+xml)\b/.test(response.headers.get("content-type") ?? "");
}

/**
 * The page's markup up to the end of its `<head>`, which is all a preview reads.
 *
 * Read in pieces and cut off at a limit, so a page that streams forever or
 * puts megabytes before its body costs the studio no more than that.
 */
async function headOf(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (reader === undefined) return "";

  const decoder = new TextDecoder();
  let markup = "";

  while (markup.length < MAX_HEAD_CHARS) {
    const { done, value } = await reader.read();
    if (done) break;

    markup += decoder.decode(value, { stream: true });
    if (/<\/head>|<body[\s>]/i.test(markup)) break;
  }

  await reader.cancel();
  return markup;
}

type HeadTags = {
  title: string;
  /** Every `<meta>` by its `property` or `name`, lowercased, the first of each kept. */
  meta: Map<string, string>;
  icon: string | null;
};

/**
 * The `<title>`, the `<meta>` tags and the first icon a page's head declares.
 *
 * @example headTags('<title>Home</title><meta property="og:title" content="Hi">').meta.get("og:title"); // "Hi"
 */
function headTags(markup: string): HeadTags {
  const tags: HeadTags = { title: "", meta: new Map(), icon: null };

  for (const element of elementsOf(fromHtml(markup))) {
    const property = String(element.properties.property ?? element.properties.name ?? "").toLowerCase();
    const content = element.properties.content;
    const rel = relOf(element);

    if (element.tagName === "title" && tags.title === "") tags.title = textOf(element);
    if (element.tagName === "meta" && property !== "" && typeof content === "string" && !tags.meta.has(property)) {
      tags.meta.set(property, content);
    }
    if (element.tagName === "link" && tags.icon === null && rel.includes("icon") && !rel.includes("mask-icon")) {
      tags.icon = String(element.properties.href ?? "") || null;
    }
  }

  return tags;
}

function* elementsOf(node: Root | RootContent | ElementContent): Generator<Element> {
  if (node.type === "element") yield node;
  if ("children" in node) for (const child of node.children) yield* elementsOf(child);
}

function relOf(element: Element): string[] {
  const rel = element.properties.rel;
  return (Array.isArray(rel) ? rel : [rel]).map((value) => String(value ?? "").toLowerCase());
}

function textOf(element: Element): string {
  return element.children.map((child) => (child.type === "text" ? child.value : "")).join("");
}

/**
 * Whether the link was sent somewhere else to sign in, rather than answered with the page asked for.
 *
 * A wiki behind a login redirects every link to its sign-in page, and a card
 * titled "Sign in to your account" is worse than one showing the address. A
 * page that answers where it was asked is the page, even one about logging in.
 */
function behindSignIn(asked: URL, reached: URL, title: string) {
  if (reached.href === asked.href) return false;
  return SIGN_IN_PATH.test(reached.pathname) || (reached.host !== asked.host && SIGN_IN_TITLE.test(title));
}

/** Text squeezed to one line and cut at a word near `limit`. */
function clipped(text: string, limit: number): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= limit) return line;

  const cut = line.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  const end = space > limit * 0.6 ? space : limit;
  return `${cut.slice(0, end).trimEnd()}…`;
}

/** A page-relative address made absolute, or an empty string for one that is not a web address. */
function resolved(address: string | undefined, base: URL): string {
  if (!address) return "";

  try {
    const href = webAddress(new URL(address.trim(), base).href)?.href ?? "";
    return href.length <= MAX_ADDRESS ? href : "";
  } catch {
    return "";
  }
}
