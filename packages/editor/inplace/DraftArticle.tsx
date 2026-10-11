"use client";

import { useEffect, useRef } from "react";
import { DocsBody, DocsDescription, DocsTitle } from "@jotdown/core/components/docs/page";
import { useDocTarget } from "../client/api";
import { parseMarkdown } from "../markdown/pipeline";
import { CLAIMED, SOURCE_RANGE } from "@jotdown/core/lib/source-range";
import { useInplace, type Inplace } from "./context";
import { PageDescription, PageIcon, PageTitle } from "./Fields";
import { drawBlock, drawSolo } from "./drawn";
import { planFor } from "./editor";
import { isSolo, soloFor } from "./solo";
import { mountBlock } from "./region";
import { endOfFile } from "./still";
import { peelWidth } from "@jotdown/core/lib/block-width";

/** Renders local Markdown through the existing block editors without compiling historical MDX. */
export default function DraftArticle() {
  const page = useInplace();
  const { title } = useDocTarget();
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = body.current;
    if (!page || !element) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void page.recovery.start().then(() => {
      if (!cancelled) stop = mountDraftBody(element, page);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [page]);

  if (!page) return null;
  return (
    <>
      <DocsTitle className="group/title relative flex items-center gap-3 pr-40">
        <PageIcon name={page.fields.read("icon") ?? undefined}>{null}</PageIcon>
        <PageTitle>{page.fields.read("title") ?? title}</PageTitle>
      </DocsTitle>
      <DocsDescription className="mb-4">
        <PageDescription>{page.fields.read("description") ?? undefined}</PageDescription>
      </DocsDescription>
      <DocsBody>
        <div ref={body} />
      </DocsBody>
    </>
  );
}

/** Mounts raw source slices as ordinary editable blocks after React finishes rendering. */
function mountDraftBody(element: HTMLElement, page: Inplace) {
  const blocks = parseMarkdown(page.source).children.filter((node) => node.type !== "yaml");
  const bom = page.source.startsWith("\uFEFF") ? 1 : 0;
  const slices = blocks.flatMap((node) => {
    const start = node.position?.start;
    const end = node.position?.end;
    if (start?.offset === undefined || end?.offset === undefined) return [];
    return [
      {
        stamp: `${start.line}:${start.column + (start.line === 1 ? bom : 0)}-${end.line}:${end.column + (end.line === 1 ? bom : 0)}`,
        markdown: page.source.slice(start.offset + bom, end.offset + bom),
      },
    ];
  });
  if (slices.length === 0) slices.push({ stamp: endOfFile(page.source), markdown: "" });

  const dispose = slices.map(({ stamp, markdown }) => {
    const { inner } = peelWidth(markdown);
    const plan = planFor(inner);
    const solo = soloFor(inner);
    const drawn = solo || isSolo(plan?.block.type) ? drawSolo() : plan ? drawBlock(plan.block) : drawSource(inner);
    const { flow } = drawn.elements;
    flow.setAttribute(SOURCE_RANGE, stamp);
    flow.setAttribute(CLAIMED, "1");
    element.append(flow);
    const stop = mountBlock(drawn.elements, markdown, (text) => page.draft.write(stamp, text), page, stamp, false);
    return () => {
      stop();
      drawn.release();
      flow.remove();
    };
  });

  return () => dispose.forEach((stop) => stop());
}

/** Leaves unsupported blocks visible as inert source while preserving their original text. */
function drawSource(markdown: string) {
  const divider = parseMarkdown(markdown).children[0]?.type === "thematicBreak";
  const body = document.createElement(divider ? "hr" : "pre");
  body.textContent = markdown;
  body.className = "whitespace-pre-wrap break-words";
  return { elements: { flow: body, body }, release() {} };
}
