/**
 * Rearranging the page tree, as arithmetic on a corpus rather than as git.
 *
 * Everything here is pure. The endpoint reads every doc into a `Map` of path to
 * text, hands it to `applyOps`, and commits whatever came out. Nothing in this
 * file knows that GitHub exists, which is what makes moving three pages and
 * repairing forty links something you can write a test for.
 *
 * Working on the whole corpus rather than on a diff is deliberate. A queue of
 * staged changes can create a page, rename it twice and then move it into a
 * folder that did not exist when the reader started, and reasoning about that
 * as a sequence of file operations is where the bugs live. Applying the ops to
 * a copy and diffing at the end makes the ordering somebody else's problem.
 *
 * A leading underscore keeps this file off Vercel's routing table.
 */

import {
  dirOf,
  docUrl,
  isDoc,
  isSectionIndex,
  metaPath,
  nestedIndex,
  relativeTo,
  resolve,
  sectionIndex,
  stemOf,
  type Move,
} from "@jotdown/core/lib/paths";
import { UNTOUCHABLE, rewriteTargets, splitHash, stripSlash, unlink } from "@jotdown/core/lib/links";
import type { StructureOp } from "@jotdown/editor/types";
import { pageWriteRefusal } from "./_generated";

/** Every doc in the repo, keyed by repo-relative path. */
export type Corpus = Map<string, string>;

export type { Move };

/** What one save has to commit, and what it did along the way. */
export type Plan = {
  additions: { path: string; content: string }[];
  deletions: string[];
  moves: Move[];
};

/** A refusal a reader can act on, raised before anything is committed. */
export type Refusal = { op: number; reason: string };

export type Applied = { ok: true; plan: Plan } | { ok: false; refusals: Refusal[] };

/**
 * Runs a queue of staged changes and works out what to commit.
 *
 * The ops are applied in the order the reader made them, against a copy of the
 * corpus, so each one sees the tree as the previous one left it. Renaming a page
 * you created a moment ago is therefore an ordinary move over a file that only
 * exists in the copy.
 *
 * Link repair happens once at the end rather than per move, because a page that
 * moves twice should have its links rewritten for where it finally sits, not
 * dragged through an intermediate address.
 *
 * @example applyOps(corpus, [{ kind: "move", from: "docs/a.md", to: "docs/b/a.md" }])
 */
export function applyOps(corpus: Corpus, ops: StructureOp[]): Applied {
  const next: Corpus = new Map(corpus);
  const homes = new Map<string, string | null>();
  for (const path of corpus.keys()) homes.set(path, path);

  const refusals: Refusal[] = [];

  ops.forEach((op, index) => {
    const refusal = runOp(next, homes, op);
    if (refusal) refusals.push({ op: index, reason: refusal });
  });

  if (refusals.length > 0) return { ok: false, refusals };

  const moves = [...homes].filter(([from, to]) => to !== from).map(([from, to]) => ({ from, to }));

  repairLinks(next, homes);
  unlinkDeleted(next, homes);

  for (const [path, text] of corpus) {
    if (!isDoc(path) || next.get(path) === text) continue;
    const reason = pageWriteRefusal(path, text);
    if (reason) refusals.push({ op: ops.length - 1, reason });
  }
  if (refusals.length > 0) return { ok: false, refusals };

  return { ok: true, plan: { ...diff(corpus, next), moves } };
}

/**
 * Applies one op to the working corpus, or says why it cannot.
 *
 * `homes` tracks where each file that already existed has ended up, which is
 * what the link repair needs afterwards. Files created during this same queue
 * never enter it: nothing in the repo links to them yet, and their own links
 * are written against their final home because that is the only home they have.
 */
