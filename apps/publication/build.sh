#!/usr/bin/env bash
#
# Builds the site of a content repository on Vercel, as a Next.js app.
#
# Vercel runs it from the project's Root Directory, `.jotdown`, once the install
# step has cloned Jotdown into `.jotdown/framework` at the ref its config names:
#
#   bash framework/apps/publication/build.sh
#
# It needs Git and Bun 1.4. Next builds through Vercel's adapter, and the build
# lands in `.vercel/output` in the folder it was started from, which Vercel
# deploys as it is.
#
# The content repository is the one whose .jotdown/ holds the checkout, or the
# checkout itself when it is Jotdown's own repository. A link to a page or
# upload that is not there stops the build.
#
# Next's compile cache is kept between deploys in `node_modules/.cache/next`
# beside the checkout, since Vercel carries every `node_modules` folder from one
# build to the next and the install step deletes the checkout each time.
set -euo pipefail

started=$PWD
next_cache=$started/node_modules/.cache/next
framework=$(cd "$(dirname "$0")/../.." && pwd)
content=$framework
if [[ "$(basename "$(dirname "$framework")")" == ".jotdown" ]]; then
  content=$(dirname "$(dirname "$framework")")
fi
export JOTDOWN_PROJECT=$content
export NEXT_TELEMETRY_DISABLED=1

cd "$framework"
printf 'Jotdown commit: %s\n' "$(git rev-parse HEAD 2>/dev/null || echo unknown)"
printf 'Bun: %s\n' "$(bun --version)"

bun install --frozen-lockfile --ignore-scripts --filter @jotdown/publication
bun scripts/check-links.ts "$content"

if [[ -d "$next_cache" ]]; then
  mkdir -p apps/publication/.next
  mv "$next_cache" apps/publication/.next/cache
  printf 'Restored the Next cache: %s\n' "$(du -sh apps/publication/.next/cache | cut -f1)"
fi

NEXT_ADAPTER_PATH=$(cd apps/publication && bun --print 'require.resolve("@next-community/adapter-vercel")') \
NEXT_PRIVATE_OUTPUT_TRACE_ROOT=$content \
  bun run --cwd apps/publication build

if [[ -d apps/publication/.next/cache ]]; then
  mkdir -p "$(dirname "$next_cache")"
  mv apps/publication/.next/cache "$next_cache"
  printf 'Kept the Next cache: %s\n' "$(du -sh "$next_cache" | cut -f1)"
fi

rm -rf "$started/.vercel/output"
mkdir -p "$started/.vercel"
mv apps/publication/.next/output "$started/.vercel/output"
