import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import LinkEmbedView from "./LinkEmbedView";

/**
 * The `<LinkEmbed url="…" … />` block, as an atom holding what the card shows.
 *
 * `unfurl` is the one attribute the file never sees. A link pasted or typed in
 * this session carries it until its page has been read, which is how the view
 * knows to read it, and how a tag written by hand is left as it was written
 * rather than fetched and rewritten the moment somebody opens the page.
 *
 * Every printed attribute is also a data attribute, because that DOM is what a
 * copy and paste inside the editor round-trips through.
 */
export const LinkEmbed = Node.create({
  name: "linkEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      url: { default: "", rendered: false },
      title: { default: "", rendered: false },
      description: { default: "", rendered: false },
      site: { default: "", rendered: false },
      image: { default: "", rendered: false },
      favicon: { default: "", rendered: false },
      unfurl: { default: false, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-link-embed]",
        getAttrs: (element) => ({
          url: element.getAttribute("data-link-embed") ?? "",
          title: element.getAttribute("data-title") ?? "",
          description: element.getAttribute("data-description") ?? "",
          site: element.getAttribute("data-site") ?? "",
          image: element.getAttribute("data-image") ?? "",
          favicon: element.getAttribute("data-favicon") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-link-embed": node.attrs.url,
        "data-title": node.attrs.title,
        "data-description": node.attrs.description,
        "data-site": node.attrs.site,
        "data-image": node.attrs.image,
        "data-favicon": node.attrs.favicon,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkEmbedView);
  },
});
