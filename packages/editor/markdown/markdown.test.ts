/**
 * The bridge is only trustworthy if edits stay small, so most of these tests
 * measure the diff rather than the output. The documents in `../fixtures` are
 * shaped like the pages the editor is pointed at, one of every block included.
 */

import { describe, expect, test } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { fixtures } from "../fixtures";
import { parseDocument } from "./parse";
import { serializeDocument } from "./serialize";

function edit(source: string, change: (nodes: JSONContent[]) => JSONContent[]) {
  const parsed = parseDocument(source);
  const nodes = change([...(parsed.doc.content ?? [])]);
  return serializeDocument(parsed, { type: "doc", content: nodes });
}

const fixture = [
  "---",
  'title: "Fixture: with a colon"',
  "icon: FlaskConical",
  "description: A fixture.",
  "sidebar_label: Fixture",
  "---",
  "",
  "import Thing from '../components/Thing';",
  "",
  "# Heading",
  "",
  "First paragraph, untouched.",
  "",
  "Second paragraph, the one we edit.",
  "",
  "- a list item",
  "- another one",
  "",
  "| a | b |",
  "| - | - |",
  "| 1 | 2 |",
  "",
  ":::warning[Required]",
  "",
  "Careful, and *emphatic*.",
  "",
  ":::",
  "",
  "<Thing prop={1} />",
  "",
  "Last paragraph with a [link](https://example.com) and `code`.",
  "",
].join("\n");

/**
 * A second fixture, shaped the way a real page is.
 *
 * `fixture` above is deliberately terse: one short line per block, which is
 * convenient and which no page in a real corpus looks like. The minimal-diff
 * machinery is all about source ranges, and a paragraph that wraps across two
 * lines is the case that catches a range off by one, so the interesting tests
 * need prose that wraps.
 *
 * This used to read three real documents out of `docs/`. That coupled the
 * framework's own tests to one site's content: the assertions named a page and
 * quoted a sentence from it, so the same tests failed in every other instance
 * and in the template, where those pages do not exist. Shaped like a real page
 * beats being one.
 */
const prose = [
  "---",
  "title: Commit signing",
  "description: Why commits are signed, and how to set it up.",
  "---",
  "",
  "An unsigned commit is not rejected, it just shows up as",
  "<mark>unverified</mark> in the history, which is enough to notice.",
  "",
  "## Why it matters",
  "",
  "- **Authenticity.** A verified signature proves the commit was created by the",
  "  person it claims to be, using a key only they control.",
  "- **Tamper evidence.** Rewriting history breaks the signature, so a force-push",
  "  over a signed commit is visible rather than silent.",
  "",
  "Run `git log --show-signature -1` once it is configured.",
  "",
  "You should see a line confirming a good SSH signature. After you push, GitHub",
  "displays a **Verified** badge next to the commit.",
  "",
  "<DocCardList",
  "  items={useDocsSidebar().items.filter((item) => item.docId !== 'index')}",
  "/>",
  "",
].join("\n");

describe("round trip", () => {
  test.each(fixtures)("$name is byte-identical with no edits", ({ source }) => {
    const parsed = parseDocument(source);
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });

  test("the fixture is byte-identical with no edits", () => {
    const parsed = parseDocument(fixture);
    expect(serializeDocument(parsed, parsed.doc)).toBe(fixture);
  });
});

