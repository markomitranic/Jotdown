# Line

For a trend over time or a sequential index, when the direction and rate of
change is the message.

## What it must carry

- Both axes labelled with their unit, and the last value printed on the line.
- The event that explains a jump, annotated where the jump is. An unexplained
  cliff is the only thing the reader will look at.
- How many series there are, and which one the figure is about, in the accent.

## Layout

- Four to twelve points. Fewer is a number in a sentence; more gets aggregated
  into periods.
- A `<polyline>` with `fill="none"`, never a smoothed spline: the data was
  sampled and a curve invents values between samples.
- The focal series at `strokeWidth="1.8"` in the accent with a `<circle r="4">`
  at each point; other series at `1.2` in `muted`, line only.
- Prefer one series. Three is comfortable, five the ceiling.
- A gap in the data is a gap in the line, not a segment across it.
- Time labels under the plot in `fontSize="10"`, centred on each point.

## Slopegraph

For change between exactly two points in time, per item. Two vertical axes,
before on the left and after on the right, one line per item between them, the
item's name and value in the gutter at each end, the focal item in the accent.
The lines' slopes are the whole chart.

## Bump

For rank movement across several snapshots. The y axis is rank, one at the top,
a line per item through its rank at each snapshot, names in the end gutters, the
focal item in the accent. Ties are resolved in the data before drawing.

## Ridgeline

For one distribution per series. A small area curve per row, stacked with a
slight overlap, each on its own baseline, the focal row in the accent. It shows
the shape of each distribution; for the values themselves, a table.