function runOp(corpus: Corpus, homes: Map<string, string | null>, op: StructureOp): string | null {
  switch (op.kind) {
    case "create":
      if (corpus.has(op.path)) return `${op.path} already exists.`;
      corpus.set(op.path, newPage(op));
      listIn(corpus, dirOf(op.path), stemOf(op.path));
      return null;

    case "nest": {
      const text = corpus.get(op.path);
      if (text === undefined) return `${op.path} is not there to hold pages.`;
      if (isSectionIndex(op.path)) return `${op.path} already holds pages.`;

      const index = nestedIndex(op.path);
      if ([...corpus.keys()].some((path) => path.startsWith(`${dirOf(index)}/`))) {
        return `${dirOf(index)} already exists.`;
      }

      corpus.delete(op.path);
      corpus.set(index, text);
      relocate(homes, op.path, index);
      return null;
    }

    case "rename": {
      const text = corpus.get(op.path);
      if (text === undefined) return `${op.path} is not there to rename.`;

      corpus.set(op.path, setField(text, "title", op.title));
      return null;
    }

    case "renameSection": {
      const index = corpus.get(landingOf(corpus, op.path));
      const meta = corpus.get(metaPath(op.path));
      if (index === undefined && meta === undefined) {
        return `${op.path} is not a section that can be renamed.`;
      }

      if (index !== undefined) corpus.set(landingOf(corpus, op.path), setField(index, "title", op.label));
      if (meta !== undefined) corpus.set(metaPath(op.path), patchMeta(meta, "title", op.label));
      return null;
    }

    case "icon":
      return isDoc(op.path) ? repaintPage(corpus, op.path, op.icon) : repaintFolder(corpus, op.path, op.icon);

    case "defaultOpen":
      return unfold(corpus, op.path, op.open);

    case "move": {
      const text = corpus.get(op.from);
      if (text === undefined) return `${op.from} is not there to move.`;
      if (corpus.has(op.to)) return `${op.to} already exists.`;

      corpus.delete(op.from);
      corpus.set(op.to, text);
      relocate(homes, op.from, op.to);
      relist(corpus, op.from, op.to);
      return null;
    }

    case "moveSection": {
      const inside = [...corpus.keys()].filter((path) => path.startsWith(`${op.from}/`));
      if (inside.length === 0) return `${op.from} is not a section that can be moved.`;
      const taken = corpus.has(landingOf(corpus, op.to)) || corpus.has(metaPath(op.to));
      if (op.to !== op.from && taken) return `${op.to} already exists.`;
      if (`${op.to}/`.startsWith(`${op.from}/`) && op.to !== op.from) {
        return `${op.from} cannot be moved inside itself.`;
      }

      for (const from of inside) {
        const to = `${op.to}${from.slice(op.from.length)}`;
        const text = corpus.get(from);
        if (text === undefined) continue;

        corpus.delete(from);
        corpus.set(to, text);
        relocate(homes, from, to);
      }

      relist(corpus, op.from, op.to);
      return null;
    }

    case "delete": {
      if (!corpus.has(op.path)) return `${op.path} is not there to delete.`;

      const inside = childrenOf(corpus, op.path);
      if (inside.length === 1) return `${op.path} still has a page inside it. Move or delete that first.`;
      if (inside.length > 1) {
        return `${op.path} still has ${inside.length} pages inside it. Move or delete those first.`;
      }

      const folder = isSectionIndex(op.path) ? dirOf(op.path) : op.path;

      corpus.delete(op.path);
      if (isSectionIndex(op.path)) corpus.delete(metaPath(folder));
      relocate(homes, op.path, null);
      unlistFrom(corpus, dirOf(folder), stemOf(folder));
      return null;
    }

    case "reorder":
      setPages(corpus, op.folder, op.names);
      return null;
  }
}

/**
 * The last entry of every `pages` array, and the reason a folder never loses
 * a page nobody listed.
 *
 * Fumadocs drops anything a present `pages` does not name, so an author who
 * adds a file by hand and never touches `meta.json` would watch it vanish from
 * the sidebar. The ellipsis says "and then everything else, alphabetically",
 * which is where an unplaced page already sat.
 */
const REST = "...";

/** A folder's `meta.json` as the object it holds, unknown keys included. */
type Meta = Record<string, unknown>;

/**
 * A `meta.json` as the object it holds, or an empty opinion.
 *
 * Missing or unparseable reads as no opinion about the folder, which is the
 * same answer as a file that simply has no `pages`, so neither needs its own
 * branch anywhere else.
 */
