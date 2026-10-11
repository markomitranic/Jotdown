/**
 * Swaps the page's project brand for another stylesheet, and returns how to swap back.
 *
 * Every brand sheet showing now is switched off rather than overridden, so a
 * token the new stylesheet leaves out really falls back to the framework's
 * default. Swapping back turns on only the sheets this swap turned off, so two
 * swaps on top of each other, a draft theme and a project opening, undo cleanly.
 * With no stylesheet, the page wears the framework's default brand.
 *
 * @example const takeOff = wearBrand(":root { --primary: #2b2c30 }"); takeOff();
 */
export function wearBrand(stylesheet: string | null) {
  const worn = [...document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>("[data-project-brand]")].filter(
    (sheet) => !sheet.disabled,
  );
  for (const sheet of worn) sheet.disabled = true;

  const borrowed = stylesheet ? document.createElement("style") : null;
  if (borrowed) {
    borrowed.textContent = stylesheet;
    borrowed.dataset.projectBrand = "";
    document.body.append(borrowed);
  }

  return () => {
    borrowed?.remove();
    for (const sheet of worn) sheet.disabled = false;
  };
}