describe("minimal diffs", () => {
  test("editing one paragraph moves nothing else", () => {
    const parsed = parseDocument(fixture);
    const nodes = [...(parsed.doc.content ?? [])];
    const at = nodes.findIndex((node) => node.content?.[0]?.text === "Second paragraph, the one we edit.");
    nodes[at] = { ...nodes[at], content: [{ type: "text", text: "Rewritten." }] };

    const output = serializeDocument(parsed, { type: "doc", content: nodes });

    expect(output).toBe(fixture.replace("Second paragraph, the one we edit.", "Rewritten."));
  });

  test("editing a paragraph that wraps across lines moves nothing else", () => {
    const source = prose;
    const original = "You should see a line confirming a good SSH signature.";
    const parsed = parseDocument(source);
    const nodes = [...(parsed.doc.content ?? [])];
    const at = nodes.findIndex((node) => node.content?.[0]?.text?.startsWith(original));
    nodes[at] = { ...nodes[at], content: [{ type: "text", text: "It is signed." }] };

    const output = serializeDocument(parsed, { type: "doc", content: nodes });
    const diff = differingLines(source, output);

    expect(diff).toEqual([
      "-You should see a line confirming a good SSH signature. After you push, GitHub",
      "-displays a **Verified** badge next to the commit.",
      "+It is signed.",
    ]);
  });

  test("editing one list item reprints the list and nothing outside it", () => {
    const source = prose;

    const output = edit(source, (nodes) => {
      const at = nodes.findIndex((node) => node.type === "bulletList");
      const items = [...(nodes[at]!.content ?? [])];
      items[0] = {
        ...items[0],
        content: [{ type: "paragraph", content: [{ type: "text", text: "Rewritten." }] }],
      };
      return nodes.map((node, i) => (i === at ? { ...node, content: items } : node));
    });

    expect(differingLines(source, output)).toEqual([
      "-- **Authenticity.** A verified signature proves the commit was created by the",
      "-  person it claims to be, using a key only they control.",
      "-- **Tamper evidence.** Rewriting history breaks the signature, so a force-push",
      "-  over a signed commit is visible rather than silent.",
      "+- Rewritten.",
      "+- **Tamper evidence.** Rewriting history breaks the signature, so a force-push over a signed commit is visible rather than silent.",
    ]);
  });

  test("a deleted middle block does not come back", () => {
    const output = edit(fixture, (nodes) => nodes.filter((node) => node.type !== "bulletList"));

    expect(output).not.toContain("a list item");
    expect(output).toContain("Second paragraph, the one we edit.");
    expect(output).toContain("| 1 | 2 |");
    expect(output).toBe(fixture.replace("- a list item\n- another one\n\n", ""));
  });

  test("an inserted paragraph only adds lines", () => {
    const output = edit(fixture, (nodes) => [
      ...nodes,
      { type: "paragraph", content: [{ type: "text", text: "Appended." }] },
    ]);

    expect(output).toBe(fixture.replace(/\n$/, "\n\nAppended.\n"));
  });

  test("editing the last block leaves the file ending as it was", () => {
    const withoutNewline = fixture.trimEnd();
    const output = edit(withoutNewline, (nodes) => [
      ...nodes.slice(0, -1),
      { type: "paragraph", content: [{ type: "text", text: "Done." }] },
    ]);

    expect(output.endsWith("Done.")).toBe(true);
  });
});

describe("nothing is ever lost", () => {
  test("MDX becomes inert blocks holding its source", () => {
    const parsed = parseDocument(fixture);
    const inert = (parsed.doc.content ?? []).filter((node) => node.type === "mdxBlock");

    expect(inert.map((node) => node.attrs?.kind)).toEqual(["esm", "jsx"]);
    expect(inert[0]!.attrs?.source).toBe("import Thing from '../components/Thing';");
    expect(inert[1]!.attrs?.source).toBe("<Thing prop={1} />");
  });

  test("a multi-line JSX element survives an edit to its neighbour", () => {
    const source = prose;
    const jsx = [
      "<DocCardList",
      "  items={useDocsSidebar().items.filter((item) => item.docId !== 'index')}",
      "/>",
    ].join("\n");

    const output = edit(source, (nodes) => {
      const at = nodes.findIndex((node) => node.type === "heading");
      return nodes.map((node, i) => (i === at ? { ...node, content: [{ type: "text", text: "Areas" }] } : node));
    });

    expect(output).toContain(jsx);
    expect(output).toContain("## Areas");
  });

  test("a paragraph wrapping inline JSX stays whole", () => {
    const parsed = parseDocument(prose);
    const wrapped = (parsed.doc.content ?? []).find((node) => String(node.attrs?.source ?? "").includes("<mark>"));

    expect(wrapped?.type).toBe("mdxBlock");
    expect(wrapped?.attrs?.kind).toBe("jsx");
    expect(wrapped?.attrs?.source).toBe(
      [
        "An unsigned commit is not rejected, it just shows up as",
        "<mark>unverified</mark> in the history, which is enough to notice.",
      ].join("\n"),
    );
  });

  test("an inert block with no origin still emits its source untouched", () => {
    const output = edit(fixture, (nodes) =>
      nodes.map((node) =>
        node.attrs?.kind === "jsx"
          ? {
              ...node,
              attrs: { ...node.attrs, srcIndex: null, srcStart: null, srcEnd: null },
            }
          : node,
      ),
    );

    expect(output).toBe(fixture);
  });

  test("a paragraph's hard wrapping is one text node of spaces, never breaks", () => {
    const parsed = parseDocument("---\ntitle: T\n---\n\nAlpha beta\ngamma delta\nepsilon.\n");

    expect(parsed.doc.content?.[0]?.content).toEqual([{ type: "text", text: "Alpha beta gamma delta epsilon." }]);
  });

  test("a trailing empty paragraph adds no whitespace", () => {
    const output = edit(fixture, (nodes) => [...nodes, { type: "paragraph" }]);

    expect(output).toBe(fixture);
  });

  test("a blank line at the end of the file is still there after a save", () => {
    const source = `${fixture}\n`;
    const output = edit(source, (nodes) => [
      { type: "paragraph", content: [{ type: "text", text: "Rewritten." }] },
      ...nodes.slice(1),
    ]);

    expect(output.endsWith("\n\n")).toBe(true);
  });
});

