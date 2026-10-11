Jotdown is a single-user tool for personal sites, docs and a second brain. It has three lenses:

1. **The app.** The studio, where every project is listed and edited in place, inside an Electrobun desktop app (`apps/desktop`). `bun run dev` runs the same studio in a browser.
2. **The site.** A project built read-only for readers, deployed anywhere.
3. **Context for agents.** Each project's repository holds its own content, which agents read directly.

A project is recognised by `.jotdown/config.json` in its repository. [PLAN.md](./PLAN.md) is the roadmap: read it first, and keep it current when a decision changes.

## Working on the framework

This repository is the framework, and its own `docs/` and `.jotdown/config.json` are a content project like any other: the manual, the decision records and the example pages that double as test content. Everything else is the framework.

It is Next.js 16 with `fumadocs-core` and `fumadocs-mdx` for the page tree and the MDX pipeline, Tailwind, run with Bun 1.4.2, as Bun workspaces: the core, the studio, the publication and the desktop app. Each app is a whole Next.js app of its own, with its own `app/` and
`next.config.ts`, and neither knows the other exists.

Code imports the core as `@jotdown/core/<path>`, and an app imports its own files as `@/<path>`. The core never imports an app.

### Styling a component

Tailwind utilities on Tailwind's own scale (`text-sm`, `gap-6`, `mt-8`) are the
normal way to style a component. In a component, reach for the token, never
the value: `bg-card`, `text-muted-foreground`, `border-border`,
`text-primary`, or a `--jd-*` token. Both colour modes must work; dark mode
is the `.dark` class on `<html>`, never `[data-theme]`.

The sheets are ordered by `packages/core/css/global.css`, which both apps
import. `ui.css` makes the shadcn variables into Tailwind colours and holds the
layout's animations and utilities, `prose.css` is the article's typography,
`custom.css` declares the `--jd-*` tokens the blocks paint with, the `--jd-fig-*`
figure palette and the blocks themselves (`jd-fig`, `jd-shot`, `jd-diagram`,
`jd-stage`, `jd-video`, `jd-file`), and `brand.css` is the default palette and
typefaces, light in `:root` and dark in `.dark`. A project's `theme`, its
colours, radius and fonts, becomes a stylesheet (`packages/core/lib/theme.ts`)
that loads after all of them.

The theme is the whole of a project's look; there is no project stylesheet. The
docs layout and the blocks are the core's own, in `packages/core/components/docs`
and `packages/core/components/blocks`. Don't restyle the article with a
`div.prose` rule; change `prose.css`.

### Storybook

The component library is Storybook, started with `bun run storybook` on port 6006. It lives in the studio, since its pages edit as well as read, and
everything it needs is in `apps/studio/.storybook/`:

- **Pages.** A block's stories render a real page. The `.mdx` beside the
  story compiles through the core's `source.config.ts`, the same chain both
  apps use, and `page.tsx` draws it the way the route does. `Reading` is what a
  site shows; `Editing` is the studio, every block editable.
- **The studio.** `studio-api.ts` answers the live-edit endpoints from memory
  with MSW, so a save, a file that moved on and an unreachable server can each
  be played through in a story. A story picks one with
  `msw.use(...studioApi("moved"))` in its `beforeEach`.
- **Themes.** The toolbar switches the colour mode and the project: the
  default look, or this repository's `theme`.

A studio component's stories sit beside it, as in
`apps/studio/components/studio/ProjectPalette.stories.tsx`. The core's stories
live in `apps/studio/stories/`: a block's page and stories in
`stories/blocks/`, a primitive's in `stories/ui/`. Stories use CSF Next,
`preview.meta()` and `meta.story()`, so their args and context are typed.

Keep the stories up to date whenever you change a component. Use Storybook
for quick prototyping, iteration and testing before you try it in the dev
server.

### Before you commit

Run `bun run lint`, `bun run test` and `bun run check:links`. `bun run lint`
is Biome's formatter and linter, then `bun run typecheck`, then
`bun run lint:docs` on the docs. Biome runs its recommended rules,
including its Next.js and React ones; silence a
rule only on the line, with `// biome-ignore <rule>: <reason>`, and run
`bun run format` to format. The commit
subject is checked by `.githooks/commit-msg` once a clone has run
`git config core.hooksPath .githooks`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
