/**
 * What a fresh diagram starts as, one per kind the canvas can draw into.
 *
 * Each one is a diagram already, not a header waiting for content: two nodes
 * and an edge is something to click on, and it renders on the page even if
 * whoever inserted it walks away.
 */
export const DIAGRAM_TEMPLATES = [
  {
    title: "Flowchart",
    code: "flowchart LR\n  A[Start] --> B[Finish]",
  },
  {
    title: "Sequence",
    code:
      "sequenceDiagram\n  participant Browser\n  participant API\n" +
      "  Browser->>API: Request\n  API-->>Browser: Response",
  },
  {
    title: "State",
    code: "stateDiagram-v2\n  [*] --> Idle\n  Idle --> Running: start\n  Running --> [*]",
  },
] as const;
