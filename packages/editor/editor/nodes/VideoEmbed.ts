import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import VideoEmbedView from "./VideoEmbedView";

/**
 * The `<VideoEmbed url="…" />` block, as an atom holding just the link.
 *
 * The block is a single attribute, so there is nothing to type into it and
 * nothing to lose: the node view offers a link field, and the bridge prints the
 * tag back. A url the site cannot show, anything that is not YouTube, is still
 * kept verbatim, because the file said it and a save should not quietly rewrite
 * what somebody wrote by hand.
 *
 * The `srcIndex`, `srcStart` and `srcEnd` attributes come from the shared
 * `blockOrigin` extension in `../extensions`, not from here.
 */
export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      url: { default: "", rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-video-embed]",
        getAttrs: (element) => ({
          url: element.getAttribute("data-video-embed") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-video-embed": node.attrs.url })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedView);
  },
});
