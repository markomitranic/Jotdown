import { diffLines } from "diff";

/** Builds bounded line changes for display, leaving the original restore text untouched.
 * @example compareMarkdown("old\n", "new\n"); // removed and added lines
 */
export function compareMarkdown(before: string, after: string) {
  const oldText = before.replace(/\r\n/g, "\n");
  const newText = after.replace(/\r\n/g, "\n");
  if (
    oldText.length > 1_000_000 ||
    newText.length > 1_000_000 ||
    oldText.split("\n").length > 20_000 ||
    newText.split("\n").length > 20_000
  )
    return null;

  const changes = diffLines(oldText, newText, { timeout: 100, maxEditLength: 2000 });
  if (!changes) return null;
  let beforeLine = 0;
  let afterLine = 0;
  let added = 0;
  let removed = 0;
  const rows = changes.flatMap((change) => {
    const kind = change.added ? "added" : change.removed ? "removed" : "same";
    const lines = change.value.split("\n");
    if (lines.at(-1) === "") lines.pop();
    return lines.map((text) => {
      if (kind !== "added") beforeLine += 1;
      if (kind !== "removed") afterLine += 1;
      if (kind === "added") added += 1;
      if (kind === "removed") removed += 1;
      return { kind, text, before: kind === "added" ? null : beforeLine, after: kind === "removed" ? null : afterLine };
    });
  });
  return { rows, added, removed };
}