describe("editor mapping", () => {
  test("admonition labels become the title attr and come back", () => {
    const parsed = parseDocument(fixture);
    const admonition = (parsed.doc.content ?? []).find((node) => node.type === "admonition")!;

    expect(admonition.attrs?.kind).toBe("warning");
    expect(admonition.attrs?.title).toBe("Required");

    const output = edit(fixture, (nodes) =>
      nodes.map((node) =>
        node.type === "admonition"
          ? {
              ...node,
              content: [{ type: "paragraph", content: [{ type: "text", text: "Beware." }] }],
            }
          : node,
      ),
    );

    expect(differingLines(fixture, output)).toEqual(["-Careful, and *emphatic*.", "+Beware."]);
  });

  test("inline marks map both ways", () => {
    const parsed = parseDocument(fixture);
    const last = (parsed.doc.content ?? []).at(-1)!;

    expect(last.content).toEqual([
      { type: "text", text: "Last paragraph with a " },
      {
        type: "text",
        text: "link",
        marks: [{ type: "link", attrs: { href: "https://example.com", title: null } }],
      },
      { type: "text", text: " and " },
      { type: "text", text: "code", marks: [{ type: "code" }] },
      { type: "text", text: "." },
    ]);
  });

  test("adjacent text sharing a mark serialises as one span", () => {
    const output = edit(fixture, (nodes) => [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "a", marks: [{ type: "bold" }] },
          { type: "text", text: "b", marks: [{ type: "bold" }] },
          {
            type: "text",
            text: "c",
            marks: [{ type: "bold" }, { type: "italic" }],
          },
        ],
      },
    ]);

    expect(output).toContain("**ab*c***");
  });

  test("a code fence keeps its language", () => {
    const parsed = parseDocument("```ts\nconst a = 1;\n```\n");
    const block = (parsed.doc.content ?? [])[0]!;

    expect(block.type).toBe("codeBlock");
    expect(block.attrs?.language).toBe("ts");
    expect(serializeDocument(parsed, parsed.doc)).toBe("```ts\nconst a = 1;\n```\n");
  });

  test("a fence carrying a meta string keeps it, word for word", () => {
    const source = '```js title="x.js" lineNumbers\nconst a = 1;\n```\n';
    const parsed = parseDocument(source);
    const block = (parsed.doc.content ?? [])[0]!;

    expect(block.type).toBe("codeBlock");
    expect(block.attrs?.meta).toBe('title="x.js" lineNumbers');
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });

  test("Shiki's meta and line annotations survive an edit to the paragraph under them", () => {
    const fence = [
      '```ts title="source.config.ts" lineNumbers',
      "const admonitions = {",
      "  source: 'source', // [!code highlight]",
      "};",
      "```",
    ].join("\n");
    const source = `${fence}\n\nThe map above.\n`;

    const output = edit(source, (nodes) => {
      const at = nodes.findIndex((node) => node.content?.[0]?.text === "The map above.");
      nodes[at] = { ...nodes[at], content: [{ type: "text", text: "Rewritten." }] };
      return nodes;
    });

    expect(output).toBe(`${fence}\n\nRewritten.\n`);
  });

  test("an image on its own is a block, not a paragraph holding one", () => {
    const source = "Before.\n\n![a screenshot](/img/docs/ab12cd34ef567890.png)\n\nAfter.\n";
    const parsed = parseDocument(source);
    const [, image] = parsed.doc.content ?? [];

    expect(image).toMatchObject({
      type: "image",
      attrs: { src: "/img/docs/ab12cd34ef567890.png", alt: "a screenshot" },
    });
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });

  test("an uploaded image serialises as a markdown image", () => {
    const output = edit(fixture, (nodes) => [
      ...nodes,
      { type: "image", attrs: { src: "/img/docs/ff01.webp", alt: "a diagram" } },
    ]);

    expect(output).toContain("![a diagram](/img/docs/ff01.webp)");
  });

  test("a task list is a list whose items carry their checkbox", () => {
    const source = "- [x] done\n- [ ] not done\n- plain\n";
    const parsed = parseDocument(source);
    const [list] = parsed.doc.content ?? [];

    expect(list?.type).toBe("bulletList");
    expect(list?.content?.map((item) => item.attrs?.checked)).toEqual([true, false, null]);
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });

  test("ticking a to-do writes its checkbox back", () => {
    const output = edit("- [ ] Book the hairdresser\n", ([list]) => [
      { ...list, content: list?.content?.map((item) => ({ ...item, attrs: { ...item.attrs, checked: true } })) },
    ]);

    expect(output).toBe("- [x] Book the hairdresser\n");
  });
});

