import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ImageView from "./ImageView";

/**
 * The image node, drawn from a local file or the page's own address while one is standing in for it.
 *
 * Only the node view sees the substitution. The `src` attribute, and so the
 * markdown and anything copied out of the editor, is always the committed
 * path, so neither a save nor a paste can carry a `blob:` URL into a file.
 */
export const PreviewImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
