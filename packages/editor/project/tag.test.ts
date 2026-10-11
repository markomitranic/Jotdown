import { describe, expect, it } from "vitest";
import { stampAt, rangeIn } from "@jotdown/core/lib/source-range";
import { openingTag, withChildren, withProp } from "./tag";

describe("withProp", () => {
  it("replaces a prop where it is written", () => {
    expect(withProp('<Hero title="Hi" big />', "title", "Hello")).toBe('<Hero title="Hello" big />');
  });

  it("adds a missing prop at the end of the tag", () => {
    expect(withProp("<Hero />", "title", "Hi")).toBe('<Hero title="Hi" />');
    expect(withProp("<Hero>\n\nText\n\n</Hero>", "title", "Hi")).toBe('<Hero title="Hi">\n\nText\n\n</Hero>');
  });

  it("quotes a value carrying quotes so it still parses", () => {
    const written = withProp("<Hero />", "title", `It's "here"`);
    expect(openingTag(written)?.element.attributes).toHaveLength(1);
  });
});

describe("withChildren", () => {
  it("opens a self-closing tag around the first paragraph", () => {
    expect(withChildren('<Hero title="Hi" />', "Welcome.")).toBe('<Hero title="Hi">\n\nWelcome.\n\n</Hero>');
  });

  it("writes into an empty element", () => {
    expect(withChildren("<Hero></Hero>", "Welcome.")).toBe("<Hero>\n\nWelcome.\n\n</Hero>");
  });
});

describe("stampAt", () => {
  it("is the reverse of rangeIn", () => {
    const source = '# Hi\n\n<Hero title="x">\n\nText\n\n</Hero>\n';
    const stamp = stampAt(source, 6, 23);
    expect(rangeIn(source, stamp)).toEqual({ start: 6, end: 23 });
  });
});