describe("video embeds", () => {
  const source = ["Before.", "", '<VideoEmbed url="https://youtu.be/dQw4w9WgXcQ" />', "", "After.", ""].join("\n");

  test("the tag becomes a video block and comes back unchanged", () => {
    const parsed = parseDocument(source);
    const [, video] = parsed.doc.content ?? [];

    expect(video?.type).toBe("videoEmbed");
    expect(video?.attrs?.url).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });

  test("a new video prints the tag and touches nothing else", () => {
    const result = edit(source, (nodes) => [
      ...nodes,
      { type: "videoEmbed", attrs: { url: "https://www.youtube.com/watch?v=aaaaaaaaaaa" } },
    ]);

    expect(result).toBe(`${source}\n<VideoEmbed url="https://www.youtube.com/watch?v=aaaaaaaaaaa" />\n`);
  });

  test("a video left without a link is dropped rather than printed empty", () => {
    const result = edit(source, (nodes) => [...nodes, { type: "videoEmbed", attrs: { url: "" } }]);

    expect(result).toBe(source);
  });

  test("a query string keeps its bare ampersand", () => {
    const timed = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42";
    const result = edit(source, (nodes) => [...nodes, { type: "videoEmbed", attrs: { url: timed } }]);

    expect(result).toBe(`${source}\n<VideoEmbed url="${timed}" />\n`);
    expect(parseDocument(result).doc.content?.[3]?.attrs?.url).toBe(timed);
  });

  test("a tag carrying anything else stays inert", () => {
    const odd = '<VideoEmbed url="https://youtu.be/dQw4w9WgXcQ" caption="Hi" />\n';
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });

  test("a link the site cannot show is still kept as written", () => {
    const vimeo = '<VideoEmbed url="https://vimeo.com/12345" />\n';
    const parsed = parseDocument(vimeo);

    expect(parsed.doc.content?.[0]?.type).toBe("videoEmbed");
    expect(serializeDocument(parsed, parsed.doc)).toBe(vimeo);
  });
});

describe("link embeds", () => {
  test("a pasted card prints one attribute to a line, leaving out the empty ones and the wait to be read", () => {
    const card = {
      type: "linkEmbed",
      attrs: {
        url: "https://fumadocs.dev/",
        title: 'The "docs" framework',
        site: "Fumadocs",
        image: "",
        unfurl: false,
      },
    };

    expect(edit("Before.\n", (nodes) => [...nodes, card])).toBe(
      [
        "Before.",
        "",
        "<LinkEmbed",
        '  url="https://fumadocs.dev/"',
        '  title="The &quot;docs&quot; framework"',
        '  site="Fumadocs"',
        "/>",
        "",
      ].join("\n"),
    );
  });

  test("a hand-written tag comes back unchanged, and one carrying anything else stays inert", () => {
    const written = '<LinkEmbed url="https://fumadocs.dev" />\n';
    const odd = '<LinkEmbed url="https://fumadocs.dev" theme="dark" />\n';

    expect(parseDocument(written).doc.content?.[0]?.type).toBe("linkEmbed");
    expect(serializeDocument(parseDocument(written), parseDocument(written).doc)).toBe(written);
    expect(parseDocument(odd).doc.content?.[0]?.type).toBe("mdxBlock");
  });
});

describe("file attachments", () => {
  const tag = [
    "<FileAttachment",
    '  href="/files/docs/9f2c1a.zip"',
    '  name="latency-harness.zip"',
    '  size="248193"',
    '  uploadedAt="2026-08-22"',
    "/>",
  ].join("\n");

  const source = ["Before.", "", tag, "", "After.", ""].join("\n");

  test("the tag becomes an attachment block and comes back unchanged", () => {
    const parsed = parseDocument(source);
    const [, file] = parsed.doc.content ?? [];

    expect(file?.type).toBe("fileAttachment");
    expect(file?.attrs).toMatchObject({
      href: "/files/docs/9f2c1a.zip",
      name: "latency-harness.zip",
      size: "248193",
      uploadedAt: "2026-08-22",
      note: "",
    });
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });

  test("a new attachment prints one attribute per line and touches nothing else", () => {
    const result = edit(source, (nodes) => [
      ...nodes,
      {
        type: "fileAttachment",
        attrs: {
          href: "/files/docs/aa11.pdf",
          name: "runbook.pdf",
          size: "8100",
          uploadedAt: "2026-08-22",
          note: "What to do at 3am.",
        },
      },
    ]);

    expect(result).toBe(
      source +
        [
          "",
          "<FileAttachment",
          '  href="/files/docs/aa11.pdf"',
          '  name="runbook.pdf"',
          '  size="8100"',
          '  uploadedAt="2026-08-22"',
          '  note="What to do at 3am."',
          "/>",
          "",
        ].join("\n"),
    );
  });

  test("a card left without a link is dropped rather than printed empty", () => {
    const result = edit(source, (nodes) => [
      ...nodes,
      { type: "fileAttachment", attrs: { href: "", name: "nothing.zip" } },
    ]);

    expect(result).toBe(source);
  });

  test("a note carrying a quote survives the round trip", () => {
    const note = 'The "before" export, not the fixed one.';
    const result = edit(source, (nodes) => [
      ...nodes,
      { type: "fileAttachment", attrs: { href: "/files/docs/bb22.csv", note } },
    ]);

    expect(result).toContain('note="The &quot;before&quot; export, not the fixed one."');
    expect(parseDocument(result).doc.content?.[3]?.attrs?.note).toBe(note);
  });

  test("a tag carrying an attribute the card has no room for stays inert", () => {
    const odd = '<FileAttachment href="/files/docs/9f2c1a.zip" icon="box" />\n';
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });

  test("a tag with no link at all stays inert", () => {
    const odd = '<FileAttachment name="orphan.zip" />\n';
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });
});

