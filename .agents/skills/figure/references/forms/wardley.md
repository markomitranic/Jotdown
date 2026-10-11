# Wardley map

For positioning the parts of a value chain against how evolved each one is, so
the reader can see what to build, what to buy, and what is about to move. A
strategy artefact: it says nothing about runtime connections.

## What it must carry

- The user at the top, and the chain hanging from them.
- Every component placed on the evolution axis, with that axis labelled at both
  ends.
- What is moving, and which way.

## Layout

- **Y axis**, value chain: `Visible to the user` at the top down to
  `Invisible` at the bottom, labels as stacked horizontal `<text>` lines at the
  ends, never rotated. Axis line `line-soft`.
- **X axis**, evolution: four bands separated by three dashed `line-soft`
  verticals, labelled along the bottom in `fontSize="10" letterSpacing="1.5"`
  uppercase: `GENESIS`, `CUSTOM-BUILT`, `PRODUCT`, `COMMODITY`. A component
  sits in a band, not at a decimal score.
- **Components** are `<circle r="6">`, `surface` fill, `ink` stroke, named in
  `fontSize="12" fontWeight="600"` 12px above the dot.
- **Dependency links** are thin `muted` straight lines (`strokeWidth="0.8"`)
  from a component down to what it depends on, no arrowhead. The position of
  each dot is the data, so these are exempt from the elbow rule. A component
  with no link is not in the chain; wire it in or delete it.
- **Movement**: a component that is evolving carries a short dashed `accent`
  arrow from its dot's edge toward the next band, pointing right, because
  evolution only moves toward commodity. It needs no label; shape and direction
  already say it. A label is legitimate only for a timeframe (`BY Q3`) or a
  driver (`VENDOR LOCK-IN`), and only if there is clear space for it.
- The accent budget is the moving dot (`accent-soft` fill, `accent` stroke) and
  its arrow. Two moving components share the budget with nothing else.

## Budget

Nine components, twelve links, two movement arrows.

## Anti-patterns

- Arrows pointing left.
- A numbered y axis. Visibility is ordinal, not a quantity.
- Using it as a `what-talks-to-what.md` map. No protocols, no request direction.
