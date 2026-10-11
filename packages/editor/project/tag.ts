/**
 * Rewriting a project block's opening tag, the one part of it a prop lives in.
 *
 * A block's props are edited one at a time, and each edit is written into the
 * tag as the file has it, so the prose between the tags and every other prop
 * stay exactly as they were typed. A value is always written as a string.
 */

import type { MdxJsxFlowElement } from "mdast-util-mdx";
import { parseMarkdown } from "../markdown/pipeline";

/** Where a block's opening tag is, as offsets into the block's text. */
export type OpeningTag = {
  start: number;
  end: number;
  name: string;
  /** Where a new prop is written, right before the `>` or the `/>`. */
  insertAt: number;
  selfClosing: boolean;
  element: MdxJsxFlowElement;
};

/**
 * The opening tag of the block a text starts with, or null when it does not start with a component.
 *
 * @example openingTag('<Hero title="Hi" />')?.end; // 19
 */
export function openingTag(text: string): OpeningTag | null {
  const [element] = parseMarkdown(text).children;
  if (element?.type !== "mdxJsxFlowElement" || !element.name) return null;

  const start = element.position?.start.offset ?? 0;
  const last = element.attributes.at(-1);
  const after = last?.position?.end.offset ?? start + 1 + element.name.length;
  const close = text.indexOf(">", after);
  if (close === -1) return null;

  const selfClosing = text.slice(after, close).trim() === "/";
  const insertAt = selfClosing ? text.lastIndexOf("/", close) : close;
  return { start, end: close + 1, name: element.name, insertAt, selfClosing, element };
}

/**
 * The block with one prop set to a string, added at the end of its tag when it had none.
 *
 * @example withProp('<Hero title="Hi" />', "title", "Hello"); // '<Hero title="Hello" />'
 * @example withProp("<Hero>\n\nText\n\n</Hero>", "big", "yes"); // '<Hero big="yes">\n\nText\n\n</Hero>'
 */
export function withProp(text: string, prop: string, value: string) {
  const tag = openingTag(text);
  if (tag === null) return text;

  const written = `${prop}=${literal(value)}`;
  const existing = tag.element.attributes.find(
    (attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === prop,
  );
  const at = existing?.position;
  if (at?.start.offset !== undefined && at.end.offset !== undefined)
    return text.slice(0, at.start.offset) + written + text.slice(at.end.offset);

  const before = text.slice(0, tag.insertAt).trimEnd();
  return `${before} ${written}${tag.selfClosing ? " " : ""}${text.slice(tag.insertAt)}`;
}

/**
 * The block with a first paragraph between its tags, opening a tag that closed itself.
 *
 * @example withChildren('<Hero title="Hi" />', "Welcome."); // '<Hero title="Hi">\n\nWelcome.\n\n</Hero>'
 */
export function withChildren(text: string, paragraph: string) {
  const tag = openingTag(text);
  if (tag === null) return text;

  if (tag.selfClosing)
    return `${text.slice(0, tag.insertAt).trimEnd()}>\n\n${paragraph}\n\n</${tag.name}>${text.slice(tag.end)}`;
  return `${text.slice(0, tag.end)}\n\n${paragraph}\n\n${text.slice(tag.end)}`;
}

/**
 * A string as a prop's value, quoted the way that needs no escaping.
 *
 * @example literal('Say "hi"'); // `'Say "hi"'`
 */
function literal(value: string) {
  if (!value.includes('"')) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  return `{${JSON.stringify(value)}}`;
}