describe("accordions", () => {
  const source = [
    '<Accordions defaultValue="Second">',
    '  <Accordion title="First">',
    "    One body.",
    "  </Accordion>",
    "",
    '  <Accordion title="Second" id="the-second">',
    "    Another body.",
    "  </Accordion>",
    "</Accordions>",
    "",
  ].join("\n");

  test("the panels become a block and the source comes back unchanged", () => {
    const parsed = parseDocument(source);
    const [accordions] = parsed.doc.content ?? [];

    expect(accordions?.type).toBe("accordions");
    expect(accordions?.content?.map((panel) => panel.attrs)).toEqual([
      { title: "First", id: null, open: false },
      { title: "Second", id: "the-second", open: true },
    ]);
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });

  test("renaming the open panel carries defaultValue with it", () => {
    const output = edit(source, (nodes) =>
      nodes.map((node) => ({
        ...node,
        content: node.content?.map((panel, index) =>
          index === 1 ? { ...panel, attrs: { ...panel.attrs, title: "Renamed" } } : panel,
        ),
      })),
    );

    expect(differingLines(source, output)).toEqual([
      '-<Accordions defaultValue="Second">',
      '-  <Accordion title="Second" id="the-second">',
      '+<Accordions defaultValue="Renamed">',
      '+  <Accordion title="Renamed" id="the-second">',
    ]);
  });

  test("a new block prints both tags with the body between them", () => {
    const output = edit(source, (nodes) => [
      ...nodes,
      {
        type: "accordions",
        attrs: { type: null },
        content: [
          {
            type: "accordion",
            attrs: { title: "Third", id: null, open: false },
            content: [{ type: "paragraph", content: [{ type: "text", text: "Fresh." }] }],
          },
        ],
      },
    ]);

    expect(output).toBe(
      source +
        ["", "<Accordions>", '  <Accordion title="Third">', "    Fresh.", "  </Accordion>", "</Accordions>", ""].join(
          "\n",
        ),
    );
  });

  test("a panel carrying a prop the node cannot hold stays inert", () => {
    const odd = [
      "<Accordions>",
      '  <Accordion title="First" value="first">',
      "    One body.",
      "  </Accordion>",
      "</Accordions>",
      "",
    ].join("\n");
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });

  test("anything but a panel between the tags stays inert", () => {
    const odd = ["<Accordions>", "  Not a panel.", "</Accordions>", ""].join("\n");
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });
});

describe("steps", () => {
  const source = [
    "<Steps>",
    "  <Step>",
    "    ### Write the page",
    "",
    "    Create the file.",
    "  </Step>",
    "",
    "  <Step>",
    "    Run the build.",
    "  </Step>",
    "</Steps>",
    "",
  ].join("\n");

  test("the steps become a block and the source comes back unchanged", () => {
    const parsed = parseDocument(source);
    const [steps] = parsed.doc.content ?? [];

    expect(steps?.type).toBe("steps");
    expect(steps?.content?.map((step) => step.type)).toEqual(["step", "step"]);
    expect(steps?.content?.[0]?.content?.map((block) => block.type)).toEqual(["heading", "paragraph"]);
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });

  test("a new block prints both tags with the body between them", () => {
    const output = edit(source, (nodes) => [
      ...nodes,
      {
        type: "steps",
        content: [
          {
            type: "step",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Fresh." }] }],
          },
        ],
      },
    ]);

    expect(output).toBe(source + ["", "<Steps>", "  <Step>", "    Fresh.", "  </Step>", "</Steps>", ""].join("\n"));
  });

  test("a tag carrying a prop the node cannot hold stays inert", () => {
    const odd = ['<Steps className="tight">', "  <Step>", "    One.", "  </Step>", "</Steps>", ""].join("\n");
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });

  test("anything but a step between the tags stays inert", () => {
    const odd = ["<Steps>", "  Not a step.", "</Steps>", ""].join("\n");
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });
});

