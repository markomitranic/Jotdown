/**
 * What the wizard suggests before anybody types: a title from the repository's name.
 */

/**
 * A repository or folder name as a title: words split on dashes and underscores, the first one capitalised.
 *
 * @example suggestedTitle("checkout-web"); // "Checkout web"
 * @example suggestedTitle("docs"); // "Docs"
 */
export function suggestedTitle(name: string) {
  const words = name
    .replace(/\.git$/, "")
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .join(" ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : name;
}
