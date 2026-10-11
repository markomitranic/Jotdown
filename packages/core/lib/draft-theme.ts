/**
 * Wears a draft theme's stylesheet in place of the project's own, or takes it off again with null.
 *
 * The project's stylesheet is switched off rather than overridden, so a token
 * the draft leaves out really falls back instead of keeping its saved colour.
 * The studio wears a settings draft this way, and so does a site's canvas when
 * the studio sends it one.
 *
 * @example wearDraftTheme(".dark { --primary: #b9acff; }"); // the page repaints
 * @example wearDraftTheme(null); // the project's own theme again
 */
export function wearDraftTheme(css: string | null) {
  document.querySelector("style[data-draft-theme]")?.remove();
  for (const style of document.querySelectorAll<HTMLStyleElement>("style[data-project-brand]")) {
    if (style.sheet) style.sheet.disabled = css !== null;
  }
  if (css === null) return;

  const style = document.createElement("style");
  style.dataset.draftTheme = "";
  style.textContent = css;
  document.head.append(style);
}
