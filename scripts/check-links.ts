/**
 * Reports every link in `docs/` that points at a page or a file which is not there.
 *
 * Fumadocs resolves a relative link when the page renders and, when the target
 * is missing, hands the browser the href exactly as it was typed. So a link to
 * a page that was renamed, or an image whose upload never landed, is not a
 * failed build or a warning in the log. It is a 404 that only a reader clicking
 * it ever finds. This is the thing that finds it first.
 *
 * A publication build runs it before building, so a broken link fails the
 * publish. It checks this repository's own docs with no argument, or any
 * repository you name, in the content folder its `.jotdown/config.json` names:
 *
 * @example bun run check:links
 * @example bun run check:links ../handbook
 *
 * What it does not look at: anchors (`./page.mdx#section`) and the `meta.json`
 * `pages` arrays. Both can hold a link, neither is markdown, and each would want
 * its own parser.
 *
 * It reads the text rather than the parsed document, which is what keeps it
 * ahead of the build. A link written inside a code fence to show what one looks
 * like is therefore checked like any other, so a fence demonstrating a broken
 * link is reported. Point that example at a page that exists.
 *
 * Fumadocs can hand a link check its input directly, with
 * `defineDocs({ docs: { postprocess: { extractLinkReferences: true } } })`. It
 * is not used here because those references only exist once the collection has
 * compiled, and this runs before the build so that the build never starts on a
 * tree it will render wrong.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { readMoves } from "@jotdown/core/lib/moved";
import { DOCS_ROOT, docUrl, dirOf, finalHome, inUnderscoreFolder, resolve } from "@jotdown/core/lib/paths";
import { UNTOUCHABLE, attributeLinksIn, linksIn, splitHash, stripSlash, type FoundLink } from "@jotdown/core/lib/links";
import { contentDirectory, readProjectConfig } from "@jotdown/core/server/config";
import { uploadFile } from "@jotdown/core/server/uploads";

const repository = resolvePath(process.argv[2] ?? resolvePath(import.meta.dirname, ".."));
const { uploads } = readProjectConfig(repository);
process.chdir(contentDirectory(repository));

/** A link that resolved to nothing, said the way an editor jumps to it. */
type Miss = { at: string; target: string; why: string };

const pages = docPages();
const known = new Set(pages);
const urls = new Set(pages.map((page) => docUrl(page)));
const forwarded = new Set(oldAddresses());

const misses: Miss[] = [];

for (const path of pages) {
  const text = readFileSync(path, "utf8");

  for (const link of [...linksIn(text), ...attributeLinksIn(text)]) {
    const why = fault(path, link);
    if (why) misses.push({ at: `${path}:${link.line}`, target: link.target, why });
  }
}

if (misses.length === 0) {
  console.log(`Every link in ${pages.length} pages points at something.`);
  process.exit(0);
}

console.error(`${misses.length} broken ${misses.length === 1 ? "link" : "links"}:\n`);
for (const { at, target, why } of misses) console.error(`  ${at}  ${target}  ${why}`);
console.error("");
process.exit(1);

/**
 * Why one link is broken, or null when it is fine.
 *
 * Three kinds of address reach here and each is checked against the thing that
 * serves it: an upload against the file on disk, a site-absolute path against
 * the URLs the pages claim, and everything else against the page tree, resolved
 * from the folder the link was written in.
 */
function fault(path: string, { target }: FoundLink): string | null {
  const [address] = splitHash(target);
  if (!address) return null;

  if (["/img/", "/files/", "/uploads/", "/whiteboards/"].some((prefix) => address.startsWith(prefix))) {
    return existsSync(uploadFile(address, uploads)) ? null : `no such file in ${uploads}/`;
  }

  if (UNTOUCHABLE.test(address)) return null;

  if (address.startsWith("/")) {
    const url = stripSlash(address);
    return urls.has(url) || forwarded.has(url) ? null : "no page at that address";
  }

  const points = resolve(dirOf(path), address);
  if (!points) return "points above the docs root";

  return known.has(points) ? null : "no page at that path";
}

/**
 * Every address a page used to be served at and is redirected from.
 *
 * The studio and a publication both forward an address in
 * `docs/moved.json` to where the page went, so a link somebody wrote before a
 * page moved still lands on it. Counting those as fine keeps this from
 * reporting a link that works.
 */
function oldAddresses(): string[] {
  const moves = readMoves(".");
  return moves.flatMap(({ from }) => (finalHome(moves, from) ? [docUrl(from)] : []));
}

/**
 * Every page under the docs root, as the build sees them.
 *
 * The working tree rather than what git tracks, because the build compiles what
 * is on disk: a page written but not yet added is still a page whose links can
 * be wrong. A markdown file among the uploads is an attachment, not a page.
 */
function docPages(): string[] {
  return readdirSync(DOCS_ROOT, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.mdx?$/.test(name) && !inUnderscoreFolder(name))
    .map((name) => `${DOCS_ROOT}/${name}`)
    .sort();
}
