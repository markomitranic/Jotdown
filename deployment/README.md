# Publish a project as a site

These are the files a content repository copies to publish itself on Vercel, laid out from the repository's root. Vercel clones Jotdown into `.jotdown/framework` and runs its `apps/publication/build.sh`, which builds the site as a Next.js app through Next's Vercel adapter into `.jotdown/.vercel/output`. A site has no editor and no password. It is open to anyone with the address, so private notes need Vercel's firewall in front of them.

Your repository holds `docs/` with its uploads in `docs/_uploads/`, and `.jotdown/config.json`. The config's `jotdown` names the tag or branch to build with, `main` when unset; a release's own tag freezes on it. Its `url` is where the site is hosted:

```json
{ "jotdown": "v0.3.1", "title": "Notes", "url": "https://notes.vercel.app" }
```

A build needs no secrets: Jotdown's repository is public.

## Vercel

Copy `vercel/.jotdown/vercel.json` and `vercel/.jotdown/.gitignore` into `.jotdown/`, and give the docs a Vercel project of their own with `.jotdown` as its Root Directory. Leave "Include files outside the root directory" on, since the pages are outside it. `bunVersion` makes Vercel build with Bun 1.4, the install step clones Jotdown into `.jotdown/framework`, and the build step runs `apps/publication/build.sh`. Keep everything past the clone in `build.sh`, so a fix never has to be copied into content repositories, and keep each command under Vercel's 256 characters.

A broken link to a page or an upload stops the build. Nothing the build makes should be committed back to the content repository.
