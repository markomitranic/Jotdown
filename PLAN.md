# Jotdown: the plan

Jotdown is a personal fork of Noation 3.9.3 (commit `b438ae0`), a docs framework built at NoA. It becomes a single-user tool for personal sites, docs and a second brain: markdown in git is the only source of data, and a Notion-like studio edits it WYSIWYG in each site's own look. The studio is a desktop app in the Dock; nothing about it is deployed.

Read this file first in every session. Work the phases in order, tick the boxes as they land, and keep this file current when a decision changes.

## Where we start

What the fork already has, and keeps:

- The inline editor, `apps/studio/src/plugins/live-edit` (about 28k lines). It mounts TipTap editors onto server-drawn markup through source-range stamps and splices edits back into the file.
- Two storage adapters behind one interface: `apps/studio/server/storage/{disk,github}` with a router in `storage/index.ts`.
- A local studio mode (`STUDIO_LOCAL=1`, a GitHub token from `gh`), started by `scripts/noation.ts`, which edits folders on disk and GitHub repos.
- The publication app, `apps/publication`, built by `build.sh` after cloning the framework into the content repo's `.noation/framework`.
- The blocks in `packages/core/components/blocks`, Storybook in `apps/studio/.storybook`, the docs linter in `packages/lint`, and the agent skills in `.agents/skills`.
- In Noation's history only: an Electron desktop app from its first v3 alpha, `desktop/` at `4023e01^` (about 240 lines in `main.cjs` plus `electron-builder.yml`). It is the fallback if Electrobun fails.

Three facts from the survey that shape the plan:

- **Rendering never goes through storage.** It reads a folder on disk. The GitHub adapter first copies a commit into a local folder.
- **Pages render only on the server today,** because of the runtime MDX compile (`fumadocs-mdx` `dynamic`, `remarkRuntimePositions` reading disk, Shiki at compile time, `pageBindings`). The blocks and the editor don't need the server, and Storybook (`PageStory`) and `inplace/DraftArticle.tsx` already render pages in the browser.
- **The local studio as it stands is already the Skinny renderer** described below, over both adapters. Phases 1 to 3 trim it and wrap it in the app before any new architecture lands.

## Target design

### Principles

- One user. No locks, comments, presence, org installs, sign-in pages, sessions or password-protected publications.
- The studio runs only on your machine, as a desktop app. Publications deploy on Vercel, as Next.js apps (ADR 0027).
- A content repo holds content only: `docs/`, uploads, `.jotdown/config.json`, and optionally its own React components and layouts. The framework is never copied into it; it is cloned at build time and the project folder is injected.
- Content is data and code is code. Content arrives at runtime (from disk, GitHub or the studio). Components and layouts are bundled at build or dev time.
- Markdown stays hidden from the person editing. `.md` everywhere, `.mdx` only where a page uses a component.
- Agents read the content folder directly, the context warehouse. The skills ship with the framework.

### The pieces

1. **Content:** markdown and MDX, uploads, `meta.json` files and `.jotdown/config.json`, on disk or in GitHub.
2. **Kit:** the contract between components and the studio: hooks, editable primitives, optional block metadata.
3. **Studio:** the Next.js app that lists projects and edits them, running inside the desktop app.
4. **App:** an Electrobun shell, downloaded once, kept in the Dock.
5. **Site build:** a project built into a Next.js app on Vercel, which also contains the hidden `/_edit` canvas.

### The app

- **Electrobun 2.x** with `build.mainProcess: "bun"`. Not the default Cottontail runtime, because the app runs Next's server and uses `Bun.secrets`.
- **Launch:**
  1. Clicking the icon starts the studio's Next standalone server, bundled into the app, with the bundled Bun.
  2. The server binds `127.0.0.1` on a random port.
  3. The app opens a window onto it: `titleBarStyle: "hiddenInset"`, links to other sites open in the default browser.
- **Quit:** quitting stops the server and any site dev servers the app started. No background service, no command line.
- **App data:** in the app's data folder (`DOCS_DATA_DIR`):
  - the favorites list
  - renderer choices and custom URLs
  - the folder registry
  - the compile cache

  The window's address changes every launch, so nothing lives in browser storage.
- **GitHub:**
  - Sign in through GitHub's device flow: enter a code on github.com. It needs a public OAuth client ID and no secret.
  - The token goes into the macOS Keychain with `Bun.secrets`.
  - `gh` isn't used, because an app opened from the Dock doesn't get your shell's `PATH`.
- **Native pieces:** the folder picker, a `jotdown://` URL scheme (`app.urlSchemes`, the `open-url` event) and the Electrobun Updater, with delta patches from a static host (`release.baseUrl`).
- **Local server security:**
  - The launch URL carries a per-launch secret. The server trades it for a `SameSite=Strict`, `HttpOnly` cookie and refuses any request without that cookie.
  - The server also refuses any `Host` other than `127.0.0.1` or `localhost`.
  - Keep the existing cross-site write guard. Other websites in your browser can reach `127.0.0.1`.
- **Distribution:**
  - A DMG for Apple Silicon, attached to a GitHub release.
  - Ad-hoc signed to start, with a one-time "Open Anyway" in System Settings.
  - Signing and notarization (`build.mac.codesign`, `build.mac.notarize`) once an Apple Developer ID exists.
