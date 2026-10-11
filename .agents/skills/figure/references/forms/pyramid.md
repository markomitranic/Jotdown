# Pyramid and funnel

Two orientations of one shape, never mixed in a figure.

- **Pyramid**, point up: the narrow apex is the rarest, most valuable or most
  important; the base is broadest and foundational. A hierarchy of needs, a
  value pyramid, a testing pyramid.
- **Funnel**, point down: the narrow end is the conversion, the smallest group;
  the top is the widest audience.

## What it must carry

- Each tier named with its size, count or share.
- What narrows between two tiers, and why, wherever the drop is the point.
- The base and the apex labelled with what they are, not only how big.

## Layout

- Four to six layers, each a `<polygon>` trapezoid of the same height (56, 64
  or 72px).
- Widths shrink linearly for a conceptual pyramid. For real funnel data the
  widths are honest, proportional to the count at each stage.
- Each layer carries its name centred in `fontSize="12" fontWeight="600"`, an
  optional sublabel in `fontSize="9.5"`, and, for a funnel, the drop-off beside
  it in the margin (`−40%`).
- Either graded layer-bg fills or all `surface` with `line-soft` dividers. Pick
  one. Outer silhouette in `line`.
- The accent on one layer only: the apex, the conversion layer, or the
  bottleneck. Never the base.
- An optional axis arrow in the left margin with an eyebrow (`rarer`,
  `drop-off`), stacked words rather than rotated text.

## Anti-patterns

- Seven or more layers.
- A pyramid for data that is not a hierarchy. That is a tree or a bar chart.
- Equal-height layers for stages whose drops are wildly unequal.