function readMeta(text: string | undefined): Meta {
  if (!text) return {};

  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Meta) : {};
  } catch {
    return {};
  }
}

/** The names a folder has placed by hand, without the ellipsis that follows them. */
function listedIn(meta: Meta): string[] | null {
  return Array.isArray(meta.pages)
    ? meta.pages.filter((name): name is string => typeof name === "string" && name !== REST)
    : null;
}

/** True for a `...folder` entry, which draws a folder's contents in this list. */
function isExtraction(name: string) {
  return name.startsWith("...") && name !== REST;
}

/**
 * True for navigation syntax the editor draws no row for and therefore cannot place.
 *
 * A link and a separator are not among them. The editor draws a row for each
 * and names it in the order it sends, so either goes where the reader put it
 * rather than being pinned to the slot it started in.
 */
function isNavigationControl(name: string) {
  return isExtraction(name) || name.startsWith("!");
}

/**
 * Puts reordered names back around the entries the editor cannot place.
 *
 * Every navigation control is left at the index it had, because an exclusion
 * and a folder extraction are not rows the editor draws and so have no new
 * position to be given.
 *
 * Links and separators are the other way round, and `names` is the whole truth
 * about them: the editor draws one row for each and names every one of them, so
 * one missing from the order is one the reader deleted rather than one this has
 * to put back. That is what lets them be added, respelt, moved and removed
 * without a single op of their own.
 */
function withNavigationControls(names: string[], listed: string[] | null) {
  const pages = names.filter((name) => name !== REST && !isNavigationControl(name));
  if (!listed) return pages;

  for (const [index, name] of listed.entries()) {
    if (isNavigationControl(name)) pages.splice(Math.min(index, pages.length), 0, name);
  }

  return pages;
}

/**
 * Writes one folder's order, always ending in the ellipsis.
 *
 * The array is patched where it sits, so a section carrying an icon or a
 * `defaultOpen` keeps them spelt exactly as somebody wrote them.
 */
function setPages(corpus: Corpus, folder: string, names: string[]) {
  const text = corpus.get(metaPath(folder));
  const listed = listedIn(readMeta(text));
  const next = [...withNavigationControls(names, listed), REST];

  corpus.set(metaPath(folder), text === undefined ? printMeta({ pages: next }) : patchMeta(text, "pages", next));
}

/** Gives one page a new icon in its front matter, or takes it away. */
function repaintPage(corpus: Corpus, path: string, icon: string | null) {
  const text = corpus.get(path);
  if (text === undefined) return `${path} is not there to change.`;

  corpus.set(path, icon ? setField(text, "icon", icon) : dropField(text, "icon"));
  return null;
}

/**
 * Gives a section a new icon, wherever the sidebar reads it from.
 *
 * A section is drawn with its `meta.json` icon and otherwise its landing page's,
 * so the icon goes into `meta.json`, and into the landing page as well when
 * that already names one or there is no `meta.json` to write, so the two
 * cannot disagree.
 */
function repaintFolder(corpus: Corpus, folder: string, icon: string | null) {
  const meta = corpus.get(metaPath(folder));
  const index = corpus.get(landingOf(corpus, folder));
  if (meta === undefined && index === undefined) return `${folder} is not a section that can take an icon.`;

  if (meta !== undefined) {
    corpus.set(metaPath(folder), icon ? patchMeta(meta, "icon", icon) : printMeta({ ...readMeta(meta), icon: null }));
  }

  if (index !== undefined && (meta === undefined || icon === null || hasField(index, "icon"))) {
    corpus.set(landingOf(corpus, folder), icon ? setField(index, "icon", icon) : dropField(index, "icon"));
  }

  return null;
}

/**
 * Says in a section's `meta.json` whether it starts unfolded in the sidebar.
 *
 * Open writes `"defaultOpen": true`, making the `meta.json` when the section had
 * none. Shut takes the key away rather than writing `false`, which is the default.
 */
