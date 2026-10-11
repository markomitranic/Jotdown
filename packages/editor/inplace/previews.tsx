"use client";

/**
 * What each block looks like before it is chosen, for the card beside the block menus.
 *
 * A block that is only typography is drawn by the very component the page
 * draws it with, filled with a few words of sample content, so a restyled
 * callout or a project's brand reaches its preview without anybody touching
 * it. A block that needs an upload, a request or a heavy library to draw is
 * sketched instead, painted with the same tokens, so it still follows the
 * brand and the colour mode.
 */

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Accordion, Accordions } from "@jotdown/core/components/blocks/Accordions";
import { Card, Cards } from "@jotdown/core/components/blocks/Cards";
import { File, Files, Folder } from "@jotdown/core/components/blocks/Files";
import { Step, Steps } from "@jotdown/core/components/blocks/Steps";
import { Tab, Tabs } from "@jotdown/core/components/blocks/Tabs";
import { CalloutContainer, CalloutDescription, CalloutTitle } from "@jotdown/core/components/blocks/Callout";
import FileAttachment from "@jotdown/core/components/blocks/FileAttachment";
import { Fence } from "@jotdown/core/components/blocks/Fence";
import { LinkCard } from "@jotdown/core/components/blocks/LinkEmbed";
import Table from "@jotdown/core/components/blocks/Table";
import type { InplaceBlock } from "./slash";
import type { TurnKind } from "./turn";

/** Every block a menu can offer, by the name the menu knows it by. */
export type PreviewKind = InplaceBlock | TurnKind | "image" | "file" | "markdown";

type Preview = { about: string; sample: ReactNode };

const CARD_WIDTH = 296;
const GAP = 8;
const EDGE = 8;

