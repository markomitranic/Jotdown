# Waterfall

For a start total bridged to an end total by signed steps: a budget bridge, a
headcount walk, a conversion leak. The running total is the story, and the
reader traces the path from one anchor to the other.

## What it must carry

- The start and end totals, both labelled.
- Every delta signed and valued.
- A sum that actually checks out. A waterfall whose bars do not reach the end
  total is worse than a table.

## Layout

- Vertical columns left to right in narrative order: start total, each signed
  step, an optional subtotal, end total. Equal widths on an even pitch.
- **Totals anchor, steps float.** Totals rise from the baseline and are the
  heaviest marks, `line-soft` fill with an `ink` stroke. A step spans from the
  running total before it to the running total after: an increase rises from
  the previous level, a decrease falls from it.
- Direction is encoded by fill, not hue. An increase is `line-soft` fill with a
  `muted` stroke; a decrease is hollow, `surface` fill with the same stroke, so
  the two read apart in greyscale.
- A **carry line** joins the top of each bar to the start of the next at the
  shared level, `line`, `strokeWidth="1"`.
- Values print signed (`+64`, `−38`), above an increase and below a decrease,
  since the space above a decrease is where its carry arrives. Totals print
  unsigned.
- One focal step in the accent, if one step is what the chart exists to show.

## Budget

Eight bars including both totals and at most one subtotal. Merge the tail into
one named `Other` step and say what it holds in the caption.

## Anti-patterns

- A horizontal waterfall. It reads as a Gantt.
- Only the two endpoints, no steps. That is a dumbbell.
- Steps that do not reconcile to the end total.
