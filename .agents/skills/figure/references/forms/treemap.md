# Treemap

For part of a whole where the relative sizes are the story: bundle size, spend,
market share, time allocation. The question it answers is "what dominates, and
by how much". Not for ranked lists where exact values matter more than
proportion (a bar), not for containment with no quantity (nested), not for a
hierarchy to trace (a tree).

## What it must carry

- What the areas encode, named, with the unit.
- The largest and smallest values printed, and the total.
- What the colour encodes, when it encodes anything.

## Layout

- Four to eight cells. Past eight the tail becomes slivers, so it groups into
  one explicit `Other` cell named in the caption.
- **Squarified**: sort descending and lay each row against the shorter side of
  the remaining rectangle, so aspect ratios stay near one and two areas are
  comparable by eye. Never stripes.
- 4px gutters, edges on the grid. Snapping moves area, so check each cell's
  drawn share against its true share as relative error and keep it within a few
  percent.
- Fills are a rank-ordered `ink` opacity ramp from `0.16` on the largest down to
  `0.04`, so order survives greyscale. One accent cell, chosen for the point
  being made rather than for being largest, with a `strokeWidth="1.5"` accent
  stroke. Every other cell has a 1px `line` stroke.
- Labels top-left inside the cell, 16px in: the name in
  `fontSize="12" fontWeight="600"`, the value and share on the next line in
  `fontSize="10"`. A medium cell drops the share, a small one keeps a short
  abbreviation, a sliver gets no text at all and is named in the caption.
- Never shrink a cell to fit its label, and never rotate a label to make it
  fit. The size is the data; the label is commentary.
- The caption states what area encodes (`area = spend, FY25`).
