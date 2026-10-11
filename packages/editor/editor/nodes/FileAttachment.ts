import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import FileAttachmentView from "./FileAttachmentView";

/**
 * The `<FileAttachment … />` block, as an atom holding what the card shows.
 *
 * The file itself is committed before the node exists, so there is no upload
 * state here and nothing half-finished to serialise. Everything on it was known
 * at that moment: the URL the endpoint answered with, and the name, size and
 * date read off the file the reader picked.
 *
 * All five attributes are written into the DOM as data attributes even though
 * nothing renders them, because that DOM is what a copy-and-paste inside the
 * editor round-trips through. Left off, a pasted card would keep its link and
 * forget everything else about itself.
 *
 * The `srcIndex`, `srcStart` and `srcEnd` attributes come from the shared
 * `blockOrigin` extension in `../extensions`, not from here.
 */
export const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      href: { default: "", rendered: false },
      name: { default: "", rendered: false },
      size: { default: "", rendered: false },
      uploadedAt: { default: "", rendered: false },
      note: { default: "", rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-file-attachment]",
        getAttrs: (element) => ({
          href: element.getAttribute("data-file-attachment") ?? "",
          name: element.getAttribute("data-name") ?? "",
          size: element.getAttribute("data-size") ?? "",
          uploadedAt: element.getAttribute("data-uploaded-at") ?? "",
          note: element.getAttribute("data-note") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-file-attachment": node.attrs.href,
        "data-name": node.attrs.name,
        "data-size": node.attrs.size,
        "data-uploaded-at": node.attrs.uploadedAt,
        "data-note": node.attrs.note,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentView);
  },
});
