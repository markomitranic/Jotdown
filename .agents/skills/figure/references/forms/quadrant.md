# Quadrant

For two-axis positioning: impact against effort, reach against frequency, a
portfolio map.

## What it must carry

- Both axes named, with both poles of each written at the ends.
- Every plotted item named. An unlabelled dot in a quadrant says nothing.
- What each quadrant means, in two or three words, in its corner.

## Layout

- A 2x2 with the axes as a 1px `ink` cross through the centre, each axis ending
  in an arrowhead about 64px inside the frame edge so there is room for labels
  beyond the tips.
- **One word per axis label**, at the arrow tip and beyond it, never on the
  line, never at the midpoint: `fontSize="10" letterSpacing="1.5"`, uppercase.
  No `HIGH / LOW`, no glyphs, no parentheticals. The word is the label.
- Items are `<circle r="4">` with a label 8 to 12px away. No item sits on an
  axis line (ambiguous quadrant) and no label crosses one.
- The accent on the "do first" item, usually top-right.
- Twelve items at most. Cluster or split beyond that.

## Scenario variant

For four named futures or strategic options across two independent drivers,
rather than a point cloud. The axes are double-ended (`markerStart` and
`markerEnd`) and hold a range rather than a measurement. Each cell holds a
scenario name in `fontSize="12" fontWeight="600"`, a one to three line
description in `fontSize="10"` `muted`, and a corner tag
(`01 · DIMENSION-A / DIMENSION-B`) whose two words match the axis labels
exactly. The accent goes on one whole cell: `accent-soft` fill, `accent`
stroke, accent corner tag. Not for anything where the position inside a cell
carries meaning; that is the standard quadrant.

## Anti-patterns

- Four filled quadrants in four colours. Position and label do the work.
- Missing axis names.
