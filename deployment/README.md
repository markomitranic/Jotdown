# Publish a project as a site

These are the files a content repository copies to publish itself, laid out from the repository's root, one folder per host. Each clones Jotdown into `.jotdown/framework` and runs its `apps/publication/build.sh`, which writes the site into `.jotdown/out`: static files, every page, upload, markdown twin and search index. A site has no editor and no password. It is open to anyone with the address, so private notes need access control at the host.

Your repository holds `docs/` with its uploads in `docs/_uploads/`, and `.jotdown/config.json`. The config's `jotdown` names the tag or branch to build with, `main` when unset; a release's own tag freezes on it. Its `url` is where the site is hosted, and a site below a domain's root is built under that path:

```json
{ "jotdown": "v0.2.0", "title": "Notes", "url": "https://you.github.io/notes" }
```

`JOTDOWN_TOKEN` is the only secret a build needs. While the Jotdown repository is private, each content repository makes its own fine-grained GitHub token for `markomitranic/Jotdown` alone, with Contents read-only, and gives it to its host under that name.

## GitHub Pages

Copy `github-pages/.github/workflows/jotdown.yml` and `github-pages/.jotdown/.gitignore` into the same places. Set Pages to "GitHub Actions" in the repository's settings and add the `JOTDOWN_TOKEN` secret. Every push to `main` publishes.

## Vercel

Copy `vercel/.jotdown/vercel.json` and `vercel/.jotdown/.gitignore` into `.jotdown/`, and give the docs a Vercel project of their own with `.jotdown` as its Root Directory and `JOTDOWN_TOKEN`. Leave "Include files outside the root directory" on, since the pages are outside it. Keep everything past the clone in `build.sh`, so a fix never has to be copied into content repositories, and keep each command under Vercel's 256 characters.

## Any other host

With Git and Bun 1.4.2, from the repository root, then serve `.jotdown/out` with anything that serves files:

```sh
git clone --depth 1 --branch main https://github.com/markomitranic/Jotdown.git .jotdown/framework
bash .jotdown/framework/apps/publication/build.sh
```

A broken link to a page or an upload stops the build. Nothing the build makes should be committed back to the content repository.
