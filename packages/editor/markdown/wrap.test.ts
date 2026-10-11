import { describe, expect, it } from "vitest";
import { fillable, rewrap, wrapAt } from "./wrap";
import { fixtures } from "../fixtures";
import { parseDocument } from "./parse";

describe("wrapAt", () => {
  it("reads the column off a file that is wrapped", () => {
    const source = [
      "An absent `from` means today and an absent `to` means three business days after `from`, so a",
      'bare call answers "when can you call me back soon?". A same-day range starts at the current',
      "time rather than midnight, since a slot that has already passed cannot be booked.",
      "",
      "The parse keeps the document and loses the wrapping, and the printer writes the space, which",
      "is why editing one word of a wrapped paragraph came back as one very long line indeed, and a",
      "diff nobody could review. That is the whole of what this measures, and nothing else at all.",
      "",
      "A third paragraph, so that there are enough continued lines here to count as a measurement",
      "rather than as a guess about one, which is what the eight-line floor in the code is about.",
      "It takes four of these before the file says anything at all about how its author writes.",
      "",
      "And a fourth, because only the lines a wrap actually produced are counted and the last line",
      "of a paragraph is not one of them, so three paragraphs of three lines each come to six and",
      "six is not enough to say anything about anybody's habits with any confidence whatsoever.",
      "",
    ].join("\n");

    expect(wrapAt(source)).toBeGreaterThan(80);
    expect(wrapAt(source)).toBeLessThanOrEqual(100);
  });

  it("says nothing about a file nobody wraps", () => {
    const long = Array.from(
      { length: 12 },
      (_, at) =>
        `Sentence number ${at}, written as one line that runs well past any column anybody would choose to wrap at, and then some more besides.`,
    );

    expect(wrapAt(long.join("\n"))).toBeNull();
  });

  it("says nothing about a file with too little prose to read", () => {
    expect(wrapAt("# Title\n\nOne line.\n")).toBeNull();
  });

  it("counts none of a fenced block's lines", () => {
    const source = ["```ts", ...Array.from({ length: 12 }, () => "const x = 1;"), "```", ""].join("\n");

    expect(wrapAt(source)).toBeNull();
  });

  it("reads this repository's own pages as wrapped at about eighty", () => {
    const page = fixtures.find((f) => f.name === "every-block.mdx");
    const column = page ? wrapAt(page.source) : null;

    if (column !== null) expect(column).toBeLessThanOrEqual(100);
  });
});

