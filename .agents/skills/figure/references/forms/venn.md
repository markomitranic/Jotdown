# Venn

For the overlap between two or three concepts: shared attributes, "where A
meets B", desirable against feasible against viable. Four circles is
unreadable; use a matrix.

## What it must carry

- Every region labelled, the overlaps included, and the area outside every set.
- What the overlap actually is, in words, rather than only that one exists.
- Sizes, when relative size is part of the claim; otherwise a caption saying the
  circles are not to scale.

## Layout

- Two or three `<circle>`s, stroke 1px in `ink`, `muted` and `line` per set,
  fills in the layer bgs (`p-bg`, `d-bg`, `i-bg`) at `opacity="0.6"` so the
  overlaps compound naturally.
- Radii are equal when the sets are comparable and proportional when they are
  meaningfully different. Do not fake equal sizes.
- **Set labels** sit outside the circle, never crossing its stroke,
  `fontSize="12" fontWeight="600"` with an optional sublabel in `fontSize="9.5"`.
- **Intersection labels** sit inside the overlap, centred. A small overlap gets
  a leader line to a label in clear space.
- The accent on the one focal intersection, the sweet spot: an accent label, or
  an `accent-soft` fill bounded by a `<clipPath>`.
- Centres and radii on the 4px grid.

## Anti-patterns

- An unlabelled region.
- Circles that barely touch when overlap is the point.
- The accent on more than one overlap.
