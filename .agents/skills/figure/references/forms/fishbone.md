# Fishbone

For structured root-cause analysis: one observed effect, causes grouped by
category, sub-causes hanging off each. The artefact of a post-mortem, for
showing what was investigated rather than only the conclusion.

## What it must carry

- The effect stated as something observed, with a number if there is one,
  rather than as a category name.
- Every bone labelled with its category and carrying at least one real cause. A
  bone with nothing on it is a bone to delete.
- Which cause is suspected, when the prose suspects one.

## Layout

- **Spine**: a horizontal `ink` line (`strokeWidth="1.2"`) at the vertical
  centre, ending in an arrowhead into the **effect box** at the right, which
  holds the observed effect and is the accent.
- **Bones**: straight diagonals at 60° to the spine, alternating above and
  below, 128px apart along it. From an attach point on the spine the bone runs
  `dx = −64`, `dy = ∓112` to its far end, where the category name sits in a
  small `<rect rx="4">` tag. The diagonals are this form's grammar and the one
  exemption from the elbow rule; any other connector on the page still routes
  orthogonally.
- **Sub-causes**: 32px horizontal ticks branching off a bone at a third and two
  thirds of its length, each with a `fontSize="10"` label past its open end,
  anchored `end` above the spine and `start` below.
- One bone is the confirmed root cause: `accent` line, `accent-soft` tag. That
  bone and the effect box are the whole accent budget.
- Draw order: spine, bones, ticks, category tags, effect box, so box fills cap
  the line ends.

## Budget

Four bones fit a 960-wide frame with the effect box at the right; widen the
`viewBox` by 128 per extra bone, six at most. Three sub-causes per bone.

## Anti-patterns

- Every bone accented because every category "contributed".
- Sub-cause text that is a sentence. A label, with the reasoning in prose.