describe("rewrap", () => {
  it("fills a long line to the column and leaves a short one alone", () => {
    expect(rewrap("one two three four", 8)).toBe("one two\nthree\nfour");
    expect(rewrap("short", 80)).toBe("short");
  });

  it("keeps a list item's continuation under its own text", () => {
    expect(rewrap("- one two three four", 10)).toBe("- one two\n  three\n  four");
    expect(rewrap("1. one two three", 9)).toBe("1. one\n   two\n   three");
  });

  it("carries a quote onto every line it made", () => {
    expect(rewrap("> one two three", 9)).toBe("> one two\n> three");
  });

  it("never breaks in front of something that would open a block", () => {
    const opens = /^(?:[-*+>]\s|#{1,6}\s|\d+[.)]\s|```|---)/;

    for (const line of ["a b - c d", "a b # c d", "a b 1. c d", "a b > c d", "a b --- c d"]) {
      for (const column of [3, 4, 5, 6]) {
        const filled = rewrap(line, column).split("\n");
        expect(
          filled.some((made) => opens.test(made)),
          `${line} at ${column}`,
        ).toBe(false);
      }
    }
  });

  it("never breaks inside an image, whose alt text is a string and not prose", () => {
    const line = "An image ![some alt text here](/img/docs/a.png) in the middle of a sentence.";

    for (const column of [8, 12, 20, 40]) {
      for (const made of rewrap(line, column).split("\n")) {
        expect(made.includes("![") === made.includes(".png)"), `at ${column}: ${made}`).toBe(true);
      }
    }
  });

  it("never breaks inside a link's destination", () => {
    const line = "see [the page](./a/very/long/path/to/somewhere.mdx) now";

    for (const column of [8, 10, 16, 24, 40]) {
      for (const made of rewrap(line, column).split("\n")) {
        expect(made.includes("](") === made.includes(".mdx)"), `at ${column}: ${made}`).toBe(true);
      }
    }
  });

  it("never breaks inside a code span", () => {
    expect(rewrap("run `a b c` now", 5)).toBe("run\n`a b c`\nnow");
  });

  it("leaves a word longer than the column standing over the edge", () => {
    expect(rewrap("a https://example.test/very/long b", 5)).toBe("a\nhttps://example.test/very/long\nb");
  });

  it("touches nothing inside a fence, or a table, or a tag", () => {
    const source = [
      "```ts",
      "const oneVeryLongLine = 'that should stay exactly as long as it already is';",
      "```",
      "| a | a very long cell that would otherwise be filled onto a second line |",
      '<VideoEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" longer="still" />',
    ].join("\n");

    expect(rewrap(source, 20)).toBe(source);
  });

  it("is idempotent, so printing a block twice says the same thing", () => {
    const line = "one two three four five six seven eight nine ten eleven twelve thirteen";
    const once = rewrap(line, 20);

    expect(rewrap(once, 20)).toBe(once);
  });
});

describe("what a fill must never touch", () => {
  it("leaves a heading, a directive and a link definition as one line each", () => {
    const source = [
      "## A section heading long enough that a fill would otherwise break it in two",
      ":::warning[A label long enough that a fill would otherwise break the directive]",
      "[a key]: https://example.test/a/path/long/enough/to/be/worth/breaking/somewhere",
    ].join("\n");

    expect(rewrap(source, 20)).toBe(source);
  });

  it("never leaves a line that is only a prefix, or an empty one", () => {
    for (const line of ["one two  ", "- one two three  ", "> a b c  ", "> - one two three"]) {
      for (const column of [3, 4, 5, 8]) {
        for (const made of rewrap(line, column).split("\n")) {
          expect(made.trim(), `${JSON.stringify(line)} at ${column}`).not.toBe("");
          expect(made.replace(/^[\s>*+-]+$/, ""), `markers only: ${made}`).not.toBe("");
        }
      }
    }
  });

  it("never ends a line it made with a space, however many the author left", () => {
    const runs = ["a.   Every word after a run of three.", "one  two   three    four five"];

    for (const line of runs) {
      for (const column of [4, 6, 10, 16, 24]) {
        const made = rewrap(line, column).split("\n");

        for (const [at, one] of made.entries()) {
          if (at === made.length - 1) continue;
          expect(one.endsWith(" "), `${JSON.stringify(line)} at ${column}: ${one}`).toBe(false);
        }
      }
    }
  });
});

/**
 * The one thing a fill must never do, asked of the parser rather than of a
 * string comparison: the document a filled block parses to has to be the
 * document it parsed to before, whatever the column.
 *
 * This is the check that found the tag bug. A newline inside `title="…"` reads
 * as part of the value, so a hover tooltip written as one sentence came back
 * with a line break in the middle of it, and nothing about the markdown looked
 * wrong.
 */
describe("a fill never changes what a document says", () => {
  const shape = (markdown: string) =>
    JSON.stringify(parseDocument(markdown).doc, (key, value) =>
      key === "srcIndex" || key === "srcStart" || key === "srcEnd" ? undefined : value,
    );

  const blocks = [
    "The save writes the file back to the repository on the branch you are on.   Every block of the page reports what it now reads as, and the draft keeps the changed ones.",
    "> - https://example.test/an/extremely/long/url/that/never/breaks-at-all and then words after it",
    'Text with an <abbr title="A hover tooltip explaining a term in plain words">abbr</abbr> in it, and more words after it.',
    "Text with **bold**, *italic*, `inline code` and a [relative link](./browser-editor.mdx) in it.",
    "A sentence that says 1. and then - and then # in the middle of itself, more than once: 1. - # again.",
    "- one item long enough to wrap, with `code` and a [link](/manual/edit-locks) inside it\n- a second item",
    "> a quoted line long enough to wrap over more than one column, with a [link](./a.mdx) in it",
    ':::note\n\nA callout holding a paragraph long enough to wrap, and a fence beneath it.\n\n```ts\nconst kept = "  spaced  ";\n```\n\n:::',
  ];

  it.each(blocks)("says the same thing at every column: %s", (markdown) => {
    const was = shape(markdown);

    for (const column of [8, 12, 20, 40, 60, 80]) {
      expect(shape(rewrap(markdown, column)), `at ${column}`).toBe(was);
    }
  });

  it("is never asked about a block whose source is handed back verbatim", () => {
    const jsx = 'Text with a <VideoEmbed url="https://youtu.be/dQw4w9WgXcQ" /> tag in it.';
    const block = (parseDocument(jsx).doc.content ?? [])[0]!;

    expect(block.type).toBe("mdxBlock");
    expect(fillable(block)).toBe(false);

    const [withImage] = parseDocument("Text with an ![alt](/img/a.png) in it.").doc.content ?? [];
    expect(fillable(withImage!)).toBe(false);
    for (const type of ["codeBlock", "table", "heading", "image"]) {
      expect(fillable({ type }), type).toBe(false);
    }

    const paragraph = { type: "paragraph", content: [{ type: "text", text: "One." }] };
    const inert = { type: "mdxBlock", attrs: { source: "<Steps />", kind: "jsx" } };

    expect(fillable({ type: "admonition", content: [paragraph] })).toBe(true);
    expect(
      fillable({ type: "admonition", content: [paragraph, inert] }),
      "a callout holding a block that prints its own bytes",
    ).toBe(false);
  });
});