export const PREVIEWS: Record<PreviewKind, Preview> = {
  paragraph: {
    about: "Plain running text, the most of any page.",
    sample: (
      <p>
        Most of a page is text like this, with <strong>bold</strong>, <em>italic</em> and <code>code</code> where it
        helps the reader.
      </p>
    ),
  },
  heading2: {
    about: "A section of the page, listed in its contents.",
    sample: (
      <>
        <h2>Getting started</h2>
        <p>Everything a newcomer needs on their first day.</p>
      </>
    ),
  },
  heading3: {
    about: "A part of a section.",
    sample: (
      <>
        <h3>Environments</h3>
        <p>Where each branch is deployed, and who can reach it.</p>
      </>
    ),
  },
  heading4: {
    about: "A small heading inside a part.",
    sample: (
      <>
        <h4>Staging</h4>
        <p>Rebuilt from main on every merge.</p>
      </>
    ),
  },
  bulletList: {
    about: "Items in no particular order.",
    sample: (
      <ul>
        <li>Clone the repository</li>
        <li>Copy the example environment</li>
        <li>Start the dev server</li>
      </ul>
    ),
  },
  orderedList: {
    about: "Items that happen in order.",
    sample: (
      <ol>
        <li>Open a pull request</li>
        <li>Wait for the checks</li>
        <li>Merge once approved</li>
      </ol>
    ),
  },
  blockquote: {
    about: "Set a passage apart, often somebody else's words.",
    sample: (
      <blockquote>
        <p>Design is not just what it looks like and feels like. Design is how it works.</p>
      </blockquote>
    ),
  },
  codeBlock: {
    about: "Code, monospaced and copyable.",
    sample: (
      <Fence title="setup.sh">
        <code>
          <span className="line">bun install</span>
          {"\n"}
          <span className="line">bun run dev --port 3001</span>
        </code>
      </Fence>
    ),
  },
  callout: {
    about: "Draw the reader's eye to something they must not miss.",
    sample: callout("note", "Note", "Every save is a commit, so nothing is ever lost."),
  },
  note: {
    about: "A side remark worth reading.",
    sample: callout("note", "Note", "Every save is a commit, so nothing is ever lost."),
  },
  tip: {
    about: "A better way to do something.",
    sample: callout("tip", "Tip", "Press / on an empty line to insert any block."),
  },
  info: {
    about: "Background the reader may want.",
    sample: callout("info", "Info", "The studio rebuilds the page as soon as you save."),
  },
  warning: {
    about: "Something that can go wrong.",
    sample: callout("warning", "Warning", "Rotating the key signs every editor out."),
  },
  caution: {
    about: "Proceed carefully.",
    sample: callout("warning", "Caution", "This step cannot be undone from the studio."),
  },
  danger: {
    about: "Something that breaks things or loses data.",
    sample: callout("danger", "Danger", "Never commit the production database URL."),
  },
  source: {
    about: "Where a claim or a pattern comes from.",
    sample: callout("source", "Source", "Refactoring, Martin Fowler, 2018."),
  },
  horizontalRule: {
    about: "A line between two parts of a page.",
    sample: (
      <>
        <p>The end of one thought.</p>
        <hr className="my-5!" />
        <p>The start of the next.</p>
      </>
    ),
  },
  table: {
    about: "Rows and columns, for facts that line up.",
    sample: (
      <Table>
        <thead>
          <tr>
            <th>Environment</th>
            <th>Branch</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Production</td>
            <td>main</td>
          </tr>
          <tr>
            <td>Staging</td>
            <td>next</td>
          </tr>
        </tbody>
      </Table>
    ),
  },
  accordions: {
    about: "Panels a reader opens when they need them.",
    sample: (
      <Accordions type="single">
        <Accordion title="Who can edit a page?">Anyone with access to the repository.</Accordion>
        <Accordion title="Where are uploads kept?">Beside the page, in git.</Accordion>
      </Accordions>
    ),
  },
  steps: {
    about: "A procedure, one numbered step at a time.",
    sample: (
      <Steps>
        <Step>
          <h4>Install</h4>
          <p>Run the installer once.</p>
        </Step>
        <Step>
          <h4>Sign in</h4>
          <p>Use your GitHub account.</p>
        </Step>
      </Steps>
    ),
  },
  tabs: {
    about: "One thing, written several ways.",
    sample: (
      <Tabs items={["bun", "npm"]}>
        <Tab value="bun">
          <code>bun add @jotdown/cli</code>
        </Tab>
        <Tab value="npm">
          <code>npm install @jotdown/cli</code>
        </Tab>
      </Tabs>
    ),
  },
  cards: {
    about: "A hand-picked set of links to other pages.",
    sample: (
      <Cards>
        <Card title="Quick start" description="Running in five minutes." />
        <Card title="Deploying" description="Publish to Vercel." />
      </Cards>
    ),
  },
  files: {
    about: "A directory, drawn as a tree.",
    sample: (
      <Files>
        <Folder name="app" defaultOpen>
          <File name="layout.tsx" />
          <File name="page.tsx" />
        </Folder>
        <File name="package.json" />
      </Files>
    ),
  },
  linkEmbed: {
    about: "A link drawn as a card with the page's title.",
    sample: (
      <LinkCard
        url="https://fumadocs.dev"
        title="Fumadocs"
        description="The documentation framework every page here is built on."
      />
    ),
  },
  file: {
    about: "A file the reader can download.",
    sample: (
      <FileAttachment href="#" name="onboarding.pdf" size="248193" note="Everything from the first day, on one page." />
    ),
  },
  image: {
    about: "A picture or a screenshot, uploaded with the page.",
    sample: <ImageSketch />,
  },
  videoEmbed: {
    about: "A YouTube video, played on the page.",
    sample: <VideoSketch />,
  },
  mermaid: {
    about: "A flowchart, kept as text and drawn for you.",
    sample: <DiagramSketch />,
  },
  whiteboard: {
    about: "A freehand drawing, made in Excalidraw.",
    sample: <WhiteboardSketch />,
  },
  markdown: {
    about: "Markdown from the clipboard, turned into blocks.",
    sample: <MarkdownSketch />,
  },
};

function callout(type: string, title: string, body: string) {
  return (
    <CalloutContainer type={type}>
      <CalloutTitle>{title}</CalloutTitle>
      <CalloutDescription>
        <p>{body}</p>
      </CalloutDescription>
    </CalloutContainer>
  );
}

