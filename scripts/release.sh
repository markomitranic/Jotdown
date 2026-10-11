#!/usr/bin/env bash
set -euo pipefail

# Cuts a framework release: hands the version, the changelog page, the commit
# and the tag to `commit-and-tag-version`, which reads them off the
# conventional-commit subjects since the previous tag. A `feat` moves the minor,
# a `fix` moves the patch, a `BREAKING CHANGE` footer moves the major, and
# `.versionrc.cjs` says where the changelog is written.
#
# A release carries two tags: its own, `v3.1.4`, and its major's, `v3`, which
# moves to every release of that major. A publication names one of them in its
# config, and pinning `v3` takes the newest 3.x on every build without letting
# 4.0.0 in. A pre-release gets its own tag only, so `v3` never builds an RC.
#
#   ./scripts/release.sh                      # the version the commits imply
#   ./scripts/release.sh --release-as 1.0.0   # a version you pick
#   ./scripts/release.sh --release-as major   # a breaking change nobody footnoted
#
# Anything you pass is passed on to the tool, which is run with `bunx` rather
# than installed, because every publication build installs Jotdown's
# dependencies and a release tool has no business among them.

TOOL="commit-and-tag-version@12"

# Any checkout will do, a worktree included, as long as it sits exactly where
# `origin/main` does. `main` itself is often checked out in another worktree,
# so this never switches to it.
git fetch --quiet origin main
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "This checkout is not at origin/main. Pull, or check out origin/main, first." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes first." >&2
  exit 1
fi

# What the commits come to, printed before anything is written.
bunx --bun "$TOOL" --dry-run "$@"

read -rp "Cut this release? [y/N] " confirm
[[ "$confirm" == [yY] ]] || { echo "Aborted."; exit 1; }

bunx --bun "$TOOL" "$@"

version="$(bun --print "require('./package.json').version")"
major="v${version%%.*}"

# The major's tag stays a plain one, unsigned even where Git signs every tag,
# since it only ever marks the newest release. Refs are spelt out in full, so a
# branch that happens to share the tag's name is never pushed in its place.
if [[ "$version" == *-* ]]; then
  git push --atomic origin HEAD:refs/heads/main "refs/tags/v$version"
else
  git tag --force --no-sign "$major" HEAD
  git push --atomic origin HEAD:refs/heads/main "refs/tags/v$version" "+refs/tags/$major:refs/tags/$major"
fi

# The tag starts the Release workflow, which builds the app and attaches its DMG to a GitHub release.
echo "Released v$version."
