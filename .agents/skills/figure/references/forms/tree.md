# Tree

For parent-to-children structure: a taxonomy, a file tree, a decision
breakdown, a component hierarchy. Every node has exactly one parent and
nothing points back up. If a node has two parents or there is a cycle, it is a
dependency graph.

## Is this the right file

One parent per node, no cycles, and the containment or ownership is what the
figure is about. A node with two parents or an edge pointing back up is a
dependency graph, and forcing it into a tree hides the exact thing that made it
worth drawing.

If the point is which parts talk to each other and the hierarchy is incidental,
that is `what-talks-to-what.md`.

## What it must carry

- One kind of parent relation throughout. A tree mixing "contains" and "reports
  to" is two figures.
- Leaves distinguishable from branches.
- Depth meaning something the reader can name.

## Layout

- Root at the top, children fanning out below (or root at the left, children to
  the right).
- Nodes are `<rect rx="4">`, 120 or 160px wide, 40 or 48px tall, two widths at
  most across the whole figure. Name in `fontSize="12" fontWeight="600"`, an
  optional sublabel in `fontSize="9.5"`.
- Connectors are elbows, never diagonals: the parent drops a short vertical, a
  horizontal bus runs across the siblings, each child gets a short drop into its
  top edge. `line` stroke, `strokeWidth="1"`. Connectors before nodes.
- Depth of four at most (root plus three tiers), five children per level at
  most. Deeper or wider splits into one figure per subtree.
- The accent on one node: the root or one critical leaf, not both.

## Org chart variant

Use it when the nodes are people, teams, agents or roles and the question is
"who owns what". A tree shows structure; an org chart shows responsibility,
routing and gaps.

- The front door, the one that receives ambiguous work, is the focal node at
  the top.
- Where space allows, a node answers three things: the **name** of the role, how
  to **reach** it (a handle, a queue, an issue prefix) in `fontSize="9.5"`, and
  its **scope** in two to four words. Never a job description.
- An owner not yet live or not yet wired in is drawn dashed, not hidden. A
  missing route is operationally important.
- Approval and escalation rules go in the caption, not as extra nodes.
- Twelve nodes at most, five direct reports per parent. More than that groups
  under pod nodes.

## Anti-patterns

- Diagonal connectors.
- A parent connected to a grandchild with no middle.
- Nodes of wildly varying widths.
- Every person drawn as an identical box, hiding the front door and the gaps.
