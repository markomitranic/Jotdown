/**
 * What every uneditable block wears.
 *
 * A figure, a video card, an attachment and an inert source block are all
 * atoms: a click selects the whole thing rather than putting a caret in it, and
 * the ring is what says so. The transparent border is always there so turning
 * it solid cannot shift the block by a pixel.
 */
export const ATOM = "rounded-lg border border-transparent transition-colors select-none";

/** The ring an atom wears while it is the selection. */
export const SELECTED = "border-solid border-primary ring-3 ring-primary/20";

/**
 * A field of editor chrome sitting under a card the reader also sees.
 *
 * Borderless until it is pointed at, so a block nobody is editing looks like
 * the card a reader gets rather than like a form.
 */
export const FIELD =
  "block w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-muted-foreground outline-none hover:border-border focus:border-primary";