function unfold(corpus: Corpus, folder: string, open: boolean) {
  const meta = corpus.get(metaPath(folder));
  if (meta === undefined && !corpus.has(landingOf(corpus, folder))) return `${folder} is not a section that can fold.`;
  if (meta === undefined && !open) return null;

  corpus.set(
    metaPath(folder),
    open ? patchMeta(meta ?? "{}", "defaultOpen", true) : printMeta({ ...readMeta(meta), defaultOpen: null }),
  );
  return null;
}

/**
 * Adds a name to a folder that is already keeping an order, and skips one that is not.
 *
 * A folder with no `pages` needs no entry: the ellipsis every array ends with is
 * what an unplaced page was already relying on, and inventing a one-name array
 * would promote the new page above every sibling instead of leaving it last.
 */
function listIn(corpus: Corpus, folder: string, name: string) {
  const listed = listedIn(readMeta(corpus.get(metaPath(folder))));
  if (listed === null || listed.includes(name)) return;

  setPages(corpus, folder, [...listed, name]);
}

/** Takes a name out of a folder's order, and leaves a folder that never kept one alone. */
function unlistFrom(corpus: Corpus, folder: string, name: string) {
  const listed = listedIn(readMeta(corpus.get(metaPath(folder))));
  if (listed === null || !listed.includes(name)) return;

  setPages(
    corpus,
    folder,
    listed.filter((other) => other !== name),
  );
}

/**
 * Follows a thing out of one folder's order and into another's.
 *
 * A section needs nothing more than this: its own `meta.json` is a file inside
 * the folder, so it travels with the folder rather than having to be rewritten.
 *
 * A change of address within one folder is spelt in place instead, so a page
 * that only got a new URL keeps the position somebody put it in.
 */
function relist(corpus: Corpus, from: string, to: string) {
  const [was, now] = [stemOf(from), stemOf(to)];

  if (dirOf(from) === dirOf(to)) {
    respell(corpus, dirOf(from), was, now);
    return;
  }

  unlistFrom(corpus, dirOf(from), was);
  listIn(corpus, dirOf(to), now);
}

/** Renames a thing where it already sits in an order. */
function respell(corpus: Corpus, folder: string, was: string, now: string) {
  const listed = listedIn(readMeta(corpus.get(metaPath(folder))));
  if (!listed?.includes(was) || was === now) return;

  setPages(
    corpus,
    folder,
    listed.map((name) => (name === was ? now : name)),
  );
}

/** A JSON string, matched as one unit because a `pages` entry may hold a `]`. */
const JSON_STRING = String.raw`"(?:[^"\\]|\\.)*"`;

/**
 * Rewrites one key of a `meta.json`, and touches nothing else in it.
 *
 * Reprinting the parsed object would be simpler and would also reformat every
 * other key, turning a rename into an unreadable diff, so the one key is
 * patched in place. A key that is not there yet has no spelling to preserve, so
 * that case does reprint.
 *
 * The array is matched as a run of JSON strings rather than as everything up to
 * the first `]`. A link entry and a separator carrying an icon both spell a `]`
 * inside a string, and stopping at it would rewrite half an array and leave the
 * file unparseable.
 *
 * @example patchMeta('{ "title": "Old" }\n', "title", "New")
 */
function patchMeta(text: string, key: string, value: string | string[] | boolean) {
  const printed = Array.isArray(value) ? printPages(value) : JSON.stringify(value);
  const line = new RegExp(`("${key}"\\s*:\\s*)(?:true|false|${JSON_STRING}|\\[(?:\\s|,|${JSON_STRING})*\\])`);

  return line.test(text)
    ? text.replace(line, (_, opened: string) => `${opened}${printed}`)
    : printMeta({ ...readMeta(text), [key]: value });
}

/** `pages` on one line, which is how every `meta.json` in the repo spells it. */
function printPages(names: string[]) {
  return `[${names.map((name) => JSON.stringify(name)).join(", ")}]`;
}

/**
 * A whole `meta.json`, printed the way the repo writes them.
 *
 * `pages` goes on one line rather than one name per line, because a section's
 * order is read as a sequence and a fourteen-line array is not.
 */
function printMeta(meta: Meta) {
  const body = Object.entries(meta)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(
      ([key, value]) =>
        `  ${JSON.stringify(key)}: ${Array.isArray(value) ? printPages(value as string[]) : JSON.stringify(value)}`,
    );

  return `{\n${body.join(",\n")}\n}\n`;
}

