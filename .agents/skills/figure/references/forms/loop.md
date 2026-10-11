# Loop

For a reinforcing cycle, a flywheel, an operating loop: the last step feeds the
first, and every pass writes durable state back to one shared hub. The dashed
write-back spokes are what make it a loop; without them it is a circular
process, and if the last step does not truly return to the first, it is a
flowchart drawn in a circle.

## What it must carry

- What accumulates in the hub, named, and what each step contributes to it.
- The direction of travel, marked once rather than on every spoke.
- What starts the loop, and what would stop it.

## Layout

- Five to eight **stations** on a ring around exactly one **hub**. Station `k`
  of `N` sits at angle `-90° + k · 360° / N`, so the first is at the top and the
  rest run clockwise. Snap the station rectangles to the 4px grid after
  computing them, keeping paired stations symmetric.
- Stations are the standard node, 160 by 64. The hub is the one dark element:
  `ink` fill, `surface` text, slightly larger than a station, one name and one
  short sublabel. It is accumulated state (memory, a runbook, a record), not a
  seventh step.
- **Ring flow**: circular arcs on the station circle itself, all with the same
  centre and radius, clockwise, `A R R 0 0 1` from the exit of one station to
  just before the entry of the next, solid `line`, arrowhead at the destination.
  This is the one place a connector is an arc rather than an elbow, and the ring
  never mixes in straight or orthogonal segments; the gaps must read as one
  continuous circle.
- **Write-back spokes**: straight radial lines from each station's inner edge
  toward the hub, stopping 6px before the hub stroke, dashed `muted`
  (`strokeDasharray="4 3"`), light arrowhead. True radii, never crossing, each
  touching only its station and the hub. Label a curated few, not all.
- At most one focal station in the accent, the editorial gate (the human
  approval, the measurement). Zero is fine.
- Draw order: ring arcs, spokes, spoke labels, stations, hub, text.
- If a ring route would cross the hub, enlarge the radius or split the figure.

## Anti-patterns

- Two hubs. Two accumulated states are two systems.
- Solid spokes. They read as primary flow and kill the write-back signal.
- Stations at uneven angles with no reason.
- More than eight stations. Labels and spokes crowd the hub.
