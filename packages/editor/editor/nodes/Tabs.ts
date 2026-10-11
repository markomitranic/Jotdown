import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TabsView, TabView } from "./TabsView";

/**
 * The `<Tabs>` wrapper, which holds tabs and nothing else.
 *
 * `Tabs` names the tabs on the wrapper, as `items={['bun', 'npm']}`, and
 * matches each panel to one of those names by its `value`. Here the name lives
 * on the panel it belongs to and `items` is printed back from the panels, so
 * renaming a tab is one edit in one place and the two can never disagree.
 *
 * `active` is which tab the editor has to the front. It is view state living on
 * the node, `rendered: false` and never printed, so switching tabs to read one
 * cannot turn into a change to the file. The core's own `defaultIndex` is the
 * same idea saved, and a file carrying one is left inert rather than half read.
 *
 * `srcIndex`, `srcStart` and `srcEnd` come from the shared `blockOrigin`
 * extension in `../extensions`, not from here.
 */
export const Tabs = Node.create({
  name: "tabs",
  group: "block",
  content: "tab+",
  defining: true,

  addAttributes() {
    return { active: { default: 0, rendered: false } };
  },

  parseHTML() {
    return [{ tag: "div[data-tabs]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-tabs": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TabsView);
  },
});

/**
 * One tab: the label a reader clicks, and the prose behind it.
 *
 * `isolating` is what keeps a backspace at the top of a tab from swallowing the
 * tab above it, the same reason a table cell carries it.
 */
export const Tab = Node.create({
  name: "tab",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return { label: { default: "", rendered: false } };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-tab]",
        getAttrs: (element) => ({ label: element.getAttribute("data-tab") ?? "" }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-tab": node.attrs.label ?? "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TabView);
  },
});
