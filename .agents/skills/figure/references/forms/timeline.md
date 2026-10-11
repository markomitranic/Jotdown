# Timeline

For a release history, project milestones, an incident minute by minute, a
roadmap.

## What it must carry

- Real dates, and a scale that does not lie. Equal spacing for unequal gaps
  needs a caption saying it is not to scale.
- What already happened and what is planned, told apart visually.
- The event the prose is about, in the accent.

## Layout

- A horizontal `line` baseline across the middle, `strokeWidth="1"`.
- Tick marks at the time boundaries that matter (quarters, months, sprints),
  each with a date under it in `fontSize="10"` `muted`. Say what the unit is.
- Events are `<circle r="4">` on the baseline. Labels alternate above and below
  to avoid collisions, each joined to its dot by a 1px hairline drop.
- A major milestone is an accent `<circle r="6">` with its label in
  `fontWeight="600"`. One or two.
- The scale is honest. Unequal intervals get unequal spacing, and a stretch too
  dense to draw gets a visible axis break rather than a fake even spread.

## Anti-patterns

- Evenly spaced events that were not evenly spaced in time.
- Labels stacked on one side until they overlap.
- No axis labels, so the reader cannot tell weeks from years.
