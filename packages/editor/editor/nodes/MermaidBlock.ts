import { ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockShiki } from "tiptap-extension-code-block-shiki";
import { CODE_THEME } from "@jotdown/core/lib/code-theme";
import CodeBlockView from "./CodeBlockView";
import MermaidBlockView from "./MermaidBlockView";

/**
 * A fence, edited as the drawing where it is Mermaid and as words everywhere else.
 *
 * Both halves are node views now. A mermaid fence gets the canvas; every other
 * language gets the reader's own code block frame, because ProseMirror's bare
 * `<pre><code>` is repainted by the article's typography the moment the editor
 * stands inside the article rather than in place of it. The node is still
 * `codeBlock` either way, so the markdown bridge, the source offsets and the
 * schema are untouched.
 *
 * `stopEvent` gives the canvas every event inside it. A code block is
 * selectable, so without that a mousedown on a diagram node would put a node
 * selection on the fence and take the drag away from the diagram mid-gesture.
 * The written fence wants the opposite, since every event in it is an edit.
 *
 * The element Tiptap hosts the written view in is transparent, so the fence's
 * frame, or its bare `<pre>` inside the build's frame, is laid out by whatever
 * holds it exactly as the build's would be: a flex column's gap reaches it, and
 * its margins are its own.
 *
 * `meta` is everything the fence carried after its language, `title="x"` or
 * `lineNumbers`, kept as one string and never rendered, so a fence that opens
 * in the editor prints back with the same header and the same tab it had.
 *
 * The colours are Shiki's, painted as ProseMirror decorations over the text
 * rather than as markup, which is the only way to highlight something a caret
 * also lives in. The themes are read from the site's own config rather than
 * named here, because the build reads the same value: one setting is what
 * makes a fence being written and the same fence after a deploy the same
 * colours, and two would be a drift waiting to happen.
 */
export const MermaidBlock = CodeBlockShiki.extend({
  addAttributes() {
    return { ...this.parent?.(), meta: { default: null, rendered: false } };
  },

  addNodeView() {
    const canvas = ReactNodeViewRenderer(MermaidBlockView, { stopEvent: () => true });
    const written = ReactNodeViewRenderer(CodeBlockView, { className: "contents" });

    return (props) => (props.node.attrs.language === "mermaid" ? canvas(props) : written(props));
  },
}).configure({ themes: CODE_THEME });