/**
 * The card beside a block menu, showing the highlighted block and a line about it.
 *
 * Fixed to the window and placed by hand rather than by a popper, because it
 * must never fight the menu for focus. It reads where its row and that row's
 * menu stand on every frame while it is open, so it follows a menu that is
 * still being placed, scrolls or flips, and stays hidden while the menu has
 * no box yet. It stands to the right of the menu, or to its left where the
 * window ends, and is held inside the window from top to bottom.
 *
 * @example <BlockPreview kind="blockquote" row={highlightedRow} />
 */
export function BlockPreview({ kind, row }: { kind: PreviewKind | null; row: HTMLElement | null }) {
  const card = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = card.current;
    const menu = row?.closest<HTMLElement>("[role=menu], [role=listbox]");
    if (!element || !row || !menu) return;

    let frame = 0;
    let placed = "";
    const follow = () => {
      const place = placeBeside(menu.getBoundingClientRect(), row.getBoundingClientRect(), element.offsetHeight);
      const next = place === null ? "" : `${place.left}px ${place.top}px`;

      if (next !== placed) {
        placed = next;
        element.style.visibility = next === "" ? "hidden" : "visible";
        element.style.translate = next;
      }

      frame = requestAnimationFrame(follow);
    };

    follow();
    return () => cancelAnimationFrame(frame);
  }, [row]);

  if (kind === null || row === null) return null;

  return createPortal(
    <div
      ref={card}
      aria-hidden="true"
      inert
      className="pointer-events-none invisible fixed top-0 left-0 z-60 rounded-lg bg-popover p-1.5 pb-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
      style={{ width: CARD_WIDTH }}
    >
      <PreviewFace kind={kind} />
    </div>,
    document.body,
  );
}

/**
 * Where the card goes beside a menu, level with its row, or null while the menu has no box yet.
 *
 * @example placeBeside(menu, row, 200); // { left: 640, top: 212 }
 */
function placeBeside(menu: DOMRect, row: DOMRect, height: number) {
  if (menu.width === 0 && menu.height === 0) return null;

  const fitsRight = menu.right + GAP + CARD_WIDTH <= window.innerWidth - EDGE;
  const left = fitsRight ? menu.right + GAP : menu.left - GAP - CARD_WIDTH;
  const top = Math.min(Math.max(row.top - 6, EDGE), window.innerHeight - height - EDGE);

  return { left: Math.max(left, EDGE), top };
}

/**
 * One block's sample on its own sheet of page, with the line about it underneath.
 *
 * The sheet is a fixed height, so the card does not jump as the highlight
 * moves: a short sample sits in its middle, and a tall one is cut off and
 * faded out at the foot.
 *
 * @example <PreviewFace kind="steps" />
 */
export function PreviewFace({ kind }: { kind: PreviewKind }) {
  const { about, sample } = PREVIEWS[kind];

  return (
    <div className="flex flex-col gap-2">
      <div className="mask-b-from-80% justify-center-safe flex h-36 flex-col overflow-hidden rounded-md border border-border bg-background">
        <article className="prose prose-no-margin px-4 py-3 [zoom:0.85]">{sample}</article>
      </div>
      <p className="m-0 px-1 text-[0.8rem] text-foreground leading-snug">{about}</p>
    </div>
  );
}

/** A framed picture: hills and a sun, the shape every image placeholder has. */
function ImageSketch() {
  return (
    <svg viewBox="0 0 320 150" className="not-prose block w-full" aria-hidden="true">
      <rect x="1" y="1" width="318" height="148" rx="8" fill="var(--jd-fig-surface)" stroke="var(--jd-fig-line-soft)" />
      <circle cx="244" cy="48" r="16" fill="var(--jd-fig-accent-soft)" stroke="var(--jd-fig-accent)" />
      <path
        d="M1 132 L96 62 L160 112 L206 80 L319 140 L319 141 Q319 149 311 149 L9 149 Q1 149 1 141 Z"
        fill="var(--jd-fig-accent-soft)"
      />
      <path d="M1 132 L96 62 L160 112 L206 80 L319 140" fill="none" stroke="var(--jd-fig-accent)" strokeWidth="1.5" />
    </svg>
  );
}

