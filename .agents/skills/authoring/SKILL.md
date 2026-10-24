---
name: authoring
description: Use only when working on the docs site. How a docs project is laid out and how to write its pages, sections, front matter, links, generated references and changelogs, in the house tone. Read before writing, editing, moving or reviewing any page under docs/.
---
# Authoring

How to write documentation for a project that uses Jotdown. A project is
content and one config file, the context an agent reads beside the code. The
framework that compiles it, the studio that edits it and the site that serves
it to readers live elsewhere, and nothing here asks you to touch them.

## A content project

```
<repository>/
├── .jotdown/                   ← Jotdown's own folder, committed
│   ├── config.json             ← title, repository, content, logo, theme
│   └── vercel.json             ← a host's files, when the docs are published
└── <content>/                  ← the repository root itself when content is unset
    ├── docs/                   ← all pages
    │   ├── index.mdx           ← landing page, served at /
    │   ├── meta.json           ← the main section's title, blurb and order
    │   ├── moved.json          ← forwarding record for moved pages
    │   ├── _uploads/           ← images, files, whiteboards, fonts
    │   └── <section>/
    │       ├── meta.json       ← the section's label, description and order
    │       ├── index.mdx       ← section landing page
    │       └── <document>.mdx  ← documents
```

A project is one repository, with its config always at `.jotdown/config.json`.
`.jotdown/` is Jotdown's folder, committed like `.github/`: the config, and a
host's files when the docs are published, which never collide with an app's own
`vercel.json` at the root. The pages sit at the repository root,
or in the folder `content` names, as in `"content": "handbook"`. One repository
holds one project.

