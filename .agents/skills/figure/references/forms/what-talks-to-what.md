# What talks to what

The standing map of a system: which components exist and which pairs are wired
together. System overviews, integration maps, infra topology. The three variants
at the end of this file are the same grammar wearing different labels.

## Is this the right file

This is the most generic grammar in the set. Boxes, arrows and a zone accept
almost any content without complaining, which makes it the easy wrong answer:
draw the wrong thing here and you get a figure that looks right and says
nothing. Two checks, and both have to pass.

**The boxes are things that run.** Services, apps, jobs, stores, browsers,
third-party endpoints. Files, folders, roles, concepts, versions, options and
decisions are not. A figure made of those wants a different form, or no form
file at all.

**The arrows have no order.** They are standing connections, all true at once,
and the figure reads the same whichever one you follow first. The moment the
reader has to ask "and then what", you want `sequence.md` for messages in time,
`swimlane.md` for steps handed between roles, or `flowchart.md` for branches.

One near miss worth knowing. A request path through several components is this
file when you are drawing the wiring the request crosses, and `sequence.md` when
you are drawing the order it crosses them in.

## What it must carry

- Every arrow labelled with what travels along it, and its protocol where the
  protocol is the point.
- Stores drawn differently from things that run, so data at rest reads as rest.
- What is outside our control, marked as outside our control.

## Layout

- Group components by tier or trust boundary into zones, whose grammar is under
  Zones in `SKILL.md`: frontend to backend to data, or public to private.
- One flow direction, left to right or top to bottom, held for the whole figure.
- Arrows before boxes, routed as elbows.
- One or two focal nodes in the accent: the integration point, the primary
  store, the component being introduced. Never every "important" box.
- A store, a queue, a cache is drawn in a layer bg fill so it reads as a thing
  data rests in rather than a thing that runs.

## Ports and crossings

When the destination is mostly above or below the source, leave through the
source's top or bottom edge and arrive at the destination's top or bottom with a
single bend, so the arrow reads as arriving rather than puncturing the side of
the box. From (200,120) into the top of a box whose centre column is 400 and
whose top edge is 180:

```mdx
<path d="M 200,120 H 392 Q 400,120 400,128 V 180"
  fill="none" stroke="var(--jd-fig-line)" strokeWidth="1.5" markerEnd="url(#ar-arrow)" />
```

Left and right ports are for connections that travel mainly sideways.

When two arrows must cross, the less important one hops the other with a small
arc and only one of them hops. A horizontal line at y 200 hopping a vertical at
x 300:

```mdx
<path d="M 100,200 H 292 a 8,8 0 0 1 16,0 H 500"
  fill="none" stroke="var(--jd-fig-muted)" strokeWidth="1" strokeDasharray="4 3" />
```

A vertical line hopping a horizontal uses `a 8,8 0 0 0 0,16` at the crossing.

## Anti-patterns

- Bidirectional arrows when one direction is obvious from context.
- A box for every microservice. Nine nodes is the ceiling; above it, an
  overview figure and a detail figure.
- A legend inside the drawing. If an encoding repeats enough to need one, it is
  a caption sentence.

## Deployment variant

Use it when the point is placement: which host, which environment, how many
replicas, which version. The same map with hostnames bolted on is not a
deployment diagram.

- Zones are real environments or network boundaries (`edge`, `prod / eu-west-1`,
  `data`), taking the dashed form.
- A node is a host, VM, pod or managed service, with a small rectangular type
  tag (`POD`, `VM`, `MANAGED`, `CDN`) in its top-left corner and, when it runs N
  copies, an `x3` badge in its top-right. One node with a badge, never one node
  per replica.
- What is deployed onto a node is an artifact chip: a 24px-tall `<rect rx="4">`
  inside the node, `line-soft` fill, holding the image or service name and a
  version (`v2.4.1`) right-aligned in `fontSize="9.5"`. Several chips stack with
  an 8px gap for a sidecar. A chip without a version is a wasted box.
- Paths are labelled with protocol and port (`HTTPS:443`, `TLS:5432`). A path
  that crosses a zone boundary is the primary `line`; one that stays inside a
  zone is `muted`. Replication and async paths are dashed.
- Focal: the single point of failure or the newly introduced piece.
- Budget: 3 zones, 6 nodes, 9 chips, 8 paths. Over that, one figure per
  environment.

## Platform integration variant

For a data platform's topology: which sources plug in, which consumer surfaces
plug out, over what wire. Sources in a column on the left, the platform as one
zone in the centre with its components inside, consumers in a column on the
right, cross-cutting services (identity, scheduling) as full-width bars under
the zone. Every spoke carries its protocol (`JDBC`, `SFTP`, `ODBC`, `REST`).
There is no time axis; if the reader needs "how data moves through phases",
that is a swimlane or a layer stack.

## Current state variant

The "before" picture of a modernisation: the legacy landscape grouped by phase
or department (Collection, Processing, Dissemination). Same grammar as
above, plus the pain points as the focal nodes (a shared drive with no
version control, a manual bottleneck) and file-based handoffs labelled for what
they are (`CSV`, `Email`, `Copy`). External systems get the outside-our-control
treatment. The figure exists to show the friction the proposal removes, so the
friction is what gets the accent.
