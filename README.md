# Jotdown

A single-user tool for personal sites, docs and a second brain. Markdown in git is the only source of data, and a studio edits it in place, in each site's own look.

- **The app** lists your projects and edits them, from the Dock. Download the DMG from the [latest release](https://github.com/markomitranic/Jotdown/releases/latest).
- **A site** is one project built for readers, deployed anywhere.
- **Context for agents** is the project itself: a folder of markdown in git that an agent reads directly.

The framework is never copied into a project. [PLAN.md](./PLAN.md) is where Jotdown is going and what is done.

## Write a project

A project is `docs/`, its uploads in `docs/_uploads/`, and a `.jotdown/config.json`, in a repository of its own or a folder of a bigger one. The studio's setup wizard, **Add a project** then **Set up a new project** in its project picker, writes all of it, with the docs skills for agents.

```md
---
title: Welcome
description: What these notes are for
---

Start writing here.
```

```json
{
  "version": 1,
  "title": "Notes",
  "repository": "https://github.com/you/notes",
  "branch": "main"
}
```

Pages use the framework's blocks, listed in `.agents/skills/blocks/SKILL.md`, with literal props. `import`, `export` and `{expressions}` fail the page. `.agents/skills/authoring/SKILL.md` has the authoring conventions, and a project installs every skill with `npx skills add markomitranic/Jotdown --skill '*' -y`.

## Work on Jotdown

Use Bun 1.4.2. It installs the dependencies and runs Next.js too, so there is no Node to install.

```sh
bun install --frozen-lockfile
git config core.hooksPath .githooks
bun run dev
```

The studio opens on <http://localhost:6192>, and signs in to GitHub from its top right corner. `STUDIO_DEV_TOKEN="$(gh auth token)"` skips the sign-in. A folder's pages come from disk, and a save writes the file and commits nothing. A GitHub project's save is a commit on its branch, as you.

The hooks path is set once per clone, so every commit subject is checked against the conventional-commit grammar.

The code is three workspaces: `packages/core` renders a project, `apps/studio` is the studio, `apps/desktop` wraps it in the macOS app and `apps/publication` builds a site. `bun run build` in `apps/desktop` builds the app and its DMG; a `v*` tag builds and releases it. `bun run storybook` opens the component library on port 6006, and `bun run preview` runs this repository's own docs as a site.

## Publish a site

A site is the project built into static files. Name the Jotdown version in `.jotdown/config.json`, `"jotdown": "v0.3.1"` or `main` when unset, and the host clones Jotdown at that ref and builds the site into `.jotdown/out`:

```sh
git clone --depth 1 --branch main https://github.com/markomitranic/Jotdown.git .jotdown/framework
bash .jotdown/framework/apps/publication/build.sh
```

From a checkout of Jotdown, `bun scripts/jotdown.ts build <project>` and `bun scripts/jotdown.ts dev <project>` do the same for any project folder.

[deployment/README.md](./deployment/README.md) has the GitHub Pages and Vercel files a project copies.

## Check your work

```sh
bun run lint
bun run test
bun run check:links
bun scripts/jotdown.ts check docs
```
