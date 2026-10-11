import type { MermaidConfig } from "mermaid";

/**
 * The Mermaid config the reading view and the editor's canvas both render with.
 *
 * Mermaid keeps its config in a module singleton, so one object shared by both
 * surfaces is what stops a diagram looking different while it is being edited.
 * The neutral theme is deliberate in both colour modes: authors hard-code lane
 * and note colours into the source, and the stylesheet inverts the finished
 * drawing in dark mode rather than asking Mermaid for a dark palette that would
 * leave those tints as bright slabs.
 *
 * Mermaid 12 lays diagrams out with ELK and draws them in its `neo` look by
 * default. `dagre` and `classic` keep every diagram already on a page where
 * its author left it. A diagram can still ask for ELK in its own front matter.
 *
 * `satisfies` rather than an annotation, so the object keeps its own shape and
 * the editor's canvas, which types its config as a plain record, can take it
 * without a cast.
 */
export const MERMAID_CONFIG = {
  theme: "neutral",
  layout: "dagre",
  look: "classic",
  fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
  sequence: {
    messageAlign: "left",
    noteAlign: "left",
    mirrorActors: false,
    actorMargin: 60,
    boxMargin: 12,
  },
} satisfies MermaidConfig;