/**
 * A section's landing page, which is `index.md` when that is the one it has.
 *
 * @example landingOf(corpus, "docs/guides"); // "docs/guides/index.mdx"
 */
function landingOf(corpus: Corpus, folder: string) {
  const plain = `${folder}/index.md`;
  return corpus.has(plain) ? plain : sectionIndex(folder);
}

/** Follows a file to its new address, or off the end of the tree. */
function relocate(homes: Map<string, string | null>, from: string, to: string | null) {
  for (const [origin, current] of homes) {
    if (current === from) {
      homes.set(origin, to);
      return;
    }
  }
}

/**
 * Pages that would be orphaned by removing a section's index.
 *
 * Only siblings count, not the index itself and not the category file, because
 * those two are the section rather than things inside it.
 */
function childrenOf(corpus: Corpus, path: string): string[] {
  if (!isSectionIndex(path)) return [];

  const folder = dirOf(path);
  return [...corpus.keys()].filter(
    (other) => other !== path && other !== metaPath(folder) && other.startsWith(`${folder}/`),
  );
}

/**
 * Turns every link to a page this queue deletes back into plain words.
 *
 * `[the BFF page](./bff.mdx)` becomes `the BFF page`, in every page that wrote
 * it. Nothing else about those sentences changes, which is why this can run
 * without anybody reading them: the words are the ones the author chose and a
 * reader already sees, and the only thing lost is somewhere to click.
 *
 * The alternative, refusing the delete and naming the pages to go and fix, is
 * what this was until it got in the way twice. Fumadocs resolves a relative
 * link as the page renders and leaves the href alone when the target is
 * missing, so a link left behind is one silent 404 rather than the failed build
 * the refusal was written against. And the page holding the link is often a
 * generated one, where a fix by hand is thrown away by the next generation.
 *
 * Only deletions reach here. A move repairs its own links in `repairLinks`, and
 * a page that was never there could not have been linked to.
 */
function unlinkDeleted(corpus: Corpus, homes: Map<string, string | null>) {
  const gone = new Set([...homes].filter(([, to]) => to === null).map(([from]) => from));
  if (gone.size === 0) return;

  const byUrl = new Map<string, string>();
  for (const path of homes.keys()) byUrl.set(docUrl(path), path);

  for (const [path, text] of corpus) {
    const at = dirOf(path);

    const rewritten = unlink(text, (target) => {
      const [address] = splitHash(target);
      if (!address || UNTOUCHABLE.test(target)) return false;

      const points = address.startsWith("/") ? byUrl.get(stripSlash(address)) : resolve(at, address);
      return !!points && gone.has(points);
    });

    if (rewritten !== text) corpus.set(path, rewritten);
  }
}

/**
 * Rewrites every link that pointed at a page which moved.
 *
 * Two spellings reach here. A relative one is resolved against the directory
 * the linking file was in when it was written, looked up, then written back out
 * relative to wherever that file now sits. That second half is why a page
 * moving one level deeper has its own `./sibling.md` become `../sibling.md`
 * even though the sibling never moved: the link is relative to a file that did.
 * A site-absolute one is matched by the URL the page is served at instead, and
 * only changes when its own target moved.
 *
 * A link to a page that was deleted is left exactly as it was. There is nothing
 * true to point it at, and `unlinkDeleted` runs straight after this one and
 * takes the link away entirely rather than letting this file invent a
 * destination.
 */
function repairLinks(corpus: Corpus, homes: Map<string, string | null>) {
  const byUrl = new Map<string, string>();
  for (const path of homes.keys()) byUrl.set(docUrl(path), path);

  const origins = new Map<string, string>();
  for (const [origin, current] of homes) {
    if (current) origins.set(current, origin);
  }

  for (const [path, text] of corpus) {
    const wasAt = dirOf(origins.get(path) ?? path);
    const rewritten = rewriteTargets(text, (target) => retarget(target, { wasAt, isAt: dirOf(path), homes, byUrl }));

    if (rewritten !== text) corpus.set(path, rewritten);
  }
}

