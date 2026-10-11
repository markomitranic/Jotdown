---
title: Changelog
icon: RotateCcwClock
description: Every release of Jotdown itself, newest first.
changelog: true
---

Every release of Jotdown, newest first. A release is a tag cut in
[markomitranic/Jotdown](https://github.com/markomitranic/Jotdown), and the
entries below are written by the release itself, from the commits since the
previous tag, so an edit made to this page is thrown away by the next one. A
site pins one with `jotdown` in its `.jotdown/config.json`.

## Wiring your own project's changelog into a page

Any project that already releases with
[commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version)
or `standard-version` can write straight into a page here instead of into a
`CHANGELOG.md` nobody opens.

1. Pick the page, one per major version once you pass a hundred releases or so:
   `docs/changelog/v2.md`, listed in that folder's `meta.json`.
2. Name it `.md` rather than `.mdx`. A commit subject carrying a `<` or a `{` is
   JSX to MDX and fails the build.
3. Put `.versionrc.cjs` at the root of the repository that owns the code, with
   `infile` pointing at that page and `header` holding its front matter.
4. `changelog: true` is what draws the timeline. `title` and `description` are
   required, as on any page.
5. Delete the page before the first run. The tool replaces everything above the
   first release heading, so a file with no release in it gets the header
   written twice.
6. Release the way you already do. The page is rewritten, committed and tagged
   in the same commit as the version bump.
7. Cutting `3.0.0` means pointing `infile` at `v3.md` and leaving `v2.md` frozen
   where it is.

```js title=".versionrc.cjs"
const header = `---
title: Version 2
description: Every 2.x release, newest first.
changelog: true
---
`;

module.exports = { infile: "docs/changelog/v2.md", header };
```

Everything above the first release heading is that `header`, so the words you
want on the page live in this file rather than in the page. If the docs are a
separate repository the tool still writes locally, so copy the file across or
paste it, which is the whole content model either way.

## Releases

## 0.3.0 (2026-10-11)

### Features

* Jotdown's first release: the studio as a desktop app, sites built as static files, and a project's own blocks and layouts edited in place.
