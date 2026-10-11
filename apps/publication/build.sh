#!/usr/bin/env bash
#
# Builds the site of a content repository: static files in its `.jotdown/out`.
#
# Run it once Jotdown is cloned into the content repository's `.jotdown/framework`,
# at the ref its .jotdown/config.json names:
#
#   bash .jotdown/framework/apps/publication/build.sh
#
# It needs Git and Bun 1.4. Any static host serves `.jotdown/out` as it is:
# GitHub Pages, Vercel, a bucket behind a CDN, or `bunx serve .jotdown/out`.
#
# The content repository is the one whose .jotdown/ holds the checkout, or the
# one JOTDOWN_PROJECT names, or the checkout itself when it is Jotdown's own
# repository. A link to a page or upload that is not there stops the build.
#
# In a clone in `.jotdown/framework`, the first thing it does is reset the
# remote to Jotdown's public address. A private clone carries JOTDOWN_TOKEN in
# that URL, and resetting it keeps the token out of its `.git/config`. A
# checkout anywhere else keeps the remote it has.
set -euo pipefail

framework=$(cd "$(dirname "$0")/../.." && pwd)
content=${JOTDOWN_PROJECT:-$framework}
if [[ -z "${JOTDOWN_PROJECT:-}" && "$(basename "$(dirname "$framework")")" == ".jotdown" ]]; then
  content=$(dirname "$(dirname "$framework")")
fi
content=$(cd "$content" && pwd)
export JOTDOWN_PROJECT=$content
export NEXT_TELEMETRY_DISABLED=1

cd "$framework"
if [[ "$(basename "$(dirname "$framework")")" == ".jotdown" ]]; then
  git remote set-url origin https://github.com/markomitranic/Jotdown.git 2>/dev/null || true
fi
printf 'Jotdown commit: %s\n' "$(git rev-parse HEAD 2>/dev/null || echo unknown)"
printf 'Bun: %s\n' "$(bun --version)"

bun install --frozen-lockfile --ignore-scripts --filter @jotdown/publication
bun scripts/check-links.ts "$content"
bun run --cwd apps/publication build

rm -rf "$content/.jotdown/out"
mkdir -p "$content/.jotdown"
cp -R apps/publication/out "$content/.jotdown/out"
printf 'The site is in %s\n' "$content/.jotdown/out"
