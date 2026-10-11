# Dependency graph

For what depends on what across packages, modules or services, when the data
has one of the two things a tree cannot show: a node with more than one parent
(a shared dependency several things converge on) or a cycle. If every node has
one parent and nothing points back, it is a tree; say so rather than forcing a
graph onto tree-shaped data.

## Is this the right file

The arrows mean **needs**. If they mean "sends data to", this is
`what-talks-to-what.md`; if they mean "happens after", it is a sequence or a
timeline. Drawing a call graph with dependency grammar tells the reader the
build breaks when it does not.

And the fan-in or the cycle has to be the point. One parent per node with
nothing pointing back is tree-shaped data, so draw a tree and say so.

## What it must carry

- Every edge directed, and the shared node everything converges on, or the
  cycle, visible without tracing a path by eye.
- A node's depth meaning something: how far from the root, or which tier.
- What is external, marked as external. A dependency you cannot change is the
  most important node on the drawing.

## Layout

- Rank the nodes by dependency depth into horizontal rows: entry points nobody
  depends on at the top, deeper ranks below, rows 120px apart. Ranking is what
  makes the graph readable, not a polish pass.
- Forward edges point down across ranks, or run horizontal within one rank.
  Nothing points up except the one marked cycle.
- Nodes are the standard box, 160 wide, 56 tall, with a **fan-in badge** in the
  top-right corner (`4 in`, `fontSize="9.5"`) saying how many nodes depend on
  it. The node with the highest fan-in is the structural story; nothing else is
  sized to compete with it. Without the badges the reader cannot see where
  dependencies concentrate, which is the reason this form exists.
- Internal packages are components; third-party ones get the outside-our-control
  treatment with a version or registry sublabel (`v3.23 · npm`).
- **The cycle**, if there is one, is the editorial point: the single back-edge
  is dashed `accent`, routed around the outside of the node stack, never through
  the middle or behind a node it does not touch, with a `CYCLE` label at its
  visible end. That edge and its label are the whole accent budget; the two
  nodes it touches stay in their normal treatment.

## Budget

Nine nodes, fourteen edges, four ranks, one highlighted cycle. Over budget,
collapse a leaf cluster into one node labelled with its count (`+6 leaves`) and
say so in the caption.

## Anti-patterns

- A hairball with no rank order.
- One node per file. The graph is about packages, modules or services.
- Two highlighted cycles. Neither reads.
