# Sankey

For where a quantity goes as it splits and merges across a few stages: a CI
compute budget, a cost or headcount allocation. Band thickness carries the
data; if the reader does not need to compare magnitudes, it is a swimlane or a
funnel.

## What it must carry

- Every band's quantity, and the totals going in and coming out.
- Anything lost between those two totals, named rather than left as a gap the
  reader has to compute.
- The unit, once, in the caption.

## Layout

- **Exactly three columns**, left to right. More is two linked figures.
- Nodes are vertical bars 12px wide in `ink`, no stroke, height proportional
  to the quantity through them.
- Flows are filled ribbons, one closed `<path>` per flow. The top edge is a
  cubic curve with **both control points at the horizontal midpoint**,
  `C midX,y0 midX,y1 targetX,y1`, and the bottom edge the same curve in
  reverse, so the band leaves and arrives horizontally and plugs into each bar
  square on. A control point on the target's x collapses the arrival and the
  ribbon meets the bar at a slant.
- **No arrowheads.** Column order gives direction; a marker on a filled band is
  clutter. This is the exemption from the connector rules.
- Ordinary ribbons are `muted` at `opacity="0.18"`. The one focal path is
  `accent` at `opacity="0.28"`, painted last among the ribbons. A path may span
  two ribbon segments and still count as one focal element. Never a colour per
  flow.
- One px-per-unit scale for the whole figure, applied to every bar and ribbon,
  each thickness rounded to 4px and reconciled at the node so a node's outgoing
  ribbons still sum to its height. A ribbon under 4px folds into an `Other`
  band rather than becoming an invisible hairline.
- Order nodes within each column so converging flows keep one top-to-bottom
  sequence across columns. Two ribbons crossing more than once means reorder.
- Column headers as eyebrows. Node name and quantity beside each bar: outside
  the bar in the outer columns, centred in the gutter above it in the middle.

## Budget

Three stages, eight nodes, twelve flows.
