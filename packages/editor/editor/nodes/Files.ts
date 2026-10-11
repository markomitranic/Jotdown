import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FilesView, FileView, FolderView } from "./FilesView";

/**
 * The `<Files>` wrapper, a directory drawing made of rows rather than prose.
 *
 * Nothing rides on the wrapper, so a `<Files>` in a file carrying any prop is
 * saying something this node cannot hold and goes inert instead. What it holds
 * is files and folders, and a folder holds the same, all the way down.
 *
 * `srcIndex`, `srcStart` and `srcEnd` come from the shared `blockOrigin`
 * extension in `../extensions`, not from here.
 */
export const Files = Node.create({
  name: "files",
  group: "block",
  content: "(file | folder)+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-files]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-files": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FilesView);
  },
});

/**
 * One folder, holding any number of files and folders, including none.
 *
 * `open` is the `defaultOpen` of `Folder`, which is a real part of the file rather
 * than a way of peeking: the editor always shows a folder's contents, and the
 * icon on its row is what turns that prop on. A collapsed folder in the editor
 * would hide rows from the person arranging them.
 */
export const Folder = Node.create({
  name: "folder",
  content: "(file | folder)*",
  defining: true,

  addAttributes() {
    return {
      name: { default: "", rendered: false },
      open: { default: false, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-folder]",
        getAttrs: (element) => ({
          name: element.getAttribute("data-folder") ?? "",
          open: element.hasAttribute("data-folder-open"),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-folder": node.attrs.name,
        ...(node.attrs.open === true ? { "data-folder-open": "" } : {}),
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FolderView);
  },
});

/** One file: a name on a row, and nothing else the node can hold. */
export const FileEntry = Node.create({
  name: "file",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return { name: { default: "", rendered: false } };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-file]",
        getAttrs: (element) => ({ name: element.getAttribute("data-file") ?? "" }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-file": node.attrs.name })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileView);
  },
});
