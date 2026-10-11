/**
 * Surgical reads and writes on a raw YAML frontmatter block.
 *
 * No YAML library, and deliberately so. Parsing and re-emitting the block would
 * reorder keys and restyle every value, turning a title change into a rewrite of
 * the whole header. These functions touch one line and leave the rest of the
 * block byte-identical.
 *
 * Only the flat `key: value` form is understood, which is all a page uses.
 * Block scalars, anchors and flow collections read as null and are left alone
 * rather than half-rewritten.
 */

type Field = { index: number; prefix: string; raw: string };

/** Reads one top-level frontmatter field, unquoted, or null when absent. */
export function readFrontmatterField(frontmatter: string, key: string): string | null {
  const field = findField(frontmatter.split("\n"), key);
  return field === null ? null : unquote(field.raw);
}

/**
 * Replaces one field's value, leaving every other byte of the block alone.
 *
 * A value equal to what is already there returns the input unchanged, so saving
 * without touching the fields can never reformat the header. Null removes the
 * field, a missing field is appended just above the closing fence, and a field
 * written in a form this module cannot read is left untouched.
 */
export function patchFrontmatterField(frontmatter: string, key: string, value: string | null): string {
  const lines = frontmatter.split("\n");
  const field = findField(lines, key);
  const current = field === null ? null : unquote(field.raw);

  if (current === value) return frontmatter;

  if (field === null) {
    if (value === null) return frontmatter;
    const fence = lines.lastIndexOf("---");
    const at = fence === -1 ? lines.length : fence;
    const ending = lines[0]?.endsWith("\r") ? "\r" : "";
    return splice(lines, at, 0, `${frontmatterLine(key, value)}${ending}`);
  }

  if (current === null) return frontmatter;
  if (value === null) return splice(lines, field.index, 1);
  const ending = field.raw.endsWith("\r") ? "\r" : "";
  return splice(lines, field.index, 1, field.prefix + quote(value, field.raw) + ending);
}

/**
 * One `key: value` line, quoted only where YAML would read the value as something else.
 *
 * @example frontmatterLine("title", "Setup: the basics"); // 'title: "Setup: the basics"'
 */
export function frontmatterLine(key: string, value: string) {
  return `${key}: ${quote(value, "")}`;
}

function splice(lines: string[], at: number, remove: number, ...insert: string[]) {
  return [...lines.slice(0, at), ...insert, ...lines.slice(at + remove)].join("\n");
}

/**
 * Finds the line declaring `key` at the top level of the block.
 *
 * Indentation is the test for nesting: a key belonging to some parent mapping is
 * indented, so requiring column zero is enough to skip it.
 */
function findField(lines: string[], key: string): Field | null {
  const pattern = new RegExp(`^(${escapeForRegExp(key)}[ \\t]*:[ \\t]*)(.*)$`);

  for (const [index, line] of lines.entries()) {
    const ending = line.endsWith("\r") ? "\r" : "";
    const [, prefix, raw] = pattern.exec(ending ? line.slice(0, -1) : line) ?? [];
    if (prefix !== undefined && raw !== undefined) return { index, prefix, raw: raw + ending };
  }

  return null;
}

function escapeForRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strips YAML quoting from a raw value. Null means a form this module refuses to
 * rewrite, because the value continues onto lines it cannot see.
 */
function unquote(raw: string): string | null {
  const value = raw.trimEnd();
  if (/^[|>&*[{]/.test(value)) return null;

  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return parseDoubleQuoted(value);
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

function parseDoubleQuoted(value: string): string {
  try {
    return JSON.parse(value) as string;
  } catch {
    return value.slice(1, -1);
  }
}

/**
 * Renders a value for the right-hand side of a field.
 *
 * The style already on the line wins, so a quoted title stays quoted and its
 * diff stays one line. Quotes get added when the value would otherwise parse as
 * something other than a plain string, which is what
 * `title: "ADR 0001: Shared client-side page layout"` depends on.
 */
function quote(value: string, previous: string): string {
  if (previous.trimEnd().startsWith('"') || needsQuoting(value)) {
    return JSON.stringify(value);
  }
  return value;
}

const looksLikeNonString = /^$|^[-?:,[\]{}#&*!|>'"%@`]|^(true|false|null|yes|no|on|off|~)$|^[-+.\d]+$/i;

function needsQuoting(value: string) {
  return looksLikeNonString.test(value) || /[\n\r\t]|: | #|^\s|\s$|:$/.test(value);
}