- **Renderer:** WKWebView (Safari's engine) by default.
- **Fallback ladder:**
  1. WebKit misbehaves with the editor: set `bundleCEF: true` and `defaultRenderer: "cef"` to ship Chromium inside the app.
  2. Electrobun itself fails: restore the Electron app from `4023e01^`.
  3. Electron fails too: the studio runs from the command line as an installed web app.

### Projects and the project menu

- The menu shows **favorites**. A project is a located config file, nothing more.
- **Add** offers three ways to locate a config:
  1. GitHub autodiscovery: every repo you can reach with a `.jotdown/config.json`.
  2. A GitHub URL or `owner/repo`, for anything discovery missed.
  3. A local folder: the native folder picker pointed at a config on disk.
- Adding saves the project to favorites. The source decides the storage adapter, never the renderer.
- Removing a favorite never touches the project.

### Storage

- Two adapters: **GitHub** (reads the branch head, saves are commits) and **filesystem** (reads and writes files in place, no git).
- Outside changes are detected in both: the folder by watching or fingerprinting files, GitHub by checking the branch head while the window is in use. Both feed the existing "this file changed elsewhere" (409 stale) handling, because agents, the IDE and other machines also write.

### Renderers

A toggle in the top right, next to the project selector, picks how a project is drawn:

- **Site:** an iframe of `<config url>/_edit`, the site's own build.
- **Custom URL:** an iframe of any address, usually `http://localhost:<port>/_edit` from the site's dev server. For a folder project, the app starts that dev server itself and stops it when idle. Site and Custom are one implementation with a different address.
- **Skinny:** the studio renders the content itself with the framework's default components and the project's theme tokens. Not real WYSIWYG for sites with custom code.

Defaults: Site when the config has a `url`, otherwise Skinny. The last choice and any custom URL are remembered per project and never written to the config.

| | Site | Custom URL | Skinny |
|---|---|---|---|
| **GitHub** | The default: edit in the live site's look | Work on components on `localhost`, content via GitHub | Site down, no publication, or too old |
| **Folder** | Content on disk, code from the last deploy | Files on disk plus the site's dev server with hot reload | Universal markdown editor |

### The canvas

- Every site build includes a hidden, client-only `/_edit` page: the site's layout, theme and components plus the editor runtime, with no content baked in. Readers never download the editor.
- The studio frames it and talks over `postMessage`. Content and the page tree go in; edits, uploads and navigation come out; the studio writes through the storage adapter. The canvas needs no secrets or sign-in.
- **Handshake:** the canvas announces its protocol version, framework version and project identity. Failures get a dead page with fix steps and an "Open in Skinny" button:
  - nothing answered (with the dev server's last log lines when the app started it)
  - not a Jotdown canvas
  - too old (rebuild the site)
  - wrong project ("`localhost:3000` is serving `blog`, not `docs`")
- **Who draws what:**
  - The studio draws the sidebar, palette, top bar, save and deploy status, and settings.
  - The canvas draws everything that touches content (block handles, slash menu, toolbars, block settings) inside a shadow root, so the site's CSS and the editor's can't affect each other.
- **Origins:** the canvas accepts any loopback origin as its studio, because the app's port changes every launch. The canvas holds nothing the studio didn't give it. The studio accepts only the canvas origin it framed.
- The protocol is small, typed and versioned, because it is a contract with every site ever built.

### Components

Any React component works in MDX and grows more editable the more it opts into:

1. **Any component:** a block you can select, move, duplicate and delete, with its props editable as source in a popover.
2. **Renders `children`:** the children are edited in place as rich text, and the component never knows.
3. **Registers metadata** (`defineBlock`: zod props schema, icon, label, defaults): a settings popover and a `/` menu entry.
4. **Uses kit primitives** (`<Editable.Text prop="title" />`, `<Slot />`, `useIsEditable()`): props edited inline.

- One file renders both the published page and the editable one, so there is nothing to drift.
- The framework's defaults are written with the same kit at the top of that ladder. `jotdown add <block>` copies one into the project, shadcn-style, and a project component with the same name wins.
- Text flow (paragraphs, headings, lists, inline marks, links) is styled, never replaced, because ProseMirror owns that DOM while editing.
- Props stay JSON literals. Pages still refuse `import`, `export` and expressions.

### Theming

1. Tokens in the config: the shadcn variables, radius and fonts. No brand stylesheet.
2. React components: overridden defaults or new ones.
3. React layouts: header, footer, providers. Chosen per page with `layout` in front matter, defaulted in the config.

Tailwind is the styling tool. The build adds an `@source` for the project's component and layout folders.

### Libraries

- Keep `fumadocs-core` (loader, page tree, search, mdx plugins, front matter) and `fumadocs-mdx` (compile pipeline, runtime loader).
- Drop `fumadocs-ui`: the layout and components become ours, so they can be ejected. Tokens become plain shadcn variables with no `--color-fd-*` layer.
- Drop `fumadocs-openapi` and generated API references.
- Next.js stays. Vite is fine where it is already used (Storybook).

### The command line

The app doesn't need a terminal. `jotdown` (`scripts/jotdown.ts`) stays as developer tooling with three commands, and the app calls the same modules:

- `jotdown dev`: the site's dev server with `/_edit`
- `jotdown check`: the docs linter
- `jotdown add`

The old "open the local studio" behaviour and its update check go away.

## Ground rules

- **No compatibility with Noation's persisted formats.** There are no existing users: `.noation/` becomes `.jotdown/`, refs, keys and env vars are renamed or removed, and nothing migrates.
- **Delete first, build second.** Phases 1 and 2 only shrink and rename.
- **Every phase ends green:**
  - `bun run lint`, `bun run test` and `bun run check:links` pass.
  - The studio opens a folder project and a GitHub project and saves both: from `bun run dev` with `STUDIO_DEV_TOKEN=$(gh auth token)` until Phase 3, and from the app after it.
- One conventional commit per step. Stories are updated with the component they cover.
- The working rules in `AGENTS.md` apply. Phase 2 rewrites it for Jotdown.

## Phase 0: Repository and the app spike

### 0.1 Repository

- [x] Create `markomitranic/Jotdown`, push Noation's history and this plan. Squashed to one commit before going public.
- [x] Work from a fresh checkout of Jotdown, with no remote pointing at NoA. Run `bun install` and `git config core.hooksPath .githooks`.
- [x] Set `package.json` version to `0.1.0`. Don't carry Noation's tags.
- [x] CI:
  - Delete `.github/workflows/ai-pr-review.yml` and `ai-pr-chat.yml`, which use NoA's shared actions.
  - Delete `.github/workflows/chromatic.yml`, `apps/studio/chromatic.config.json` and the chromatic server in `.mcp.json` (NoA's Chromatic project). The `chromatic` dependency goes in 1.1 with `HandOver.tsx`, its only importer.
  - Keep `checks.yml`.
- [ ] Before the repo is ever made public, squash the history. It holds NoA's history and client data.

### 0.2 Spike: the current studio inside Electrobun

Prove the riskiest assumption before gutting anything. On a throwaway branch, wrap the studio as it is today:

1. A minimal `apps/desktop` Electrobun project with `mainProcess: "bun"`.
2. `next build` the studio as standalone, copy it into the app through `build.copy`, and start it from the main process with the bundled Bun, `STUDIO_LOCAL=1` and a token in the environment.
3. Open a window onto it.

Answer these, and write the answers into this plan:

- **Next on Bun.** Does Next 16's standalone server run on the Bun that Electrobun bundles? If not, bundle a Node binary and spawn the server with it.
- **The editor in WKWebView.** Typing, selection, undo, block drag and drop (dnd-kit), the slash menu, paste of rich text and images, tables, the whiteboard, and Mermaid. If any of these breaks in a way WebKit fixes can't cover, try `bundleCEF` before anything else.
- **Size and startup.** The DMG size, cold start to an interactive window, and idle memory.
- **Gatekeeper.** Does an unsigned build from a release open after "Open Anyway"? Can it apply an update?

**Done when:** each question has an answer, and the plan's fallback ladder says which step we are on.

#### Answers (2026-10-10, Electrobun 2.0.2, branch `spike/electrobun`)

We are on the first rung of the fallback ladder: Electrobun with WKWebView. Neither CEF nor Electron is needed.

- [x] **Next on Bun.** Next 16.3's standalone server runs on the Bun 1.4.0 that Electrobun bundles, with no Node binary. One catch: Electrobun's packaging stores a symlink as an empty file, which broke Sentry's Turbopack alias. The stage script copies the standalone output with symlinks dereferenced.
- [x] **The editor in WebKit.** Playwright's WebKit, driving the app's own server, passed all of these: typing, selection and bold, undo and redo, the slash menu, block drag (dnd-kit), rich-text paste, image paste with upload, table cells, Mermaid (the visual editor, Add node, Source), the whiteboard (draw, apply to page), and saving to a folder. The saved file held every edit. The script is `apps/desktop/spike/editor-matrix.ts` on the spike branch. The real WKWebView renders the editing page the same way.
- [ ] **Native input in the real window.** macOS blocks synthetic keystrokes without an Accessibility grant, so these need a hands-on pass in the app: Cmd+V from another app (rich text and a screenshot), a dead-key or IME character, dragging an image in from Finder, and spellcheck.
- [x] **Size and startup.**
  - DMG 55 MB. The update bundle is 53 MB, and a delta patch between two builds was 48 KB.
  - First launch, including self-extraction (about 3 s), to a healthy server: 5.0 s. Every later launch: 0.5 s.
  - Idle on the welcome page: the studio server 340 MB, the Bun main process 130 MB, and WebKit's content, GPU and network processes 140, 230 and 40 MB. The GPU figure is the animated sky.
- [x] **Updates.** An unsigned build applied an update from a static host: it fetched the patch, swapped itself in place and relaunched as the new version within a second.
- [ ] **Gatekeeper.** Electrobun only linker-signs the launcher, so `codesign --verify` fails on its bundles, and a downloaded app in that state is "damaged" with no Open Anyway. `postBuild` and `postWrap` hooks that ad-hoc sign the bundle make it verify. Still to see by hand: the Open Anyway flow on a DMG downloaded from a release.

What the spike taught for Phase 3:

- **Electrobun 2 is not an npm dependency.** It comes through the Hutch toolchain: `hutch electrobun build`, with the SDK projected into `.hutch/devkit`. The installer puts Hutch in `~/.hutch/bin` and adds it to `PATH` in `~/.zshrc`. `npx electrobun` bootstraps it.
- **Build hooks are modules,** imported without arguments, and read `ELECTROBUN_BUILD_DIR`, `ELECTROBUN_APP_NAME` and `ELECTROBUN_WRAPPER_BUNDLE_PATH` from the environment.
- **Nothing may write into the bundle.** Next writes its image cache to `.next/cache` inside the app, which breaks the signature and fails in a read-only `/Applications`. Next's optimizer is not used: a custom loader asks for WebP copies (`a.png.w960.webp`) that the studio scales with `Bun.Image` on request, caching nothing on disk. Electrobun's updater also rewrites `Resources/version.json` after an update. Gatekeeper doesn't recheck an updated app, so it still launches, but recheck this once builds are signed.
- **The server's output goes to `/dev/null`** in a launched app. Write it to a log file in the data folder, which the dead pages and bug reports need anyway.
- **A window opened behind the active app stays unpainted** (`document.hidden`) until it is shown. Launching from the Dock activates it.
- **`hiddenInset` puts the traffic lights over the sidebar's project header.** The title bar in 3.1 has to make room.
- **Two console errors are not WebKit's.** Vercel's analytics script fetched off Vercel, and a hydration mismatch (React #418) on every page. Both show in Chromium too, and 1.4 removes the analytics.

## Phase 1: Remove multiplayer, team and hosted features

**Done** (2026-10-10). Lint, tests and links pass, every Storybook play passes in Chromium, and a folder project edits and saves from `bun run dev` with all eleven editor checks from 0.2. A GitHub project opens and is editable; a GitHub save is not verified yet, since it needs a repository to commit to. Where the work went past or around the steps below:

- **1.1:** "Two people, one file" in `browser-editor.mdx` became "The file can change under you", since the sha check it explains still guards against agents and other machines.
- **1.3:** `app-token.ts` went with the hosted sign-in, and the `api/blobs` route reads GitHub with the local token. Link previews no longer refuse private addresses, which only mattered for a hosted server. Uploads have one limit, 25 MB, instead of a Vercel one and a local one. The studio serves one placeholder icon set from `public/icon.png`, `favicon.png` and `apple-icon.png`. `apps/publication/public/studio-icon.png` went with the Edit in Studio card that drew it.
- **1.4:** both console errors from 0.2, the analytics script and the hydration mismatch, are gone.
- **1.5:** `committed` on page data went too: it was false only for generated API pages, so the History tab and the local path now always show.
- **1.6:** the v2 upgrade also took the `public/` fallback for uploads with it, so an upload is only ever a file of the uploads folder.

### 1.1 Edit locks ("holds")

Delete:

- `apps/studio/src/plugins/live-edit/inplace/{hold.ts, hold-context.tsx, gates.tsx, HandOver.tsx}`
- `apps/studio/src/plugins/live-edit/client/Gate.tsx`
- `apps/studio/server/live-edit/lock.ts`, `apps/studio/server/storage/github/lock.test.ts`
- `packages/core/lib/since.ts` and `since.test.ts`, once comments are gone too
- `docs/how-it-works/edit-locks.mdx`

Surgery:

- `storage/github/editing.ts`: about 830 lines of lock code (`writeBlob`, `createRef`, `pointRef`, `readLockAt`, `parseLock`, `sameHolder`, `Claim`, the `refs/live-edit-locks/*` refs). Keep `readRefTarget`, `refUrls` and `describeLockFailure`, which `readBranchHead` uses.
- The 7 lock methods in `storage/{types.ts, index.ts, github/index.ts, disk/index.ts, disk/editing.ts}`.
- `server/live-edit/_contract.ts` (`STRUCTURE_LOCK`, `parseLockPath`, `LOCK_TTL_MS`, `expiresAtOf`, lock types, the `holder` option of `parsePerson`).
- `server/live-edit/save.ts` (`saveIsPermitted`, `mustHold`, `force`) and `structure.ts` (`arrangeIsPermitted`, `deletionsAreFree`). Remove the client and server sides together, or every GitHub sidebar commit gets a 423.
- The `lock` handler and the `PATCH`/`DELETE` exports in `app/api/projects/[id]/live-edit/[action]/route.ts`.
- Lock types in `src/plugins/live-edit/types.ts`; lock calls in `client/api.ts`.
- `inplace/session.ts`: hold and ask/take/decline flows, 423 handling, the `refused` state. Keep the 409 stale handling.
- `inplace/face.ts` and `face.test.ts`: drop `Hold`, so every project goes straight to Save as folder projects do today.
- `inplace/Toolbar.tsx`: `HoldGates`, matching `act()` cases, "Sign in as someone else".
- `inplace/context.tsx`: replace `PageHoldProvider`, and move the `drawing` state that `Toolbar.tsx` and the whiteboard need.
- `whiteboard/Workspace.tsx` (claims the page before drawing), `history/HistoryPanel.tsx:107`, `structure/useStructure.tsx` (sidebar lock and timers), `structure/StructureBar.tsx` (the "blocked" panel).
- Storybook: the `held`, `asked`, `declined` scenarios and `/lock` handlers in `.storybook/studio-api.ts`. In `components/live-edit/stories/Saving.stories.tsx`, delete the colleague stories and fix `claimAndSave`.
- `server/live-edit/_whiteboard-save.test.ts`.

Not multiplayer, keep: `inplace/roster.ts` (caret between blocks), `seats.ts` (per-editor undo), `solo.ts`, `still.ts`, `client/Banner.tsx` (drop only its unused `Action` and `Row`), `client/identity.ts` (the commit author).

### 1.2 Comments

Delete:

- `apps/studio/app/-/comments/*`, `apps/studio/app/api/comments/[id]/route.ts`, `apps/studio/server/comments/store.ts`
- `apps/studio/components/studio/CommentsInbox{.tsx,.stories.tsx}`, `apps/studio/stories/comments/*`, `apps/studio/.storybook/comments.ts`
- `apps/publication/server/comments.ts`
- `packages/core/components/comments/*`, `packages/core/lib/comments{.ts,.test.ts}`
- `docs/how-it-works/comments.mdx`, `docs/studio/add-ons/comments.mdx`, `docs/decision-records/0019-comments-in-a-hidden-ref.mdx`

Surgery:

- Core: `ReadingArticle.tsx` (`PageComments`, `CommentsButton`, comments tab), `PageDrawer.tsx` (`commentsHost`), `PageContent.tsx` (`data-comments-root`, also used by `.storybook/select.ts`), `shortcuts.tsx` (`SHORTCUTS.comment`), the `::highlight(pb-comment*)` rules in `css/custom.css`, and `comments` in `server/config.ts`.
- Studio: `components/live-edit/Article.tsx`, `StudioDrawer.tsx` (Comments tab), `inplace/SelectionMenu.tsx` (Comment button), `StudioTools.tsx` (`CommentsTool`), `Workspace.tsx`, `app/layout.tsx`, `app/[[...slug]]/page.tsx`, the `COMMENTS` exceptions in `proxy.ts`, and `comments: false` in `storage/disk/projects.ts`.
- `apps/publication/app/[[...slug]]/page.tsx`, and the comments handlers in `.storybook/{studio-api.ts, page.tsx}`.

Keep for now: `apps/studio/server/comments/app-token.ts`, because the `api/blobs` route uses it to serve GitHub uploads to Next's image optimizer. 1.3 replaces it with the user's token.

### 1.3 The hosted studio, sign-in and org installs

The studio becomes local only. `STUDIO_LOCAL` stops being a switch, because local is the only mode.

- **Hosted sign-in:**
  - Delete `server/auth/{login,callback,github}.ts`, `app/api/auth/{login,callback,logout}`, the session sealing and cookies in `server/auth/session.ts` (keep the `Session`/`Editor` types and `developmentSession`) and `session.test.ts`.
  - In `proxy.ts`, delete the sign-in redirect and token refresh. Delete the sign-in and sign-out UI in `welcome/Welcome.tsx` and `useSignInUrl` in `Toolbar.tsx`.
  - About 15 callers of `openSession`/`currentSession` switch to the local session.
- **Hosting:** delete `apps/studio/vercel.json` and `docs/how-it-works/hosting-the-studio.mdx`. In `env.ts`, delete the `hosted` switch.
- **Env vars to remove:** `SESSION_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG`.
- **`app-token.ts`:** the `api/blobs` route reads GitHub with the local token instead. Delete the file.
- **Storage router:** `storage/index.ts` always exports the local router (`localStudioStorage`). Delete the `githubStorage`-only branch.
- **GitHub App installation flow:**
  - Delete `appInstallUrl()` and the `installUrl` prop chain: `app/layout.tsx`, `app/[[...slug]]/page.tsx`, `app/api/projects/route.ts`, `components/studio/{Workspace, ProjectPalette, OpeningProject, projects.ts}`, `welcome/{Welcome, ProjectPicker}` and `setup/{SetupDialog, SetupWizard, TargetStep}`.
  - Delete `setup/InstallGitHubApp.tsx`, the `installation_id` handling, `RepositoryUnseen` in `storage/types.ts`, the App wording in `unseenRepository`, and the `/user/installations` branch of `reachableRepositories` in `storage/github/projects.ts`.
- **Pinned projects:** delete `server/projects/pinned.ts` and the pinned UI in `ProjectPalette.tsx`.
- **The PWA (the app replaces it):**
  - Delete `components/studio/install/{InstallApp.tsx, store.ts}`, `app/manifest.webmanifest/route.ts`, `lib/studio-flavour.ts`, `scripts/make-icons.ts`, `apps/studio/public/icons/*` and their uses in `StudioShell`, `ProjectPalette`, `Workspace` and `ProjectPicker`.
  - Keep `components/WindowTitleBar.tsx` for Phase 3, where it becomes the app's title bar.
  - Keep `apps/studio/assets/icons/*` as the source for a placeholder app icon.
- **Publication passwords:**
  - Delete `apps/publication/proxy.ts` and `apps/publication/server/readers{.ts,.test.ts}`. Remove `AUTH_PROVIDER` and `AUTH_CONFIG` from `apps/publication/env.ts`.
  - Delete `docs/publication/protecting.mdx` and ADRs 0009 and 0013.
- **The "Edit in Studio" card on publications:** delete `apps/publication/components/EditInStudio.tsx`, `server/studio.ts`, the layout hook and `NOATION_STUDIO_URL`. A `jotdown://` link replaces it in Phase 7.
- **`StudioDrawer.tsx` Share tab:** drop the "Editors with repository access" and "Repository members" links. Keep the page link and the local file path.
- **Keep in `apps/studio/proxy.ts`:** project mounting, `uploadFromReferer`, the `crossSiteWrite` CSRF guard and the `/api/blobs/` path.

### 1.4 Hosted extras

- **New-deployment detection:**
  - Delete `useStudioUpdate`, `components/studio/StudioUpdated.tsx`, `app/api/deployment/route.ts` and `UpdateButton` in `StudioTools.tsx`.
  - Remove the `deployment` field from the version route and the `redeployed` check from `BranchWatch`.
  - Remove `STUDIO_DEPLOYMENT` and `VERCEL_DEPLOYMENT_ID`.
- **Vercel Analytics and Speed Insights:** `app/layout.tsx` and the `@vercel/analytics` and `@vercel/speed-insights` dependencies.
- **Sentry:** `instrumentation.ts`, `instrumentation-client.ts`, `lib/sentry.ts`, the Sentry parts of `app/global-error.tsx`, `withSentryConfig`, `Sentry.setUser` and the `SENTRY_*` env vars.
- **Keep:** `useStudioPulse`, `BranchWatch`, the version route and the 409 stale handling.

### 1.5 OpenAPI and generated references

- Delete the `fumadocs-openapi` dependency and its CSS import, `openapi/`, `docs/examples/openapi`, `docs/examples/typedoc` (generated from a client's code), `blocks/OpenAPIPage.tsx`, `lib/openapi.ts`, `fixtures/generated-reference.md`, `docs/studio/add-ons/api-references.mdx` and ADR 0007.
- In `server/content.ts`: `generatedAPIFiles`, `generatedSection`, `openapiPlugin` and `MISSING_ICON`. Remove `openapi` from the config schema and `pageBindings`.
- Keep the generic `generated: true` front matter flag and its write refusal (`server/live-edit/_generated.ts`).

### 1.6 Setup wizard

- Remove the pull-request option (`lib/setup.ts`, the PR code in `server/setup/github.ts`, the matching parts of `ReviewStep.tsx` and `DoneStep.tsx`).
- Remove the v2 migration (`V2_MARKER` and `playbook.config.ts` handling in `server/setup/{content,disk,github}.ts`, `docs/how-it-works/migrating-from-v2.mdx`).
- Keep config, skills and `AGENTS.md` writing. The publishing choice stays until Phase 5 replaces it.

### 1.7 Docs for removed features

- **Remove sections:**
  - "Two people, one file" in `how-it-works/browser-editor.mdx`
  - "When somebody else has the page" and the Comment toolbar item in `editing.mdx`
  - lock mentions in `whiteboards.mdx` and `how-it-works/index.mdx`
  - the "Behind a password" section of `context-warehouse/reading-over-http.mdx`
  - the hosted, comment and lock asides in `studio/local-studio.mdx` and `context-warehouse/reviewing-agent-pages.mdx`
- **Fix links** from `technical-introduction.mdx`, `environment-variables.mdx` and `publication/{publishing,vercel,self-hosted}.mdx`.
- **Update** `docs/moved.json` and the `pages` lists in the affected `meta.json` files.

## Phase 2: Rename to Jotdown, remove NoA and clients

**Done** (2026-10-10). The 2.7 grep finds nothing. Lint, tests and links pass, and the editor checks from 0.2 pass against a folder project. Notes:

- **2.1:** `JOTDOWN_TOKEN` was in while the repository was private, and went when it went public on 2026-10-11. The deployment templates clone `markomitranic/Jotdown` at `main` unless a project pins a tag, and the setup wizard no longer writes a version pin, since Jotdown has no release tags yet. Folder bookmarks moved to `~/.config/jotdown/folders.json`, so the old list does not carry over.
- **2.2:** the default is shadcn's zinc neutrals with its chart palette, Inter for everything read and JetBrains Mono for code; `font-serif` is the system serif. The setup wizard's first palette is Neutral. The setup screenshots and the orphaned images are deleted. `publication-token.png` went in 2.1 with the token step it illustrated.
- **2.3:** `noa/handbook` and `noa/web` placeholders are `you/notes` and `you/site`, and stories that need several organisations use `acme`.
- **2.6:** besides the listed pages, every page under `how-it-works/`, `context-warehouse/`, `studio/` and `publication/` was swept, `local-studio.mdx` is now "Running the studio", and `moved.json` keeps only entries with a live target.

### 2.1 Mechanical rename, one commit per bullet

- **Packages:** `@noation/*` becomes `@jotdown/*`. That covers 527 imports in 251 files, the workspace package names, `packages/core/components.json` aliases, `transpilePackages` in both `next.config.ts`, the vitest configs and the `--filter` in `build.sh` and root `package.json`. Regenerate `bun.lock`.
- **CLI:** `scripts/noation.ts` becomes `scripts/jotdown.ts` with bin `jotdown`.
  - Drop its "open the local studio" mode, the studio build cache in `~/.cache/noation` and the update check.
  - Keep `check`; Phase 5 adds `dev` and `build`, Phase 6 `add`.
  - Update `t3.json`: drop the "Local Studio" script; "Dev Server" stays.
- **Project folder:** `.noation/` becomes `.jotdown/` and the config field `noation` (the pinned framework version) becomes `jotdown`. This covers `CONFIG_FILE`, this repo's own config, the deployment templates, setup plan files, the GraphQL `HEAD:.jotdown/config.json` lookups and every message naming the path. Rename ADR 0020's file to `0020-one-folder-for-jotdown.mdx`.
- **Env vars:** `NOATION_TOKEN` becomes `JOTDOWN_TOKEN` (and the docker secret id) only while the repo is private. Deleted when Jotdown went public.
- **Text written into repos:** "Edited in Jotdown." (`inplace/session.ts`), "Fixed in Jotdown." (`FixJsonFile.tsx`, `FrontmatterForm.tsx`), and the `AGENTS.md` note in `server/setup/plan.ts`.
- **Identifiers:**
  - the clipboard marker `data-jotdown-blocks`
  - the icon sentinels `jotdown:broken`
  - the user agent `JotdownBot` in `server/link-preview.ts`
  - temp-dir prefixes in tests
  - the `@noation/cli` sample in `inplace/previews.tsx`
- **UI strings:**
  - `welcome/Welcome.tsx` (including "The documentation studio of NoA Ignite")
  - `setup/WizardFrame.tsx`, `DoneStep.tsx` (`MANUAL`) and `Steps.tsx` manual links
  - messages in `FolderBrowser`, `OpeningProject`, `ProjectPalette`, `NoDocsYet`, `StudioDrawer`, `server/setup/*`, `server/storage/*` and `packages/lint/lint.ts`
  - the Storybook title
- **The `pb-` prefix** (from NoA's earlier "playbook" product) becomes `jd-`:
  - `--pb-*` tokens: 1,904 uses in 45 files
  - `pb-` classes: 515 uses in 87 files
  - `PbFigure`, `remarkPbFigure`
  - the `pb-fig` markup in docs, stories and skills

### 2.2 Company assets

- Delete `packages/core/fonts/NoaGrotesk2.0-Medium.woff2`, `NoaSerif2.0-Bold.woff2` and `NoaSerif2.0-Regular.woff2`, and their `@font-face` rules. Inter and JetBrains Mono (OFL) stay.
- Replace the NoA palette (magenta, volt, silver) in `packages/core/css/brand.css` with a neutral default. Do the same for the `noa` entry and default in `apps/studio/lib/setup.ts`, `SetupWizard.tsx`, `server/setup/plan.ts`, `LookStep.tsx` and `plan.test.ts`, for `DEFAULTS` in `.agents/skills/figure/scripts/render.ts`, and in `packages/core/lib/theme.test.ts`.
- Fix the comment in `docs/_uploads/brand.css`. Phase 4 removes brand stylesheets altogether.
- The mascot icons were made for NoA's product: `docs/_uploads/icon.png`, `apps/studio/assets/icons/*`, `apps/publication/public/studio-icon.png`. They stay as placeholders until a Jotdown icon exists (see open questions).
- **Screenshots:**
  - Delete the orphans in `docs/_uploads/img/docs/` (`db30b464ea4baa51.png`, `7d343a4ca7a1ba32.jpg`, `d1bd94efbc3a67c9.png`) and `publication-token.png`.
  - The five `setup-wizard-*.webp` show NoA repos. Delete them now and retake them after Phase 3.

### 2.3 Client content

- **Changelog examples:** replace `docs/examples/changelog/{v0,v1,v2}.md` and its `meta.json` with a short synthetic changelog, so the changelog block keeps test content. Remove the Jira links in `src/plugins/live-edit/fixtures/changelog.md` and the comment at `blocks/changelog/Timeline.tsx:28`.
- **Telenor:**
  - the checkout diagram in `docs/how-it-works/mermaid-diagrams.mdx` (replace with a neutral one)
  - the CFIT fixtures and `Evolution.woff2` in `server/setup/content.test.ts`
  - "CSG Ascendon" in `structure/ArrangeTree.stories.tsx`
  - the argocd host in `.agents/skills/authoring/SKILL.md`
- **Kemp & Lauritzen:** `docs/examples/every-block.mdx:208`, `apps/studio/stories/blocks/Image.mdx:16`, `stories/ui/section-switcher.stories.tsx:44`, `blocks/MissingImage.tsx:12`, `inplace/pastedImages.ts:28`.
- **Fixtures:**
  - Story fixtures with NoA orgs and repos: the `ProjectPalette`, `SetupWizard`, `OpeningProject`, `StudioState` and `Broken` stories.
  - Emails: `ada@noaignite.com` and `ada@noa.dk` become `ada@example.com` (`storage/github/commit.test.ts`, `server/local.ts`, `storage/github/editing.ts`).
  - About 120 `noa/handbook`-style placeholders in tests and JSDoc examples become neutral ones such as `you/notes`. Start with `lib/project-key{.ts,.test.ts}`, `lib/project-base{.tsx,.test.ts}`, `lib/paths.test.ts`, `storage/github/projects.ts`, `server/setup/github.ts`, `proxy.ts` and `search/browser-index.ts`.
- **"Client" copy:** `setup/Steps.tsx:283,421,422`, `stories/ui/{item,questionnaire}.stories.tsx`, `apps/publication/app/robots.ts:3`, and the "playbook" fixture titles.

### 2.4 Root files and tooling

- Rewrite `README.md` (what Jotdown is, how to run it, a link to this plan) and `AGENTS.md` (Jotdown's lenses: the app, the site, context for agents; no clients).
- Delete `TODO.md`. It was NoA's task board; anything still relevant is in Phase 7.
- Update `package.json` `repository` and the `.versionrc.cjs` header (dropping its stale v2 text). Reset `docs/how-it-works/changelog.md` to an empty Jotdown changelog.

### 2.5 Skills

- Delete `.agents/skills/confluence-import`, its listing in `docs/context-warehouse/connecting-agents.mdx`, and re-run `scripts/link-skills.ts`. `.claude/skills` holds per-file symlinks.
- `authoring/SKILL.md`: the 7 links into `noation.vercel.app`, the `noa/handbook` example, "keeps the NoA default", the install command, the client wording.
- `blocks/SKILL.md`, `editorial-illustration/SKILL.md` and `figure/scripts/render.ts`: the config path.

### 2.6 Docs

- **Delete** (NoA-specific): `decision-records/how-we-write-adrs.mdx`, `rfc-structure.mdx`, `0005`, `0010`, `0011`, `0012` and `0015`. Phase 5 writes the new architecture's ADRs.
- **Rewrite** for Jotdown, single user, no clients:
  - `index.mdx`, `technical-introduction.mdx`
  - `how-it-works/`: `configuration.mdx`, `environment-variables.mdx`, `cli.mdx`, `sections.mdx`, `editing.mdx`, `whiteboards.mdx`, `browser-editor.mdx`
  - `studio/`: `setting-up-a-project.mdx`, `local-studio.mdx` (becomes the app's page in Phase 3), `branding.mdx`
  - `publication/`: `publishing.mdx`, `vercel.mdx`, `self-hosted.mdx`
  - `context-warehouse/`: `connecting-agents.mdx`, `reading-over-http.mdx`, `reviewing-agent-pages.mdx`
  - `examples/index.mdx`, `every-block.mdx`
  - ADRs `0006`, `0014`, `0016`, `0017`, `0018`, `0020`
- Drop stale entries from `docs/moved.json`.

### 2.7 Acceptance

`git grep -n -i -E "noation|noa[- ]?ignite|noaignite|\bnoa\b|telenor|kemp|lauritzen|dansk|acarix|tivoli|north ?alliance|atlassian|confluence|playbook|cfit|public-bff"` returns nothing. Review `git grep -n -i client` by hand; "client component" and the like are fine.

## Phase 3: The single-user studio in the app

The trimmed studio becomes the Skinny renderer over both adapters, inside the app, usable every day.

### 3.1 The app, `apps/desktop`

- Build on the Phase 0 spike: Electrobun 2.x with `mainProcess: "bun"`. A `preBuild` script runs the studio's standalone `next build` and stages `.next/standalone`, `.next/static` and `public` with symlinks dereferenced, and `build.copy` brings the staged folder into the app. `postBuild` and `postWrap` ad-hoc sign the bundles.
- Keep every write out of the bundle: no image optimizer cache (the studio scales copies on request without one), and the server's log in the data folder.
- **Launch:**
  1. Start the server on a random `127.0.0.1` port, with `DOCS_DATA_DIR` set to the app's data folder.
  2. Wait for `/api/health`.
  3. Open the window at a launch URL that carries the per-launch secret.
- **Server-side guards:** trade the secret for a `SameSite=Strict`, `HttpOnly` cookie, refuse any request without it, and refuse any `Host` that isn't `127.0.0.1` or `localhost`. Keep the cross-site write guard.
- **Window:** `titleBarStyle: "hiddenInset"`. `WindowTitleBar.tsx`, built for the PWA's window controls overlay, becomes the inset title bar. Links to other sites open in the default browser.
- **Lifecycle:** quitting stops the server and every child process.
- **Icon:** a placeholder `.iconset` from `apps/studio/assets/icons` until a Jotdown icon exists.

### 3.2 Sign-in

- Register a GitHub OAuth app under your account with the device flow enabled. Its client ID is public and ships in the app; there is no secret.
- The studio server runs the device flow (start, then poll) and keeps the token in the Keychain with `Bun.secrets`. A small settings panel shows who is signed in, with sign-out.
- `STUDIO_DEV_TOKEN` stays for `bun run dev`.
- Starting points: the device-flow handlers in `desktop/main.cjs` at `4023e01^`.

### 3.3 Storage

- Route by an explicit source, `{ kind: "github", owner, repo } | { kind: "folder", path }`, instead of the `local/` owner prefix. The prefix is also checked in `lib/live-edit/config.ts`, `components/studio/update.ts` and `brokenConfig` in `app/[[...slug]]/page.tsx`.
- Make the setup wizard go through the adapters instead of `server/setup/{disk,github}.ts` reaching into their internals.
- Replace the AsyncLocalStorage pinning (`github/context.ts`) with an explicit project handle if it gets in the way, not before.

### 3.4 Project menu

- **Favorites:** one file in the app's data folder. It replaces both `studio-saved-projects` in browser storage and `~/.config/noation/folders.json`. Renderer choices and custom URLs go in the same place.
- **The Add dialog,** with the three sources:
  - GitHub discovery: `/user/repos` plus the batched GraphQL config lookup.
  - `owner/repo` or a GitHub URL.
  - A local folder: the native folder picker through Electrobun's file dialog, called over RPC. `FolderBrowser.tsx` stays for `bun run dev`.

### 3.5 Config schema

- Remove `comments` and `openapi`. `brand` goes in Phase 4.
- Rename `publicUrl` to `url`, the site's address; the canvas is `<url>/_edit`.
- Reset `version` to `1`.

### 3.6 Distribution

- A workflow on a version tag builds the DMG on a macOS arm64 runner and attaches it to a GitHub release.
- It publishes the updater artifacts (`update.json`, the bundle and the patches) to the static host at `release.baseUrl`.
- The app checks for an update on launch and offers it. It applies the update only after confirming nothing is unsaved.
- **Ad-hoc signed first.** Signing and notarization wait for an Apple Developer ID.
- **Run the editor's Storybook interaction tests on WebKit as well as Chromium** (Playwright's `webkit` project), so WebKit regressions show up in CI.
  - A first pass (2026-10-10) of all 118 plays in Playwright's WebKit: 109 pass. One looks real: `Blocks/Text` Turn into opens its menu with a click and expects ArrowDown to move, and WebKit does not focus a clicked button. The rest are the harness: the deliberately broken `example.invalid` image and the `down` scenario's error response surface as page errors in WebKit, and `Editor/Saving` Changed is flaky on a cold start in both engines.

### 3.7 Docs

`local-studio.mdx` becomes the app's page: download, Open Anyway, sign in, add projects. Update `setting-up-a-project.mdx` and retake the setup wizard screenshots in the app.

**Milestone A:** the app in the Dock opens favorites from all three sources and edits them, in Skinny mode.

#### Done (2026-10-10)

- **3.1** `apps/desktop` builds a signed-ad-hoc app and a dmgbuild DMG with `bun run build`. The port is kept per install in `<data>/port` rather than random, so nothing tied to the origin is lost between launches. Links to other sites leave through `navigationRules` and `will-navigate`.
- **3.2** The device flow runs in the studio's server (`server/auth/device.ts`) and the token lives in the Keychain (`server/auth/token.ts`). It signs in through GitHub CLI's public OAuth client ID for now, so GitHub's consent screen says "GitHub CLI"; registering a Jotdown OAuth app only swaps `CLIENT_ID`. The account and sign-out sit in the welcome page's corner and the switcher's footer.
- **3.3** Kept the `local/` prefix as the address of a folder: `favorites.json` records where each folder is, which is the explicit source. The setup wizard and the AsyncLocalStorage pinning stay as they are until they get in the way.
- **3.4** `favorites.json` in the data folder holds GitHub favorites and folders; browser storage keeps only a cache of the last answer. Inside the app, **Add a local project** opens the native picker through the app's bridge.
- **3.5** `publicUrl` is `url` and `version` is `1`.
- **3.6** A `v*` tag runs `.github/workflows/release.yml`, which builds the DMG on `macos-15` and attaches it to a release. The release also carries the Electrobun Updater's `update.json` and `tar.zst`, read from `releases/latest/download` once the repository is public. The app checks every ten minutes, downloads in the background, and the welcome page and the switcher offer the restart. Every story's play runs in Chromium and WebKit in CI (`bun run test:stories`). Turn into is skipped in WebKit: a scripted click there neither opens a Radix menu nor keeps the selection, while a real click does both.
- **3.7** `local-studio.mdx` is now "Installing the app". The setup wizard screenshots still show the browser studio.

## Phase 4: Own the UI layer

No more `fumadocs-ui`, so every default is ours to eject in Phase 6. The survey counted 58 `fumadocs-ui` imports.

### 4.1 Tokens

- Tailwind `@theme inline` maps the shadcn variables directly. Remove the `fumadocs-ui/css/*` imports.
- Codemod the classes: `bg-fd-card` to `bg-card`, `text-fd-muted-foreground` to `text-muted-foreground`, `border-fd-border` to `border-border`, `text-fd-primary` to `text-primary`, `text-fd-error` to `text-destructive`, and the rest by the same rule.
- Point the `--jd-*` aliases at shadcn variables.
- Replace the `#nd-*` selectors in `brand.css` and the `--fd-*` layout variables in `custom.css` with our own.

### 4.2 Theme is tokens only

- Remove the brand stylesheet: the `brand` config field, `readBrand`, the `<link>` in `ProjectStyles`, the brand path through `/api/project-assets`, and this repo's `docs/_uploads/brand.css`.
- Fonts become theme tokens (a family plus an uploaded file). Decide the exact shape here.

### 4.3 Components

- Own versions of Callout, Card and Cards, Accordion and Accordions, Files, Steps, Tabs, CodeBlock and Pre, and Heading. Drop TypeTable.
- Start from `fumadocs-ui`'s MIT source where it is good and keep its license notice.
- Write each one so Phase 6 can eject it unchanged.

### 4.4 Layout

- Own `DocsLayout` (sidebar, TOC, page header, footer), a `RootProvider` replacement (theme switch, search dialog, hotkeys) and the prose typography.
- Move `ReadingSidebar`, `ArrangeableSidebar` and `SectionSwitcher` onto our sidebar primitives. `structure/queue.ts` keeps `PageTree.Node` from `fumadocs-core`.

### 4.5 Editor

- Update the editor's `Within` handlers, which relied on the Fumadocs heading and callout DOM.
- Remove the `fumadocs-ui` dependency and its inline entries in the vitest configs.

**Done when:** no `fumadocs-ui` import remains, and the Storybook block stories match before-and-after screenshots in both colour modes.

#### Done (2026-10-10)

- The layout (`packages/core/components/docs`: tree, sidebar, page, table of contents, search, root provider) and the blocks (`Callout`, `Cards`, `Accordions`, `Files`, `Steps`, `Tabs`, `CodeBlock` with its tabs, `Heading`) are ported from Fumadocs UI's MIT source, with its notice in `components/docs/LICENSE`. They keep the markup, so the editor's handlers needed nothing beyond their comments. `TypeTable` is gone.
- `ui.css` makes the shadcn variables into Tailwind colours (`bg-card`, `text-destructive`) and holds the animations, the base colours, the `jd-steps` and `jd-scroll-container` utilities, the `layout` variant and the code highlighting. `prose.css` is the typography, generated once from `@fumadocs/tailwind`'s plugin and committed, in the `components` layer so a component's utilities always win. Ids and layout variables are `#jd-*` and `--jd-*`.
- Every one of the 242 story screenshots was compared before and after in both modes. The differences left are the changelog's spacing, now written into the component instead of borrowed from a cascade accident, and runs where an image, video or highlighter had not finished.
- 4.2: the theme is tokens only. `brand` is gone from the config and the readers, and `theme.fonts` names the `sans`, `serif` and `mono` faces, each a family and an optional uploaded file, which the stylesheet loads under the project's base.

## Phase 5: Site build and the canvas

### 5.1 Static publication

Reversed on 2026-10-24 by ADR 0027: a site is a Next.js app on Vercel. The list below is the original plan.

- Change the publication to `output: "export"`. Drop the standalone server, the Vercel adapter (`@next-community/adapter-vercel`, `@vercel/build-utils`) and the Docker templates.
- **Make every route static:**
  - uploads, `img`, `files` and `whiteboards` through `generateStaticParams`
  - markdown twins and `llms.txt`
  - search as a static index built at build time instead of `api/search`
  - moved pages as static redirect pages
  - delete `api/health`
- **`jotdown build`:** clone the framework at the pinned `jotdown` version into `.jotdown/framework` (gitignored), inject the project and build to `out/`.
- **Deployment templates:** a GitHub Pages workflow and a Vercel static config. The setup wizard's publishing choice writes these.
- **Check that every block renders in the export.** `LinkEmbed` already stores its data in the tag.

### 5.2 Rendering a page in the browser

A browser-only render path from markdown text:

- Compile with `@mdx-js/mdx` `compile` and `run`, using the core remark chain from `source.config.ts`.
- Replace `remarkRuntimePositions`, which reads disk, with front-matter padding as `packages/core/lib/source-range.test.tsx` does.
- Run `executableContent` before `run`.
- Highlight with Shiki in the browser, lazily.
- Remove or shim `next/image`, `next/link` and `next/navigation` in core components: `DocImage`, `SiteLink`, `PageActions`, `ProjectSearch`, `OptimisticPathname`, `SidebarOffer`, `whiteboard/Preview`.
- Supply what `pageBindings` binds today (relative links, page tree, uploads map, TOC) as data.

Starting points: Storybook's `PageStory` and `inplace/DraftArticle.tsx`.

### 5.3 The protocol

A typed, zod-validated, versioned message set in core:

| Message | Direction | Carries |
|---|---|---|
| `hello` | canvas to studio | protocol version, framework version, project identity |
| `load` | studio to canvas | path, text, page tree, theme, uploads map |
| `changed` | canvas to studio | new page text, or structure ops |
| `upload` | canvas to studio | a file in, an address out |
| `navigate` | both ways | the page to show |
| `shortcut` | canvas to studio | a key combination |
| `theme` | studio to canvas | the colour mode |
| `reading` | studio to canvas | the page drawn for readers, with the editor off |

- The editor's `client/api.ts` gets a `postMessage` transport. The studio forwards to the existing live-edit endpoints, so storage code doesn't change.
- Origins are checked as described in the target design.

### 5.4 `/_edit` in the site build

- A client-only route: the site's layout, theme and components plus the editor runtime, with no content. `noindex`.
- The editor overlays (handles, slash menu, toolbars, popovers) move into a shadow root.

### 5.5 Renderers in the studio

- The renderer toggle (Site, Custom URL, Skinny), with the defaults and per-project memory from the target design.
- The handshake with a timeout, and the dead pages with fix steps and "Open in Skinny".

### 5.6 Site dev servers

- `jotdown dev` in a project folder runs the site's dev server with `/_edit`, using the same injection as `jotdown build`.
- **The app runs the same module for folder projects** when Custom URL points at `localhost`:
  - It looks up `bun` through your login shell (`$SHELL -lc`), since a Dock app has no shell `PATH`.
  - It picks a free port.
  - It stops the server after a stretch of inactivity, and on quit.
  - It keeps the last log lines for the dead page.

### 5.7 ADRs

Record the decisions in this plan as Jotdown ADRs:

- a single user and the desktop app
- storage adapters
- renderers and the canvas protocol
- content at runtime, code at build time
- the static publication

**Milestone B:** a GitHub project edited through its deployed site's `/_edit`, and a folder project edited through a dev server the app started.

#### Done (2026-10-11)

- **5.1, reversed (2026-10-24, ADR 0027).** A site is a Next.js app on Vercel again, built through `@next-community/adapter-vercel` into `.jotdown/.vercel/output`. Pictures go through Next's image optimizer, moved pages are `redirects` in `next.config.ts`, and the base path, `assetBase`, the empty `_none` upload, `jotdown build`, `.jotdown/out` and the GitHub Pages template are gone. Pages, markdown twins, `llms.txt` and the search sections are still written at build time through `generateStaticParams`. Uploads are copied into the app's `public/` folder by `project-uploads.ts`, because Vercel's image optimizer only scales a site's own static files, never a prerendered route's response, and immutable static assets are off, since Vercel refuses to inject its toolbar into them on a site with no framework preset. What follows is the original 5.1, kept for history.
- **5.1** The publication is `output: "export"` into `.jotdown/out`. Uploads, markdown twins, `llms.txt` and the search sections are written by their routes' `generateStaticParams` (an upload folder with no files writes one empty `_none`, since an export refuses a route with no paths). Moved pages are forwarding pages with a meta refresh. A site below a domain's root takes the path from the config's `url` as Next's `basePath`, and `Project.assetBase` carries it into every file address the browser fetches itself. `jotdown build <folder>` and `jotdown dev <folder>` point a checkout at any project through `JOTDOWN_PROJECT`. The templates are `deployment/github-pages` and `deployment/vercel`, and the setup wizard offers GitHub Pages in place of Docker.
- **5.2** `packages/core/lib/browser-page.ts` compiles a page's text in the browser with the shared `lib/remark-chain.ts` and the same defaults `fumadocs-mdx` adds, refusing code first. Front matter becomes blank lines, so `remarkRuntimePositions` is not needed there.
- **5.3** `packages/core/lib/canvas.ts`. The plan's `changed` and `upload` became one generic `request`/`response` pair: the editor's API client sends every call through a transport, which in a canvas posts it to the studio, and the studio answers from its own endpoints. Storage code did not change.
- **5.4** The editor moved into `packages/editor` (`@jotdown/editor`) so a site build can carry it. `/_edit` mounts `Canvas`, which draws the loaded page in the site's own shell with the arranging sidebar. Overlays are not in a shadow root yet; the site's CSS and the editor's are both the framework's today, and Phase 6 is where a project's own CSS arrives.
- **5.5** The renderer menu sits in the status strip along the foot of the window, the studio's own chrome in every renderer: the project, its branch, reload, VS Code for a folder, the renderer and settings. A framed canvas is told it is in the app, lays itself out under the traffic lights as Skinny does, and hands presses on its title bar up for the app to move the window. `CanvasFrame` checks the hello, forwards only live-edit and link-preview requests, and draws dead pages for unreachable, not a canvas, too old, too new and wrong project.
- **5.6** For a folder, the renderer menu offers Dev server: the studio runs the site's `next dev` from its own checkout, or from a clone in `.jotdown/framework` at the pinned version inside the app, finds `bun` and `git` through the login shell, stops it after 15 idle minutes and on exit, and shows its log while it starts or when it fails.
- **5.7** ADRs 0021 to 0025.
- A new upload shows in a site canvas only after the next deploy.

## Phase 6: Project code

### 6.1 Project code layout

- `.jotdown/components/*.tsx` holds blocks, registered by export name. `.jotdown/layouts/*.tsx` holds layouts.
- Both are injected at build and dev time through an alias. Turbopack's root is the project, because the framework lives inside it at `.jotdown/framework`.
- Tailwind `@source` lines are generated for both folders.
- Dependencies: React, the kit and what the framework ships (lucide, the shadcn primitives). A project only adds a `package.json` when it needs more, and `jotdown dev` and the site's build install it.

### 6.2 The kit, `@jotdown/kit`

- **Hooks:** `useIsEditable`, `useInStudio`, `usePage`, `useSite`, `usePages({ folder, sort, limit })`.
- **Primitives:** `Editable.Text`, `Editable.Image`, `Slot`. They render static output in a published page and become editable in the canvas.
- **`defineBlock` metadata** as optional registration beside a component.

### 6.3 Resolution

- A project component wins over the framework default by name.
- Text flow is not overridable, only styled.

### 6.4 The editability ladder in the editor

- Generalise `MdxBlock` into the movable block with a props-as-source popover.
- Generalise the in-frame mounting used for Callout and Steps, so the `children` of any component are editable in place.
- Generate the settings popover and the `/` entry from `defineBlock` metadata.
- Inline prop editing through the primitives.

### 6.5 Layouts

- `layout` in front matter, then the nearest folder's `meta.json`, then the config. Resolved when the page is drawn, never written into new pages.
- Layouts are React components receiving `{ page, site, children }`. The framework ships `docs` (from Phase 4) and `blank`.
- A layout draws the page's title and description with `Editable.Title` and `Editable.Description`; the canvas hands the kit its front matter editors.
- A project block's editing wrapper draws no box, so a layout places the block's own root as the site does. Its settings live in the grip menu.
- Wide and full measure against the window outside the docs shell, unless a layout sets `--jd-main-width`.

### 6.6 `jotdown add <block|layout>`

Copies a framework default into the project, shadcn-style.

### 6.7 Content rules and defaults

- Keep refusing `import`, `export` and expressions.
- An unknown tag renders as a labelled placeholder in Skinny and in the canvas, instead of rendering nothing as it does today.
- Rewrite the framework defaults with the kit.

**Milestone C:** a site with a custom `Hero` is edited in place through a localhost canvas the app started, and it hot-reloads as its code changes. The published site renders it too.

#### Done (2026-10-11)

- **6.1** The publication copies `.jotdown/components` and `.jotdown/layouts` into its own `.project/` (git-ignored) with an index it imports as `@project`, rather than making the project Turbopack's root, so a checkout anywhere serves any folder. Every file becomes a client component unless it names a directive. `.jotdown/package.json` is installed into the copy when it changes. `app/site.css` adds the copy as a Tailwind `@source`.
- **6.2** `packages/kit` (`@jotdown/kit`): `usePage`, `useSite`, `usePages`, `useIsEditable`, `Editable.Text`, `Editable.Image`, `Slot`, `Link` and `defineBlock`. The page data is only sent to the browser when the project has code of its own.
- **6.3** The project's capitalised exports are spread over the framework's map, page by page and in the canvas.
- **6.4** In the canvas a project block stands in a stamped wrapper, so it gets a grip, and a settings button: fields from `defineBlock`, its source otherwise. Prop edits are patches of the opening tag, children are stamped by `remarkSourceRange`'s `inside` option and edited by the page's own editors, and the block's still carries both when it moves (`region.ts`). `/` offers every `defineBlock`. The whole-page Tiptap `MdxBlock` was left alone, since nothing edits through it any more. An inserted block reads as its source until the page is saved.
- **6.5** `layout` in front matter and the config (default `docs`). `blank` is built in. Both the site and the canvas draw a page in its layout.
- **6.6** `jotdown add block|layout [name]` copies from `packages/kit/templates`: `Hero`, `PageList`, `landing` and `article`.
- **6.7** An unknown tag is a labelled, movable stand-in in Skinny and the canvas, and fails a site build. The framework's own blocks were not rewritten with the kit: each has an editor of its own the primitives cannot match, and the kit-written blocks are the `jotdown add` templates. ADR 0026 records the editing model.
- **Milestone C** checked with `/tmp`'s scratch project: a `Hero` and a `landing` layout edited through a localhost canvas (title, prose, settings, empty slot, `/` insert, each saved as exactly the changed bytes) and redrawn within seconds of its file changing.

## Phase 7: Later, unordered

**App and canvas:**

- A key on any page of a live site opens that page in the app. The sidebar's Edit this page offer already does, with a `jotdown://open/<owner>/<repo>/<page>` link.
- The last few canvases stay alive in hidden iframes, so switching projects is instant.
- Deploy status per project in the status strip, from GitHub deployment statuses.
- A device-size switch on the canvas.
- A menu bar item and a global hotkey for quick capture into an inbox page.

**Saving:**

- GitHub commit cadence: a draft kept by the studio, committed on leave, on idle or on Cmd+S.
- Folder projects show "uncommitted changes" and "behind origin".

**Second brain:**

- Wikilinks and backlinks.
- A folder as a database: a front matter schema gives each page a properties header and the folder table and gallery views.
- A publish allowlist for vaults.
- Obsidian-compatible `.md`.

**Carried over from Noation's task board:**

- A default icon for every page.
- Page preview (peek).
- Private pages.
- Icon versus logo. Done (2026-10-11): `favicon` is the square icon every square slot draws, fitted in; `logo` is an optional wordmark that stands in when there is no icon.
- A project settings panel with theme presets. Done (2026-10-11): the gear and ⌘, open every config field over the window, saved as one commit, with palettes, contrast badges, derive dark, a pasted shadcn theme, Google Fonts copied into the uploads, the config's history, search and health checks. The draft repaints the studio, and a canvas through the new `look` message; a site deployed before it ignores that. Still open: a personal preferences tab, and importing a theme from Figma.
- Image compression and download.

**Branding:** a Jotdown icon.

**Out of scope:** phones. For a quick fix away from the Mac, use GitHub's app or Obsidian on the same repo.

## Open questions

Answered 2026-10-10: 1 squashed and public as of 2026-10-11; 3 never sign, ad hoc only; 4 placeholders for now; 5 neutral, done; 6 renamed to `jd-`, done; 7 and 8 as recommended.

1. **Make Jotdown public after squashing?** While it is private, every publication needs `JOTDOWN_TOKEN` to clone it, and update artifacts need a public host anyway. Recommend squashing, then making it public.
2. **Where do update artifacts live?** Recommend GitHub Pages on the Jotdown repo once it is public; Cloudflare R2 otherwise.
3. **An Apple Developer ID ($99 a year)** for signing, notarization and frictionless updates? Recommend starting unsigned, and buying it if Open Anyway or updates get annoying.
4. **Mascot icons:** keep or replace? Recommend placeholders now and a Jotdown icon later.
5. **Default palette and typefaces:** recommend a neutral shadcn palette with Inter and JetBrains Mono.
6. **Rename `pb-` to `jd-`:** recommend yes, in Phase 2.
7. **Static-only publication,** dropping the standalone server and Docker: recommend yes.
8. **Sentry:** recommend removing it.
9. **Font tokens:** the exact shape, decided in Phase 4.

## Risks

- **The editor in WKWebView.** The spike's WebKit pass found no gap; native input in the real window still needs a hands-on check. `bundleCEF` stays the first fallback.
- **Electrobun is young.** 2.x changed its default runtime and build tool. Pin the version, and keep the Electron app at `4023e01^` as the fallback.
- **Updates on a signed app.** The updater rewrites a file inside the bundle after an update, which breaks a real signature. Recheck once builds are signed with a Developer ID.
- **Render parity.** The canvas must render exactly what the build renders. Use one remark chain for both, and parity stories in Storybook.
- **The protocol is a contract with every built site.** Version it from the first message and keep it tiny.
- **Project code outside the app root.** Keep the framework inside the project at `.jotdown/framework`, so the project is an ancestor of the app, which Turbopack requires.
- **Tailwind classes typed into page content** won't exist in a built site's CSS. Content shouldn't style itself, so this stays a limitation.