describe("tabs", () => {
  const source = [
    "<Tabs items={['bun', 'npm']}>",
    '  <Tab value="bun">',
    "    Run it with bun.",
    "  </Tab>",
    "",
    '  <Tab value="npm">',
    "    Run it with npm.",
    "  </Tab>",
    "</Tabs>",
    "",
  ].join("\n");

  test("the labels move onto the panels and the source comes back unchanged", () => {
    const parsed = parseDocument(source);
    const [tabs] = parsed.doc.content ?? [];

    expect(tabs?.type).toBe("tabs");
    expect(tabs?.content?.map((tab) => tab.attrs)).toEqual([{ label: "bun" }, { label: "npm" }]);
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });

  test("renaming a tab carries items with it", () => {
    const output = edit(source, (nodes) =>
      nodes.map((node) => ({
        ...node,
        content: node.content?.map((tab, index) => (index === 1 ? { ...tab, attrs: { label: "pnpm" } } : tab)),
      })),
    );

    expect(differingLines(source, output)).toEqual([
      "-<Tabs items={['bun', 'npm']}>",
      '-  <Tab value="npm">',
      "+<Tabs items={['bun', 'pnpm']}>",
      '+  <Tab value="pnpm">',
    ]);
  });

  test("a panel with no value takes its label from where it sits", () => {
    const bare = ["<Tabs items={['bun']}>", "  <Tab>", "    Run it.", "  </Tab>", "</Tabs>", ""].join("\n");
    const parsed = parseDocument(bare);

    expect(parsed.doc.content?.[0]?.content?.[0]?.attrs).toEqual({ label: "bun" });
    expect(serializeDocument(parsed, parsed.doc)).toBe(bare);
  });

  test("a new block prints items and a value on every panel", () => {
    const output = edit(source, (nodes) => [
      ...nodes,
      {
        type: "tabs",
        content: [
          {
            type: "tab",
            attrs: { label: "Server" },
            content: [{ type: "paragraph", content: [{ type: "text", text: "Fresh." }] }],
          },
        ],
      },
    ]);

    expect(output).toBe(
      source +
        ["", "<Tabs items={['Server']}>", '  <Tab value="Server">', "    Fresh.", "  </Tab>", "</Tabs>", ""].join("\n"),
    );
  });

  test("a value naming a label that is not in items stays inert", () => {
    const odd = ["<Tabs items={['bun']}>", '  <Tab value="npm">', "    Run it.", "  </Tab>", "</Tabs>", ""].join("\n");
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });

  test("fewer panels than labels stays inert", () => {
    const odd = ["<Tabs items={['bun', 'npm']}>", '  <Tab value="bun">', "    Run it.", "  </Tab>", "</Tabs>", ""].join(
      "\n",
    );
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });

  test("items the editor cannot read as a list of labels stays inert", () => {
    const odd = ["<Tabs items={managers}>", "  <Tab>", "    Run it.", "  </Tab>", "</Tabs>", ""].join("\n");
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });
});

describe("cards", () => {
  const source = [
    "<Cards>",
    '  <Card title="Browser editor" description="How a save becomes a commit." href="/site-internals/browser-editor" />',
    '  <Card title="Mermaid diagrams" href="/site-internals/mermaid-diagrams" />',
    "</Cards>",
    "",
  ].join("\n");

  test("the cards become leaves and the source comes back unchanged", () => {
    const parsed = parseDocument(source);
    const [cards] = parsed.doc.content ?? [];

    expect(cards?.type).toBe("cards");
    expect(cards?.content?.map((card) => card.attrs)).toEqual([
      {
        title: "Browser editor",
        description: "How a save becomes a commit.",
        href: "/site-internals/browser-editor",
      },
      { title: "Mermaid diagrams", description: "", href: "/site-internals/mermaid-diagrams" },
    ]);
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });

  test("retitling one card leaves the other one alone", () => {
    const output = edit(source, (nodes) =>
      nodes.map((node) => ({
        ...node,
        content: node.content?.map((card, index) =>
          index === 1 ? { ...card, attrs: { ...card.attrs, title: "Diagrams" } } : card,
        ),
      })),
    );

    expect(differingLines(source, output)).toEqual([
      '-  <Card title="Mermaid diagrams" href="/site-internals/mermaid-diagrams" />',
      '+  <Card title="Diagrams" href="/site-internals/mermaid-diagrams" />',
    ]);
  });

  test("a new block prints one card to a line, empty props left off", () => {
    const output = edit(source, (nodes) => [
      ...nodes,
      {
        type: "cards",
        content: [{ type: "card", attrs: { title: "Fresh", description: "", href: "/fresh" } }],
      },
    ]);

    expect(output).toBe(source + ["", "<Cards>", '  <Card title="Fresh" href="/fresh" />', "</Cards>", ""].join("\n"));
  });

  test("a card holding prose stays inert", () => {
    const odd = ["<Cards>", '  <Card title="One">', "    Body.", "  </Card>", "</Cards>", ""].join("\n");
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });

  test("a card carrying an icon stays inert", () => {
    const odd = ["<Cards>", '  <Card title="One" icon={<Cpu />} />', "</Cards>", ""].join("\n");
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });
});

