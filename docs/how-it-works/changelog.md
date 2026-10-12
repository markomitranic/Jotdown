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


## [0.3.8](https://github.com/markomitranic/Jotdown/compare/v0.3.7...v0.3.8) (2026-10-12)


### Bug Fixes

* **images:** keep a column image inside its column, and show illustrations wide ([19f8728](https://github.com/markomitranic/Jotdown/commit/19f8728c3486fd102ca858657be264479e14a5a5))

## [0.3.7](https://github.com/markomitranic/Jotdown/compare/v0.3.6...v0.3.7) (2026-10-12)


### Bug Fixes

* **illustrations:** blend the grain over the smooth shading ([0189302](https://github.com/markomitranic/Jotdown/commit/0189302a6954ad7343cfe7185d2330f4677c9536))

## [0.3.6](https://github.com/markomitranic/Jotdown/compare/v0.3.5...v0.3.6) (2026-10-12)


### Bug Fixes

* **illustrations:** keep the grain in WebKit on macOS ([c0b889d](https://github.com/markomitranic/Jotdown/commit/c0b889db81ac88b3d0e227d57955fa2a66ee2e35))

## [0.3.5](https://github.com/markomitranic/Jotdown/compare/v0.3.4...v0.3.5) (2026-10-11)


### Features

* **studio:** edit every project setting from a settings panel ([dcc21fa](https://github.com/markomitranic/Jotdown/commit/dcc21fa30ef8c8c1426d94c367a0d93ead41d11e))


### Bug Fixes

* **links:** read inline code spans as code, not as links ([11c6881](https://github.com/markomitranic/Jotdown/commit/11c688152fbea1ae4fa7cb77ecd61d92f4b68ffc))
* **studio:** keep a settings draft pinned to the config it started from ([6da2e7b](https://github.com/markomitranic/Jotdown/commit/6da2e7b41935af516dfb216e4368d28268899ede))

## [0.3.4](https://github.com/markomitranic/Jotdown/compare/v0.3.3...v0.3.4) (2026-10-11)

### Features

* keep editorial illustrations as SVG uploads, not inline in the page ([2e0d056](https://github.com/markomitranic/Jotdown/commit/2e0d056e53abd896cd5047ad1b0ba4cb09257450))
* **studio:** offer a prompt that ports _old/ into the new docs when setup ends ([f104065](https://github.com/markomitranic/Jotdown/commit/f104065af9228a940747a5fbdd7d34fccfe8aa25))

### Bug Fixes

* **canvas:** keep the logo in place and show a clicked page on its way ([d6aa3b8](https://github.com/markomitranic/Jotdown/commit/d6aa3b83211cb3d146d52c1c0c7e33dc2a264049))
* **studio:** ask to move old docs into _old/ with a checkbox, not a toggle button ([e28c1de](https://github.com/markomitranic/Jotdown/commit/e28c1de1aa1cda3a24dd02e8323fc1092bd4ae7c))
* **studio:** name the renderers Publication, Custom address and Skinny, with descriptions that fit ([2f57745](https://github.com/markomitranic/Jotdown/commit/2f57745aa431864b3472f71de44eb315031564a5))

## [0.3.3](https://github.com/markomitranic/Jotdown/compare/v0.3.2...v0.3.3) (2026-10-11)

### Bug Fixes

* **studio:** keep a colour mode picked on the canvas, without redrawing the page ([38fafe1](https://github.com/markomitranic/Jotdown/commit/38fafe143c4e8aa6127638d906b16399ce244023))

## [0.3.2](https://github.com/markomitranic/Jotdown/compare/v0.3.1...v0.3.2) (2026-10-11)

### Features

* **studio:** move the studio's chrome into a status strip along the foot of the window ([b1716d9](https://github.com/markomitranic/Jotdown/commit/b1716d9fbd6744575baea8d4fd5cf1f546b6388f))

### Bug Fixes

* **ci:** declare the publication's image imports without a build's next-env.d.ts ([eff7e03](https://github.com/markomitranic/Jotdown/commit/eff7e03a3c0f77465a02be089feb69277d67fe57))
* let the page scroll under the app's title bar, and run the colour stripe along the bottom ([7a0f8d1](https://github.com/markomitranic/Jotdown/commit/7a0f8d1ea3240d37cb46bc85b4563edda48a3086))
* paint editorial illustrations into a bitmap, so the page animates smoothly around them ([21c29af](https://github.com/markomitranic/Jotdown/commit/21c29af86f3d702306a5eee8a67adb263929e957))
* **publication:** keep the page menu beside the title, and offer the app at the foot of the sidebar ([d269689](https://github.com/markomitranic/Jotdown/commit/d2696898bd5ce4b1f30768df6f37185510517ecf))
* **studio:** fill the window with a site's canvas, instead of pushing it below the title bar ([67bfe61](https://github.com/markomitranic/Jotdown/commit/67bfe6166f9cbe39e758586174dd3476e7696bd1))

## 0.3.1 (2026-10-11)

### Features

* jotdown, a studio and a site for docs kept in git ([548c8d2](https://github.com/markomitranic/Jotdown/commit/548c8d266634abba3d8d991c3c2e75707c43174e))
* update the app on its own, open pages from jotdown:// links, and keep jotdown's docs listed ([176b1de](https://github.com/markomitranic/Jotdown/commit/176b1de32a2b1a6805b3d108088960b026ef7542))

### Bug Fixes

* **ci:** declare the story server's file types before serving with them ([1d86d4a](https://github.com/markomitranic/Jotdown/commit/1d86d4ac39934b38b994ab1a6fdcb3477c2c6749))

## 0.3.0 (2026-10-11)

### Features

* Jotdown's first release: the studio as a desktop app, sites built as static files, and a project's own blocks and layouts edited in place.
