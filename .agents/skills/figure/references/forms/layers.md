# Layer stack

For stacked levels that are hierarchical: the OSI model, a CSS cascade, a tech
stack, a memory hierarchy, abstraction levels. If the layers are not actually
above and below one another, it is `what-talks-to-what.md` or a swimlane.

## Is this the right file

Each band has to rest on the one below and be unable to work without it, and you
have to be able to name what the lower band provides to the upper. If you
cannot, the bands are merely grouped or ordered, which is a timeline, a tree or
a table.

Bands that talk sideways as much as up and down are `what-talks-to-what.md` with
zones. Bands that are steps in time are a swimlane.

## What it must carry

- What each layer gives the one above it, named on the band or between them.
- The direction of dependency, stated once rather than repeated per band.
- What sits outside the stack: the caller above the top, and what the bottom
  band stands on.

## Layout

- Horizontal bands stacked vertically, every band the same x and width, 4 to 6
  of them, each 56 to 72px tall (on the grid: 56, 64, 72) and the same height
  unless there is a reason.
- Each band reads left to right: an **index tag** on the far left (`L3`, `07`,
  `APPLICATION`, as an eyebrow), the **layer name** left of centre in
  `fontSize="12" fontWeight="600"`, a **note** on the far right in
  `fontSize="10"` `muted`.
- Either alternate the fills (`surface` and a layer bg) or leave every band
  `surface` with `line-soft` dividers. Pick one and hold it.
- A direction indicator in the left margin, outside the stack: a short arrow
  and an eyebrow (`abstraction`, `packets`), stacked as separate lines rather
  than rotated text.
- One focal layer in the accent: the bottleneck, the layer under discussion.

## Medallion variant

For the storage tiers of one dataset by quality level: raw, anonymised, staged,
aggregated, archived. The tiers stand side by side as columns, left to right in
promotion order, each column a box carrying the bucket name, the format, and
who writes it, in that order. Between adjacent tiers a labelled arrow names the
transformation (`PII REMOVE`, `AGGREGATE`); the lifecycle move to archive is
dashed. The tier the reader consumes from is the focal one. Three to six tiers.

## Anti-patterns

- Every layer a different colour. The hierarchy disappears.
- Skipped numbering with no explanation.
- Layers of different heights for no reason.