The studio serves a project under its `owner/repo`, so
`/you/notes/guides/sections` is the page `docs/guides/sections.mdx` of
`you/notes`, and a link to it opens the same page for anybody who can see the
repository. `/` is the studio's welcome page. A publication serves the same
page at `/guides/sections`, so pages link to each other as a site at the root
and the studio moves those links under the project for you. See
[ADR 0017](https://github.com/markomitranic/Jotdown/blob/main/docs/decision-records/0017-project-in-the-address.mdx).

`.jotdown/config.json` is plain data, so nothing in a project runs code:

```json
{
  "version": 1,
  "title": "Engineering handbook",
  "description": "How our team builds and operates software",
  "repository": "https://github.com/your-org/handbook",
  "url": "https://handbook.your-org.com/docs",
  "branch": "main",
  "content": "apps/docs",
  "logo": { "alt": "Handbook", "src": "/uploads/logo.svg" },
  "favicon": "/uploads/favicon.png",
  "theme": {
    "light": { "background": "#ffffff", "foreground": "#1c1a33", "primary": "#433a86" },
    "dark": { "background": "#0d0c1b", "foreground": "#ecebf5", "primary": "#b9acff" },
    "sections": { "orders-api": "chart-2" },
    "fonts": { "sans": { "family": "Geist", "src": "/uploads/fonts/geist.woff2" } }
  }
}
```

Every field is optional, but the studio only lists a repository in its switcher
once the file exists. A project without it takes its repository name as its
title. `content` is the folder holding `docs/`. `uploads` moves the uploads to another folder of `content`, `docs/_uploads` when
unset. `branch` is where studio edits land, the default branch when unset.
`url` is where the publication is hosted for readers, domain and base
path, so the studio can hand out a reader's link to a page. `favicon` is the
tab icon of the publication and the local preview; the studio always shows its
own.

`theme` is the project's colours, in shadcn's own token names, once per mode.
Pick `background`, `foreground`, `primary`, `destructive` and `chart-1` to
`chart-5`; every other shadcn token is worked out from those unless you set it
too, and a core colour you leave out keeps the default. `sections` gives a
section its colour by naming a token, and the stripe along the bottom of the
window runs through `chart-1` to `chart-3`. See
[Branding](https://github.com/markomitranic/Jotdown/blob/main/docs/studio/branding.mdx). `fonts` names the
`sans`, `serif` and `mono` faces, each a family and the font file among the
uploads to load it from. The theme is the whole of a project's look: there is
no stylesheet beside it.

Uploads live in `docs/_uploads/`, beside the pages they belong to. A folder
under `docs/` whose name starts with `_` never holds pages, so nothing in it
shows in the sidebar. Uploads made in the studio land there, and pages link to
them by their public address, which never names the folder:
`/img/docs/<file>`, `/files/docs/<file>`, `/whiteboards/<file>`, or
`/uploads/<file>` for anything you put there by hand.

`moved.json` writes itself. The sidebar arranger appends an entry on every move
and delete. The studio and a publication both redirect an old address to the page's
new one. A rename in git is the one case it does not cover:

- Add no entry. The old URL dies, and that is fine.
- Fix the links under `docs/` that pointed at it. A grep for the old path finds them.
- Ask first when the old URL was shared with anyone. Never add an entry
  unasked.

## What a page may contain

Pages are markdown plus a fixed set of components the framework provides:
callouts, `<VideoEmbed />`, `<LinkEmbed />`, `<FileAttachment />`, `<Whiteboard />`, the
layout components, inline SVG figures and the rest listed in the blocks
skill, which also holds the styling rules. Read it before adding anything
richer than markdown. That list belongs to the framework, and a project cannot add to it.

Component props are literal values: strings, numbers, booleans, and arrays or
objects of those. Everything that would run code fails the page before it
compiles:

- `import` and `export` lines.
- Expressions such as `{new Date().getFullYear()}` or `{props.title}`.
- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<meta>`, `<link>`,
  `<base>` and `<include>` tags.
- `on*` event handlers and `dangerouslySetInnerHTML`.

## Adding a document

1. Create an `.mdx` file in the right section folder, named lowercase and
hyphenated (`code-review.mdx`). Every page you write by hand is `.mdx`: a `.md`
file compiles as plain markdown, so a `<VideoEmbed />` or a figure in one
renders as nothing at all and says nothing about it. The two things that arrive
as `.md` are a page a generator wrote and a changelog; see below.
2. Give it front matter:
  ```yaml
   ---
   title: Code review
   icon: GitPullRequest
   description: One sentence. Shows up in search results and on section cards.
   ---
  ```

  `title` and `description` are required. `icon` is an optional
  [Lucide](https://lucide.dev/icons/) component name, shown beside the page in
  the sidebar and beside the page title. Clicking that icon on the page opens a
  search over the Lucide set, and the picker writes this same field. A page with
  no icon offers one in the margin beside its title. Use one when it gives the
  page a clear visual shorthand, not merely to fill the space. The page's URL is
  its path under `docs/` and the sidebar label is its `title`, so `slug`,
  `sidebar_label` and `sidebar_position` do nothing.
3. Add the file name, without its extension, to the `"pages"` array in the
   folder's `meta.json`, at the place it should sit. Leave it out and the page
   still appears, alphabetically, after the named ones, because every `pages`
   array ends with `"..."`.
4. Open with an editorial illustration, painted with the editorial-illustration
   skill into an SVG file of its own and shown as a markdown image, then write
   the content. Standard Markdown, plus callouts (`:::note`, `:::warning`,
   `:::tip`) and the blocks in the blocks skill. A generated page and a
   changelog go without one.
5. Link to other docs by relative file path (`./commit-signing.mdx`,
   `../architecture/index.mdx`); site-absolute paths like
   `/security-and-compliance/commit-signing` work too. Link every noun phrase
   that names another page, the first time it appears in a section, and link
   liberally: a reader who lands mid-page needs a way to the thing you are
   talking about. Never wrap a link in backticks,
   `` `[text](./foo.mdx)` `` renders as literal code instead of a link. A link
   whose target is missing is not an error while you write: the reader gets a
   404 on the click, so make sure the file you point at exists.

## Adding a section

1. Create a folder under `docs/` with a lowercase hyphenated name.
2. Add `meta.json` with the sidebar label, a one-sentence description and the
   order of the things inside:
  ```json
   {
     "title": "Observability",
     "icon": "Activity",
     "description": "How we know what production is doing, and who gets woken up.",
     "pages": ["alerting", "dashboards", "..."]
   }
  ```

  The description is what the section's card says on the page above it. Leave it
  out and the card says nothing about whether the section is the one the reader
  wants. `pages` names files and subfolders without extensions, and the trailing
  `"..."` is what lets a page nobody listed still show up. Keep it. Leave
  `"index"` out: the folder's `index.mdx` is already the folder row's own page,
  and listing it takes the page off the row and adds it again as a child. Only
  a section with its own sidebar lists it. Where the
  section itself sits among the others is its folder name in the `pages` array
  of `docs/meta.json`.
3. Add an `index.mdx` when the section needs an introduction or a card grid.
   Front matter, then the introduction, then `<DocCardList />`. The
   `description` is printed under the page title for you, so do not repeat it
   as a lead paragraph.
4. To put pages under a page that already exists, move `name.mdx` to
   `name/index.mdx` and put them beside it. The page keeps its address and its
   place, so add no `moved.json` entry, and fix its own relative links one
   level down.
5. Prefer folding related material into an existing section. A short list of
   sections is easier to navigate than a long one.

### Sections with their own sidebar

The switcher above the sidebar tree moves a reader between sections, and a
section is a folder carrying `"root": true` in its `meta.json`. Inside one the
sidebar is that section and nothing else, and its first row is always an
Overview page. Make a section when it is a body of work with its own readers:
decision records, a generated reference. Keep it an ordinary folder when a
reader moves between it and its neighbours in one sitting, because a section
hides its neighbours. Read [Sections and the switcher](https://github.com/markomitranic/Jotdown/blob/main/docs/how-it-works/sections.mdx)
before adding one; the rules that bite are these:

- Name the folder what its `title` says, lowercase and hyphenated.
- `title`, `icon` and `description` in the section's `meta.json` are the
  switcher row. Keep that description to about thirty characters, since it is
  cut with an ellipsis. This is the one place a description is a label.
- `"index"` first in `pages`, with an `index.mdx` titled `Overview` beside it. A
  root folder does not pick its landing page up on its own, and
  `"pagesIndex": "index"` hides it, so use neither shortcut.
- `!<folder>` in `docs/meta.json` holds the folder out of the main tree, and the
  switcher lists sections in the order those lines come in. List
  it plainly and its pages appear in both sidebars.
- One line in the `sections` of the project's theme, `"<folder>": "chart-2"`,
  gives the section its colour in both modes. The main tree takes `primary`.
- The sidebar arranger only sees the section it is in, so a page cannot be
  dragged between sections. Move the file and fix both `meta.json` files by hand.

### Labelling pages without a folder

To put a heading over a few pages in the sidebar, add a separator to the
`pages` array of their `meta.json`, `"---Runbooks---"`, right above them. It
draws the label over every page after it, up to the next separator, and no file
moves, so no address changes. A Lucide icon goes in a bracket pair in front,
`"---[BookOpen]Runbooks---"`. The sidebar arranger can add, rename, drag and
remove one. Make a section, a folder with a landing page, when the landing page
teaches something; use a separator when it would only repeat the label.

### Linking out of the sidebar

A row in a `pages` array can be a link, `"[Next.js docs](https://nextjs.org/docs)"`,
with an optional Lucide icon in a bracket pair in front,
`"[Rocket][Next.js docs](…)"`. A link has no file, so it is in no search index
and no `llms.txt`. See
[Putting a link in the sidebar](https://github.com/markomitranic/Jotdown/blob/main/docs/how-it-works/sidebar-links.mdx).

## Whiteboards

Insert `/whiteboard` in the studio to add an Excalidraw drawing. The page stores
`<Whiteboard src="/whiteboards/<hash>.excalidraw" preview="/whiteboards/<hash>.png" />`,
and both files land under `docs/_uploads/whiteboards/`. Scene JSON includes embedded
images. The files are content-addressed and must be committed with the page that
references them. See [Whiteboards](https://github.com/markomitranic/Jotdown/blob/main/docs/how-it-works/whiteboards.mdx) for editing and
size limits.

## Generated pages

A reference generated from code, TypeDoc output being the case we built this
for, lands as `.md` rather than `.mdx`, because TypeDoc writes `Array<string>`
and `Promise<{ … }>` into prose and MDX would read those as components. Generate
it in the repository that owns the code and commit the output into `docs/`.
Each page needs `title` and `description` front matter, which
`typedoc-plugin-frontmatter` writes, and the folder needs a `meta.json`. Give
the whole reference its own section with `"root": true` and point the generator
straight at that folder, so the `index.md` it writes is the section's Overview.
An edit made in the studio is overwritten by the next generation unless it also
lands in the JSDoc upstream. The framework writes the `./` into TypeDoc's
`[Form](Form.md)` links as the page compiles.

## Changelog pages

A page whose front matter carries `changelog: true` is a changelog, and it is
the one hand-written page that is `.md` rather than `.mdx`: a release tool
writes its lines, and a commit subject carrying `Promise<void>` or `{foo}` is
JSX to MDX and fails the build. Paste a project's `CHANGELOG.md` under the
front matter and that is the whole file. The reader gets a search box, a date
range, a jump-to-release picker and a rail with a dot per release.

```md
---
title: Changelog
description: Every release of the website, newest first.
changelog: true
---

## [2.15.6](https://github.com/o/r/compare/v2.15.5...v2.15.6) (2026-09-04)

### Bug Fixes

* **infra:** stop null query condition killing redirects ([ae6ab07](https://github.com/o/r/commit/ae6ab07))
```

That is the whole content model: **the file, no second copy, no generator**.
Refreshing the page is pasting a newer copy under the same front matter. Do not
add a script, a mirror folder or a page per release; each was built and taken
out again, because every one is a second copy of content the release tool
rewrites on every bump.

What the framework does with the file:

- A release is a heading like `## [2.15.6](…) (2026-09-04)`, or the same with
  no link. The version is one to three numbers, may carry a prerelease suffix
  and a leading `v`, and everything down to the next such heading is that
  release's body, prose, lists, tables, images and all.
- The release heading is consumed and the component draws its own. A `###`
  heading inside a release becomes a section rather than a table-of-contents
  row.
- A version bump with nothing under it is still a release and still gets a dot.
- Whatever sits above the first release heading stays as ordinary markdown.
  Delete a pasted `# Changelog` heading, or the page carries two titles.

Split a project with years of releases into a folder with a page per major
version, `v2.md`, `v1.md`, no `index.mdx`, newest first in the folder's
`meta.json`. Each page filters only its own releases, and a long page carries
its content about twice over as hydration data, so around a hundred releases is
the point to split. `ChangelogTimeline`, `ChangelogRelease` and
`ChangelogSection` are never typed by hand.

## Tone of voice

This is a technical documentation library. Directed at technical readers, but with an aura of gentle onboarding and teaching. Channel the same energy that good science communicators have, or fun engineering books like "Head First Design Patterns", that provide concrete, but simplified examples and illustrations.

## Writing for humans and AI

Our mission is to lower cognitive load. Our pages MUST NOT sound like a dry legal/technical document. They should explain conceptually what has changed, in a friendly way like a senior teaching a junior. The whole page is what the author would say walking you through the PR at a whiteboard. If they wouldn't say it out loud, it doesn't deserve to go in.

**Every page answers one question a reader actually arrived with.** Write that
question down, in their words, before you write the page: "How do I publish
this as a site?", "Why did my page fail to compile?", "What do I type
to get a diagram?" It decides the title, the chapters, what gets cut, and the
point where a reader stops reading because they have their answer. A page that
dumps everything we know about a topic is notes. It leaves the reader to do the
sorting we were supposed to do for them.

The bar is a good SaaS or open-source manual, where every page is somebody's
task:

- The title is the answer, not the name of the technology. "Publishing it as
  a site", not "Docker and Vercel".
- Chapters are the steps of that task, in the order the reader does them.
  Anything serving a different question is a different page.
- What we learned along the way is not the page. Measurements, dead ends and
  the things that bite are worth keeping, folded into `<Accordions>` at the end
  of the chapter they belong to: the page reads short, and the person about to
  repeat our mistake still finds out.
- A path only some readers take, a monorepo or an optional block, is a
  subsection under the common case and never the spine of the page.

An ADR, meeting minutes, a changelog or a map of a whole system is a record
rather than an answer, and those are the exception. Everything else here is a
manual page.

- Address the reader as "you" (fx. "you'll hit this again in chapter 3")
- Answer the questions a junior would actually ask out loud ("wait, why is this in the worker?").
- Start with an abstract. That is when the human's attention is at its sharpest, but their knowledge of the intent at the lowest. It should contain the moral of the story, what was fixed, why, and how, from a non-technical perspective, with a believable example.
- After the abstract you can go a bit deeper, in 2 paragraphs, explain the zoomed out approach and list relevant links.
- Open every page with an editorial illustration, right under the front matter and before the abstract: a painted scene that makes the page's one idea land at a glance, the way a magazine opens an article. Draw it with the editorial-illustration skill, as an SVG file in the uploads inside `:::wide`, never inline in the page. It sets the mood and the metaphor; it explains nothing, so the diagrams and charts that do the explaining still belong in the chapters.
- Chapter titles should be simple, short and directly describe the problem. (fx. "Search request was triggered on every keystroke")
- Each chapter should start with a problem statement, and approach to solve it, before diving into the details.  Rationale second, details third. A reader should get the answer in the first paragraph.
- Chapter paragraphs, code and the figures should be interwoven.
- We must rely on figures to lower cognitive load, as humans are visual learners. Lowering cognitive load with visual aids is our north star metric. Feel free to add figures and charts into chapters at a whim.
- Pick the form of a chapter's visual from what the prose says. A mechanism, a flow or a set of parts is a figure, drawn with the figure skill. A number is a `<Chart />`, per the chart skill: a trend over time is a line, a breakdown is bars, a before/after is two bars side by side, a ranking is sorted bars. Three sentences of numbers in a paragraph should have been a chart.
- Don't restate or announce things you'll say, just jump into the meat of it.
  ```
  bad:  "In this chapter we'll walk through how the validation logic was restructured."
  good: "The 2-character minimum was moved from the zod schema without any actual changes to the rule."
  ```
- The reader is technical, but you should assume zero knowledge of the project/codebase/domain.
- Hover-tooltips explain business terms or domain terms or references in banal plain-language, using `<abbr title="plain-words explanation">term</abbr>`.
- Rewrite common signs of AI writing such as slop-filling, em dashes, or bad antithesis.
- Prefer concrete guidance ("use X because Y") over discussion of tradeoffs in
the abstract.
- Ground a term the first time you use it, in the same sentence you name it.
- When a document records a choice that will be expensive to reverse, also write
an ADR in `docs/decision-records/`.
- Name versions and dates when you name a tool, so stale guidance is visible as
stale.
- Short paragraphs and real headings. The search index and the table of contents are both built from headings.

## Reviewing pages before you commit

To read and edit the working copy, open the project's folder in the Jotdown
studio. Pages are read from disk, including ones nobody has committed and
folders git ignores, and an open page refreshes when a file changes under it.
Saving writes the file and commits nothing, so review the change with
`git diff` like any other. The editor is whoever git names on the machine.

When you write pages for somebody, suggest they open the folder in Jotdown so
they can read the result before it is committed.

## Before you commit

- Run `jotdown check` on the pages you changed and fix every error it reports,
and the warnings on pages you wrote.
- No secrets, credentials, API tokens, private keys, connection strings, or
personal data. This is documentation, not a vault.
- Internal and staging URLs are fine. A hostname is not a secret:
`argocd.mgmt.example.net` or a `*.staging.*` admin URL belongs on
the page if the page is about that system. What must never land here is the
thing that gets you *into* it. A publication has no password of its own, so
private docs need access control at the host.
