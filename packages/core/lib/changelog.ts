/**
 * Marking up a page that is nothing but a list of releases.
 *
 * A page carrying `changelog: true` in its front matter is a changelog: paste a
 * project's `CHANGELOG.md` under the front matter and that is the whole file.
 * One file, no second copy, no generator, and no wrapper tag to type.
 *
 * What is missing from such a file is structure. Markdown says "here is a
 * heading and some bullets", and the timeline needs to know where one release
 * ends and the next begins before it can filter, count or scroll to one.
 * `remarkChangelog` adds that structure while the page compiles, so the file on
 * disk stays plain markdown anybody can paste into or diff against the project.
 */

/** A subset of mdast, plus the two MDX node shapes this plugin writes. */
type Branch = {
  type: string;
  value?: string;
  url?: string;
  depth?: number;
  name?: string;
  attributes?: Attribute[];
  children?: Branch[];
};

type Attribute = { type: "mdxJsxAttribute"; name: string; value: string };

type Tree = { type: string; children?: Branch[] };

/** What the plugin writes: the wrapper, and the two elements inside it. */
const TIMELINE = "ChangelogTimeline";
const RELEASE = "ChangelogRelease";
const SECTION = "ChangelogSection";

const DATE_AT_END = /\((\d{4}-\d{2}-\d{2})\)\s*$/;
/** `1`, `1.2`, `1.2.3` and `1.2.3-rc.1`, with or without a leading `v`, which the capture drops. */
const VERSION = /^v?(\d+(?:\.\d+)*(?:[-+][\w.]+)?)$/;

/** The anchor a version is linkable at. */
export function releaseId(version: string) {
  return `release-${version}`;
}

const WRITTEN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * A date the way a person reads it, from the `YYYY-MM-DD` a release heading carried.
 *
 * The locale is fixed rather than the reader's, so the server and the browser
 * spell a date the same way and nothing has to be redrawn on hydration.
 *
 * @example written("2026-09-04"); // "4 September 2026"
 */
export function written(date: string) {
  return WRITTEN.format(new Date(date));
}

/**
 * Turns a page flagged `changelog: true` into one element per release, inside a timeline.
 *
 * A heading starts a release when it reads as a version and a `(YYYY-MM-DD)`
 * date, which is what a release tool writes and what tells a release heading
 * apart from the `### Bug Fixes` sections under it. The heading is consumed:
 * its version, date and compare link become attributes, so the component draws
 * its own and there is no duplicate to style around. Everything else under a
 * release is passed through untouched, prose and lists alike.
 *
 * Whatever sits above the first release heading is left where it is, as
 * ordinary markdown above the filters, so a pasted file keeps its own
 * introduction.
 *
 * Section headings are rewritten too, into `<ChangelogSection>`. That is not
 * cosmetic: a heading left as a heading lands in the page's table of contents,
 * and 144 releases would put four hundred rows in it.
 */
export function remarkChangelog() {
  return (tree: Tree, file: { data: Record<string, unknown> }) => {
    if (!flagged(file.data.frontmatter)) return;

    const children = tree.children ?? [];
    const first = children.findIndex((child) => child.type === "heading" && reads(child));
    if (first === -1) return;

    tree.children = [...children.slice(0, first), timeline(children.slice(first))];
  };
}

/**
 * True when a page's front matter asked to be drawn as a timeline of releases.
 *
 * `fumadocs-mdx` strips the front matter before the markdown is parsed and
 * hands it to every plugin as `file.data.frontmatter`, so there is no `yaml`
 * node in the tree to read it off.
 *
 * @example flagged({ changelog: true }); // true
 */
function flagged(frontmatter: unknown) {
  return (
    typeof frontmatter === "object" &&
    frontmatter !== null &&
    "changelog" in frontmatter &&
    frontmatter.changelog === true
  );
}

/** The wrapper the browser filters inside, holding one element per release. */
function timeline(children: Branch[]): Branch {
  return { type: "mdxJsxFlowElement", name: TIMELINE, attributes: [], children: releasesIn(children) };
}

/** A flat run of headings and bodies, regrouped so each release is one element. */
function releasesIn(children: Branch[]): Branch[] {
  const releases: Branch[] = [];
  let open: { heading: Branch; announced: Announced; body: Branch[] } | undefined;

  const close = () => {
    if (open) releases.push(release(open.heading, open.announced, open.body));
  };

  for (const child of children) {
    const announced = child.type === "heading" ? reads(child) : undefined;
    if (announced) {
      close();
      open = { heading: child, announced, body: [] };
      continue;
    }

    open?.body.push(child.type === "heading" ? section(child) : child);
  }

  close();
  return releases;
}

/** One release as an element the component can filter on and draw. */
function release(heading: Branch, { version, date }: Announced, body: Branch[]): Branch {
  const compare = linkIn(heading);

  return {
    type: "mdxJsxFlowElement",
    name: RELEASE,
    attributes: [
      attribute("version", version),
      attribute("date", date),
      ...(compare ? [attribute("compare", compare)] : []),
    ],
    children: body,
  };
}

/** A `### Bug Fixes` heading, as an element rather than a heading. */
function section(heading: Branch): Branch {
  return { type: "mdxJsxFlowElement", name: SECTION, attributes: [], children: heading.children ?? [] };
}

type Announced = NonNullable<ReturnType<typeof reads>>;

/** The version and date a heading announces, or nothing when it is a section heading. */
function reads(heading: Branch) {
  const label = words(heading).trim();
  const dated = DATE_AT_END.exec(label);
  const date = dated?.[1];
  if (!dated || !date) return undefined;

  const version = VERSION.exec(label.slice(0, dated.index).trim())?.[1];
  if (!version) return undefined;

  return { version, date };
}

/**
 * Every word under a node, with link targets left out.
 *
 * A link's text is a `text` child and its target is a `url` field, so a
 * release heading reads as `2.15.6 (2026-09-04)` and never as the compare URL
 * wrapped around it.
 */
function words(node: Branch): string {
  if (typeof node.value === "string") return node.value;

  return (node.children ?? []).map(words).join(" ");
}

/** The first link target under a node, which in a release heading is the compare URL. */
function linkIn(node: Branch): string | undefined {
  if (node.type === "link" && node.url) return node.url;

  for (const child of node.children ?? []) {
    const found = linkIn(child);
    if (found) return found;
  }

  return undefined;
}

function attribute(name: string, value: string): Attribute {
  return { type: "mdxJsxAttribute", name, value };
}
