import { describe, expect, it } from "vitest";
import { anchorAt, locate, squash } from "./anchor";

const PAGE = squash(`
  Since the March update, organic traffic dropped 14% across the category pages.
  Product pages held steady, and organic traffic dropped 3% on the blog.
`).text;

function found(text: string, span: ReturnType<typeof locate>) {
  return span && text.slice(span.start, span.end);
}

describe("locate", () => {
  it("finds the words where they were selected", () => {
    const start = PAGE.indexOf("organic traffic dropped 14%");
    const anchor = anchorAt(PAGE, start, start + "organic traffic dropped 14%".length);

    expect(locate(PAGE, anchor)).toEqual({ start, end: anchor.quote.length + start });
  });

  it("tells repeated words apart by what surrounds them", () => {
    const second = PAGE.lastIndexOf("organic traffic dropped");
    const anchor = anchorAt(PAGE, second, second + "organic traffic dropped".length);

    expect(locate(PAGE, anchor)?.start).toBe(second);
  });

  it("follows the words when text is added around them", () => {
    const start = PAGE.indexOf("Product pages held steady");
    const anchor = anchorAt(PAGE, start, start + "Product pages held steady".length);
    const edited = PAGE.replace("Since the March update", "Since the big March core update");

    expect(found(edited, locate(edited, anchor))).toBe("Product pages held steady");
  });

  it("takes whatever now stands between the old surroundings when the words were edited", () => {
    const start = PAGE.indexOf("14%");
    const anchor = anchorAt(PAGE, start, start + "14%".length);
    const edited = PAGE.replace("14%", "fourteen percent");

    expect(found(edited, locate(edited, anchor))).toBe("fourteen percent");
  });

  it("follows edited words rather than jumping to the same words elsewhere", () => {
    const page = squash("Category pages dropped 14% since March. The blog, by contrast, dropped 14% since May.").text;
    const start = page.indexOf("14%");
    const anchor = anchorAt(page, start, start + "14%".length);
    const edited = page.replace("dropped 14% since March", "dropped 20% since March");

    expect(found(edited, locate(edited, anchor))).toBe("20%");
  });

  it("gives up when the words and their surroundings are gone", () => {
    const start = PAGE.indexOf("Product pages held steady");
    const anchor = anchorAt(PAGE, start, start + "Product pages held steady".length);

    expect(locate("A different page altogether.", anchor)).toBeNull();
  });
});
