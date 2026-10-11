import { describe, expect, it } from "vitest";
import { markdownFromHtml } from "./pasted";

describe("markdownFromHtml", () => {
  it("keeps the headings, paragraphs and lists of a page copied from a wiki", () => {
    const html = `
      <meta charset="utf-8">
      <h1>Hello, and welcome.</h1>
      <p>This documentation contains all.</p>
      <p><a href="https://dev.azure.com/handbook">The Handbook</a> presents practices.</p>
      <ul><li>One</li><li>Two</li></ul>
    `;

    expect(markdownFromHtml(html)).toBe(
      "# Hello, and welcome.\n\nThis documentation contains all.\n\n[The Handbook](https://dev.azure.com/handbook) presents practices.\n\n- One\n- Two",
    );
  });

  it("drops the empty paragraphs a wiki spaces its page with", () => {
    const html = `<h2>Title</h2><p><br></p><p><strong>Please note:</strong> in progress.</p>`;

    expect(markdownFromHtml(html)).toBe("## Title\n\n**Please note:** in progress.");
  });

  it("gives every picture a block of its own, for the paste to download", () => {
    const html = `<p><a href="https://example.com"><img src="https://example.com/logo.png" alt="Logo"></a></p><p>Before <img src="https://example.com/icon.png" alt="Icon"> after</p>`;

    expect(markdownFromHtml(html)).toBe(
      "![Logo](https://example.com/logo.png)\n\nBefore\n\n![Icon](https://example.com/icon.png)\n\nafter",
    );
  });

  it("drops a picture no browser could fetch", () => {
    expect(markdownFromHtml(`<h2>Title</h2><img src="blob:https://example.com/1f2e" alt="Logo">`)).toBe("## Title");
  });

  it("leaves a run of words to the editor's own paste", () => {
    expect(markdownFromHtml(`<span>Just <b>bold</b> words</span>`)).toBeNull();
    expect(markdownFromHtml("")).toBeNull();
  });

  it("does not bold everything Google Docs copies", () => {
    const html = `<b id="docs-internal-guid-1f2e"><p>One</p><p>Two</p></b>`;

    expect(markdownFromHtml(html)).toBe("One\n\nTwo");
  });
});
