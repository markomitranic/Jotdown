# Radar and polar

Two charts on a circle. **Radar** compares several things scored on the same
few criteria. **Polar** is one series across categories whose clockwise order
carries meaning.

## What it must carry

- Every axis named, with the direction that counts as better stated once.
- The values, not only the shape. Two overlapping blobs without numbers are a
  decoration.
- How many things are plotted, and which one the figure is about.

## Radar

- Three to five axes at `-90° + 360° · i / N`, the first at the top. Above five
  axes or five series, a table.
- Five rings at `0.2` steps, each a `<polygon>` through the axis points at that
  fraction, in `line-soft`; the outer ring in `line`. Spokes from centre to each
  outer vertex in `line-soft`, no arrowheads.
- One word per axis label, `fontSize="12" fontWeight="600"`, 16px outside the
  outer ring along the axis: `textAnchor="middle"` top and bottom, `start` on
  the right, `end` on the left.
- Scale ticks (`2 4 6 8 10`) on the top axis only, `fontSize="10"` `muted`.
- Each series is a `<polygon>` with a `strokeWidth="1.5"` stroke and the same
  colour filled at `opacity="0.18"`. The focal series in the accent at `1.8`,
  and only it gets `<circle r="4">` vertex dots. That one rule keeps four series
  readable.
- A point at value `v` on scale `S`, axis `i`, sits at
  `cx + (v/S)·R·cos(angle), cy + (v/S)·R·sin(angle)`. Round to integers.
- Draw order: rings, spokes, labels, ticks, non-focal series smallest area
  first, focal series, its dots.

## Polar

- Four to eight categories in input order, never sorted by value; the order is
  the point.
- Angle is the category, radius is the value, from zero at the centre. A
  truncated radial scale is invalid.
- One series, drawn as a wedge or a radial bar per category in `line-soft` with
  a `muted` stroke, the one focal category in the accent.
- Category labels outside the outer ring, horizontal.
