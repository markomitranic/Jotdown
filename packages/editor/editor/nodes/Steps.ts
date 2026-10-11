import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { StepsView, StepView } from "./StepsView";

/**
 * The `<Steps>` wrapper, which holds steps and nothing else.
 *
 * Neither tag takes a prop, so neither node carries an attribute of
 * its own: the number a reader sees beside a step is where it sits in the block
 * and nothing more. `srcIndex`, `srcStart` and `srcEnd` come from the shared
 * `blockOrigin` extension in `../extensions`.
 */
export const Steps = Node.create({
  name: "steps",
  group: "block",
  content: "step+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-steps]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-steps": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StepsView);
  },
});

/**
 * One step, whose whole content is prose.
 *
 * `isolating` is what keeps a backspace at the top of a step from swallowing
 * the step above it, the same reason a table cell carries it.
 */
export const Step = Node.create({
  name: "step",
  content: "block+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "div[data-step]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-step": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StepView);
  },
});