/** A video frame with its play button. */
function VideoSketch() {
  return (
    <svg viewBox="0 0 320 180" className="not-prose block w-full" aria-hidden="true">
      <rect x="1" y="1" width="318" height="178" rx="8" fill="var(--jd-fig-ink)" opacity="0.88" />
      <rect x="132" y="68" width="56" height="40" rx="10" fill="var(--jd-fig-surface)" />
      <path d="M154 79 L170 88 L154 97 Z" fill="var(--jd-fig-ink)" />
      <rect x="16" y="158" width="288" height="3" rx="1.5" fill="var(--jd-fig-surface)" opacity="0.35" />
      <rect x="16" y="158" width="92" height="3" rx="1.5" fill="var(--jd-fig-accent)" />
    </svg>
  );
}

/** Three boxes joined by arrows, the way a flowchart reads. */
function DiagramSketch() {
  return (
    <svg viewBox="0 0 320 150" className="not-prose block w-full font-sans" aria-hidden="true">
      <defs>
        <marker id="preview-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--jd-fig-line)" />
        </marker>
      </defs>
      <rect x="8" y="16" width="92" height="40" rx="8" fill="var(--jd-fig-p-bg)" stroke="var(--jd-fig-p-ink)" />
      <text x="54" y="41" textAnchor="middle" fontSize="13" fill="var(--jd-fig-ink)">
        Editor
      </text>
      <rect x="220" y="16" width="92" height="40" rx="8" fill="var(--jd-fig-d-bg)" stroke="var(--jd-fig-d-ink)" />
      <text x="266" y="41" textAnchor="middle" fontSize="13" fill="var(--jd-fig-ink)">
        Studio
      </text>
      <rect x="114" y="98" width="92" height="40" rx="8" fill="var(--jd-fig-i-bg)" stroke="var(--jd-fig-i-ink)" />
      <text x="160" y="123" textAnchor="middle" fontSize="13" fill="var(--jd-fig-ink)">
        GitHub
      </text>
      <path d="M100 36 H214" stroke="var(--jd-fig-line)" strokeWidth="1.5" markerEnd="url(#preview-arrow)" />
      <path
        d="M266 56 V118 H212"
        fill="none"
        stroke="var(--jd-fig-line)"
        strokeWidth="1.5"
        markerEnd="url(#preview-arrow)"
      />
    </svg>
  );
}

/** A loose hand-drawn box, arrow and circle, as Excalidraw draws them. */
function WhiteboardSketch() {
  return (
    <svg viewBox="0 0 320 150" className="not-prose block w-full" aria-hidden="true">
      <rect x="1" y="1" width="318" height="148" rx="8" fill="var(--jd-fig-surface)" />
      <g fill="none" stroke="var(--jd-fig-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M34 42 C70 39 104 41 128 43 C130 62 129 86 127 104 C98 106 62 105 33 103 C32 82 33 61 34 42" />
        <path d="M144 74 C170 70 194 68 214 70 M204 61 L215 70 L203 79" />
        <ellipse cx="262" cy="73" rx="34" ry="30" transform="rotate(-6 262 73)" />
      </g>
      <path d="M48 64 H112 M48 80 H96" stroke="var(--jd-fig-muted)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="262" cy="73" r="9" fill="var(--jd-fig-accent-soft)" stroke="var(--jd-fig-accent)" strokeWidth="1.5" />
    </svg>
  );
}

/** Markdown on the left, the blocks it becomes on the right. */
function MarkdownSketch() {
  return (
    <div className="not-prose grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
      <pre className="m-0 rounded-md bg-muted px-2.5 py-2 font-mono text-muted-foreground text-xs leading-relaxed">
        {"## Setup\n- Clone\n- Install\n**Done**"}
      </pre>
      <span className="text-muted-foreground">→</span>
      <div className="flex flex-col gap-1 leading-snug">
        <strong className="text-base">Setup</strong>
        <span>• Clone</span>
        <span>• Install</span>
        <strong>Done</strong>
      </div>
    </div>
  );
}
