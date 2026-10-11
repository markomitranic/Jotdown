/**
 * The Shiki themes a code block is coloured with, light mode and dark.
 *
 * A Shiki theme maps a token to a colour as the code is parsed, so this cannot
 * be a token of the project's theme: a stylesheet can only repaint what the
 * highlighter already decided. The rendered page and the editor both read this
 * one value, so a fence being written and the same fence after a save cannot
 * come out different colours.
 */
export const CODE_THEME = { light: "catppuccin-latte", dark: "catppuccin-mocha" } as const;
