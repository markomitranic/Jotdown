import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CardsView, CardView } from "./CardsView";

/**
 * The `<Cards>` wrapper, which holds cards and nothing else.
 *
 * Nothing rides on the wrapper itself: it is a two-column grid and the cards
 * inside it are the whole block. So a `<Cards>` in a file carrying any prop at
 * all is saying something this node cannot hold, and goes inert instead.
 *
 * `srcIndex`, `srcStart` and `srcEnd` come from the shared `blockOrigin`
 * extension in `../extensions`, not from here.
 */
/**
 * The grid of cards.
 *
 * The element Tiptap hosts the view in is made transparent, because the grid
 * is the element around it, the build's or the view's, and a grid whose only
 * item is that host would put every card in one cell.
 */
export const Cards = Node.create({
  name: "cards",
  group: "block",
  content: "card+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-cards]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-cards": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardsView, { className: "contents" });
  },
});

/**
 * One card: a title, a line about it, and where it goes.
 *
 * An atom, because a card is three short strings rather than a container of
 * prose. The core also renders children inside a card, and a `<Card>` in a file
 * that has any takes its whole block inert rather than losing them.
 *
 * All three are written into the DOM as data attributes even though nothing
 * renders them, because that DOM is what a copy-and-paste inside the editor
 * round-trips through. Left off, a pasted card would arrive blank. The title is
 * what the parse rule matches on rather than a bare `data-card`, which is the
 * attribute the core's rendered card already carries.
 */
export const Card = Node.create({
  name: "card",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      title: { default: "", rendered: false },
      description: { default: "", rendered: false },
      href: { default: "", rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-card-title]",
        getAttrs: (element) => ({
          title: element.getAttribute("data-card-title") ?? "",
          description: element.getAttribute("data-card-description") ?? "",
          href: element.getAttribute("data-card-href") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-card-title": node.attrs.title,
        "data-card-description": node.attrs.description,
        "data-card-href": node.attrs.href,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardView);
  },
});
