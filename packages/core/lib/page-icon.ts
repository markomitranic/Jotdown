import { createElement } from "react";
import * as lucide from "lucide-react";

const CURRENT_ICONS = new Set<unknown>(Object.values(lucide.icons));

/**
 * Every name Lucide exports an icon under: current names and the old ones it keeps as aliases.
 *
 * Lucide's `icons` map holds current names only, so a page written before a
 * rename, `FileCode2` for `FileCodeCorner`, would otherwise lose its icon.
 */
const LUCIDE_ICONS = new Map(
  Object.entries(lucide).filter((entry): entry is [string, lucide.LucideIcon] => CURRENT_ICONS.has(entry[1])),
);

/**
 * Resolves the Lucide name stored in document metadata into its icon, old names included.
 *
 * @example resolvePageIcon("BookOpen"); // <BookOpen />
 * @example resolvePageIcon("FileCode2"); // <FileCodeCorner />
 * @example resolvePageIcon("NoSuchIcon"); // undefined
 */
export function resolvePageIcon(name: string | undefined) {
  const icon = name ? LUCIDE_ICONS.get(name) : undefined;

  return icon && createElement(icon);
}
