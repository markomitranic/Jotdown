# Flowchart

For decision logic, a "should I" with branches, onboarding routing, a triage
tree.

## Is this the right file

A flowchart needs at least one fork where the path depends on an answer, and
the reader's question has to be "which way does it go". A run of steps that each
lead to exactly one next step is not a decision: that is a swimlane if actors
hand work over, a timeline if the steps are events in time, and a `<Steps>`
block if it is a procedure somebody follows.

The branches are choices the system or the person makes, not variants of a
thing. Three kinds of subscription is a table.

## What it must carry

- Every branch labelled with its condition. `yes` and `no` are not conditions;
  `stock < 1` is.
- Every path ending somewhere. A branch that runs off the edge of the drawing is
  the one the reader will ask about.
- The path the prose is about, in the accent.

## Layout

- Shape carries the node type, not colour:
  - **Oval** (`<rect rx="20">`) for start and end.
  - **Rectangle** (`<rect rx="4">`) for a step or action.
  - **Diamond** (`<polygon>`) for a decision, with at most three exits. Four or
    more means two nested diamonds.
  - **Filled dot** (`<circle r="4">`, `ink`) where branches rejoin.
- Flow runs top to bottom. From a diamond, Yes leaves to the right and No goes
  down by convention, but every exit is labelled regardless, in `fontSize="10"`
  clear of the line.
- The accent goes on the happy path or on the single most consequential
  decision. Never on every decision.
- Two arrows that must cross: the less important one hops with a small arc,
  `a 8,8 0 0 1 16,0` on a horizontal path at the crossing point, and only one
  of them hops.

## Anti-patterns

- Fill colour to signal node type. Shape already does it.
- Unlabelled decision branches. The label is the whole point of the diamond.
- Reproducing the layout a Mermaid renderer would produce. Place nodes so the
  main path runs straight and side paths step aside; automatic spacing is what
  makes a flowchart tiring to read.