describe("files", () => {
  const source = [
    "<Files>",
    '  <Folder name="docs" defaultOpen>',
    '    <File name="index.mdx" />',
    '    <Folder name="site-internals">',
    '      <File name="block-tests.mdx" />',
    "    </Folder>",
    "  </Folder>",
    "</Files>",
    "",
  ].join("\n");

  test("the tree becomes nested rows and the source comes back unchanged", () => {
    const parsed = parseDocument(source);
    const [files] = parsed.doc.content ?? [];

    expect(files?.type).toBe("files");

    const [root] = files?.content ?? [];
    expect(root?.attrs).toEqual({ name: "docs", open: true });
    expect(root?.content?.map((entry) => [entry.type, entry.attrs?.name])).toEqual([
      ["file", "index.mdx"],
      ["folder", "site-internals"],
    ]);
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });

  test("renaming a file deep in the tree touches its line only", () => {
    const output = edit(source, (nodes) =>
      nodes.map((node) => ({
        ...node,
        content: node.content?.map((folder) => ({
          ...folder,
          content: folder.content?.map((entry, index) =>
            index === 0 ? { ...entry, attrs: { name: "overview.mdx" } } : entry,
          ),
        })),
      })),
    );

    expect(differingLines(source, output)).toEqual([
      '-    <File name="index.mdx" />',
      '+    <File name="overview.mdx" />',
    ]);
  });

  test("a new block prints two spaces of indent to a level", () => {
    const output = edit(source, (nodes) => [
      ...nodes,
      {
        type: "files",
        content: [
          {
            type: "folder",
            attrs: { name: "app", open: false },
            content: [{ type: "file", attrs: { name: "layout.tsx" } }],
          },
        ],
      },
    ]);

    expect(output).toBe(
      source +
        ["", "<Files>", '  <Folder name="app">', '    <File name="layout.tsx" />', "  </Folder>", "</Files>", ""].join(
          "\n",
        ),
    );
  });

  test("a folder may hold nothing, and keeps its own spelling until touched", () => {
    const empty = ["<Files>", '  <Folder name="empty" />', "</Files>", ""].join("\n");
    const parsed = parseDocument(empty);

    expect(parsed.doc.content?.[0]?.content?.[0]?.content).toEqual([]);
    expect(serializeDocument(parsed, parsed.doc)).toBe(empty);

    const renamed = edit(empty, (nodes) =>
      nodes.map((node) => ({
        ...node,
        content: node.content?.map((folder) => ({
          ...folder,
          attrs: { ...folder.attrs, name: "still-empty" },
        })),
      })),
    );

    expect(renamed).toBe(["<Files>", '  <Folder name="still-empty">', "  </Folder>", "</Files>", ""].join("\n"));
  });

  test("anything but a file or a folder between the tags stays inert", () => {
    const odd = ["<Files>", "  Not a row.", "</Files>", ""].join("\n");
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });

  test("defaultOpen written as an expression stays inert", () => {
    const odd = [
      "<Files>",
      '  <Folder name="docs" defaultOpen={true}>',
      '    <File name="a.mdx" />',
      "  </Folder>",
      "</Files>",
      "",
    ].join("\n");
    const parsed = parseDocument(odd);

    expect(parsed.doc.content?.[0]?.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(odd);
  });
});

describe("tables", () => {
  const table = [
    "| Role | The job |",
    "| --- | :---: |",
    "| Gateway | One vendor |",
    "| Adapter | One endpoint |",
    "",
  ].join("\n");

  test("the first row becomes header cells and the rest do not", () => {
    const node = (parseDocument(table).doc.content ?? [])[0]!;

    expect(node.type).toBe("table");
    expect(node.content?.map((row) => row.content?.map((cell) => cell.type))).toEqual([
      ["tableHeader", "tableHeader"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
    ]);
  });

  test("column alignment rides on every cell in the column", () => {
    const node = (parseDocument(table).doc.content ?? [])[0]!;
    const aligns = node.content?.map((row) => row.content?.map((cell) => cell.attrs?.align));

    expect(aligns).toEqual([
      [null, "center"],
      [null, "center"],
      [null, "center"],
    ]);
  });

  test("editing one cell rewrites the table and nothing else", () => {
    const source = `Before.\n\n${table}\nAfter.\n`;
    const output = edit(source, (nodes) =>
      nodes.map((node) => {
        if (node.type !== "table") return node;
        const rows = [...(node.content ?? [])];
        rows[1] = {
          ...rows[1],
          content: [
            {
              type: "tableCell",
              attrs: { align: null },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Transport" }] }],
            },
            ...(rows[1]!.content ?? []).slice(1),
          ],
        };
        return { ...node, content: rows };
      }),
    );

    expect(differingLines(source, output)).toEqual(["-| Gateway | One vendor |", "+| Transport | One vendor |"]);
    expect(output).toContain("| --- | :---: |");
    expect(output).toContain("Before.");
    expect(output).toContain("After.");
  });

  test("a cell holding inline JSX takes the whole table inert", () => {
    const source = "| a | b |\n| - | - |\n| <Thing /> | 2 |\n";
    const parsed = parseDocument(source);

    expect((parsed.doc.content ?? [])[0]!.type).toBe("mdxBlock");
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });

  test("a line break in a cell is <br /> in both directions", () => {
    const source = "| a |\n| - |\n| one<br />two |\n";
    const parsed = parseDocument(source);
    const cell = parsed.doc.content?.[0]?.content?.[1]?.content?.[0];

    expect(cell?.content?.[0]?.content).toEqual([
      { type: "text", text: "one" },
      { type: "hardBreak" },
      { type: "text", text: "two" },
    ]);

    const output = edit(source, (nodes) => [...nodes]);
    expect(output).toBe(source);
  });

  test("a ragged table is squared off before the editor sees it", () => {
    const source = "| a | b |\n| - | - |\n| 1 |\n";
    const parsed = parseDocument(source);
    const widths = parsed.doc.content?.[0]?.content?.map((row) => row.content?.length);

    expect(widths).toEqual([2, 2]);
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });
});

describe("frontmatter", () => {
  test("title, icon and description are pulled out unquoted", () => {
    const parsed = parseDocument(fixture);

    expect(parsed.title).toBe("Fixture: with a colon");
    expect(parsed.icon).toBe("FlaskConical");
    expect(parsed.description).toBe("A fixture.");
    expect(parsed.frontmatter?.startsWith("---\n")).toBe(true);
    expect(parsed.frontmatter?.endsWith("\n---")).toBe(true);
  });

  test("a new title keeps its quotes and touches one line", () => {
    const parsed = parseDocument(fixture);
    const output = serializeDocument(parsed, parsed.doc, {
      title: "ADR 0001: Shared client-side page layout",
      icon: parsed.icon,
      description: parsed.description,
    });

    expect(differingLines(fixture, output)).toEqual([
      '-title: "Fixture: with a colon"',
      '+title: "ADR 0001: Shared client-side page layout"',
    ]);
  });

  test("quotes are added when a plain value gains a colon", () => {
    const source = "---\ntitle: How we build software\n---\n\nBody.\n";
    const parsed = parseDocument(source);
    const output = serializeDocument(parsed, parsed.doc, {
      title: "How: we build software",
      icon: null,
      description: null,
    });

    expect(output).toBe('---\ntitle: "How: we build software"\n---\n\nBody.\n');
  });

  test("a plain value stays unquoted", () => {
    const source = "---\ntitle: How we build software\n---\n\nBody.\n";
    const parsed = parseDocument(source);
    const output = serializeDocument(parsed, parsed.doc, {
      title: "How we ship software",
      icon: null,
      description: null,
    });

    expect(output).toBe("---\ntitle: How we ship software\n---\n\nBody.\n");
  });

  test("a missing field is appended above the closing fence", () => {
    const source = "---\ntitle: A\nsidebar_label: A\n---\n\nBody.\n";
    const parsed = parseDocument(source);
    const output = serializeDocument(parsed, parsed.doc, {
      title: "A",
      icon: null,
      description: "Added.",
    });

    expect(output).toBe("---\ntitle: A\nsidebar_label: A\ndescription: Added.\n---\n\nBody.\n");
  });

  test("an icon can be added, changed and removed", () => {
    const source = "---\ntitle: A\nicon: BookOpen\n---\n\nBody.\n";
    const parsed = parseDocument(source);
    const changed = serializeDocument(parsed, parsed.doc, {
      title: "A",
      icon: "PencilLine",
      description: null,
    });
    const reparsed = parseDocument(changed);

    expect(changed).toContain("icon: PencilLine");
    expect(
      serializeDocument(reparsed, reparsed.doc, {
        title: "A",
        icon: null,
        description: null,
      }),
    ).toBe("---\ntitle: A\n---\n\nBody.\n");
  });

  test("clearing a field removes its line", () => {
    const source = "---\ntitle: A\ndescription: Gone.\n---\n\nBody.\n";
    const parsed = parseDocument(source);
    const output = serializeDocument(parsed, parsed.doc, {
      title: "A",
      icon: null,
      description: null,
    });

    expect(output).toBe("---\ntitle: A\n---\n\nBody.\n");
  });

  test("a file with no frontmatter gets none invented", () => {
    const source = "Just a paragraph.\n";
    const parsed = parseDocument(source);

    expect(parsed.frontmatter).toBeNull();
    expect(serializeDocument(parsed, parsed.doc)).toBe(source);
  });
});

/** The added and removed lines between two texts, in the order they appear. */
function differingLines(before: string, after: string): string[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const common = new Set(beforeLines.filter((line) => afterLines.includes(line)));

  return [
    ...beforeLines.filter((line) => !common.has(line)).map((line) => `-${line}`),
    ...afterLines.filter((line) => !beforeLines.includes(line)).map((line) => `+${line}`),
  ];
}