/**
 * Points one link at wherever its page ended up, or leaves it be.
 *
 * @example retarget("./commit-signing.md", ctx); // "../security/commit-signing.md"
 */
function retarget(
  target: string,
  ctx: {
    wasAt: string;
    isAt: string;
    homes: Map<string, string | null>;
    byUrl: Map<string, string>;
  },
): string {
  if (UNTOUCHABLE.test(target)) return target;

  const [address, hash = ""] = splitHash(target);
  if (!address) return target;

  const absolute = address.startsWith("/");
  const origin = absolute ? ctx.byUrl.get(stripSlash(address)) : resolve(ctx.wasAt, address);
  if (!origin) return target;

  const home = ctx.homes.get(origin) ?? origin;
  if (home === null) return target;

  if (absolute) return home === origin ? target : `${docUrl(home)}${hash}`;
  if (home === origin && ctx.wasAt === ctx.isAt) return target;

  return `${relativeTo(ctx.isAt, home)}${hash}`;
}

/** Every path that changed, as the additions and deletions of one commit. */
function diff(before: Corpus, after: Corpus) {
  const additions = [...after]
    .filter(([path, content]) => before.get(path) !== content)
    .map(([path, content]) => ({ path, content }));

  const deletions = [...before.keys()].filter((path) => !after.has(path));

  return { additions, deletions };
}

/**
 * A new page, as the file it will be committed as: front matter and a blank sheet.
 *
 * @example newPage({ title: "Setup", description: null }); // "---\ntitle: Setup\n..."
 */
function newPage(page: { title: string; description: string | null; icon?: string | null }) {
  const description = page.description ?? "One sentence on what this page is for.";
  const icon = page.icon ? `icon: ${page.icon}\n` : "";

  return `---\ntitle: ${yaml(page.title)}\ndescription: ${yaml(description)}\n${icon}---\n\n`;
}

/**
 * Rewrites one scalar frontmatter field, adding it when it is not there.
 *
 * Surgical on purpose. Parsing the YAML and printing it back would reformat
 * every other field and turn a rename into an unreadable diff.
 *
 * @example setField("---\ntitle: Old\n---\n", "title", "New")
 */
export function setField(text: string, field: string, value: string) {
  const fenced = /^---\n([\s\S]*?)\n---(\r?\n|$)/.exec(text);
  if (!fenced) return `---\n${field}: ${yaml(value)}\n---\n\n${text}`;

  const [whole, body = "", after = ""] = fenced;
  const line = new RegExp(`^${field}:.*$`, "m");
  const next = line.test(body) ? body.replace(line, `${field}: ${yaml(value)}`) : `${body}\n${field}: ${yaml(value)}`;

  return `---\n${next}\n---${after}${text.slice(whole.length)}`;
}

/**
 * Removes one frontmatter field, leaving every other line as it was.
 *
 * @example dropField("---\ntitle: A\nicon: Book\n---\n", "icon"); // "---\ntitle: A\n---\n"
 */
export function dropField(text: string, field: string) {
  const fenced = /^---\n([\s\S]*?)\n---(\r?\n|$)/.exec(text);
  if (!fenced) return text;

  const [whole, body = "", after = ""] = fenced;
  const kept = body.split("\n").filter((line) => !line.startsWith(`${field}:`));

  return `---\n${kept.join("\n")}\n---${after}${text.slice(whole.length)}`;
}

/** True when a page's front matter already names this field. */
function hasField(text: string, field: string) {
  const body = /^---\n([\s\S]*?)\n---/.exec(text)?.[1];
  return body === undefined ? false : new RegExp(`^${field}:`, "m").test(body);
}

/**
 * Quotes a YAML scalar only when leaving it bare would change its meaning.
 *
 * Titles in this repo contain colons and slashes often enough that this matters:
 * `title: CI/CD and delivery` is fine, `title: Testing: how we do it` is a
 * parse error that fails the build.
 */
function yaml(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return /^[A-Za-z0-9][A-Za-z0-9 ./'()&,+-]*$/.test(clean) ? clean : `"${clean.replace(/["\\]/g, "\\$&")}"`;
}
