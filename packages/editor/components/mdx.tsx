import { createElement } from "react";
import type { ComponentType } from "react";
import type { MDXComponents } from "mdx/types";
import { getMDXComponents as readingComponents } from "@jotdown/core/components/mdx";
import { EditableWhiteboard } from "@jotdown/editor/inplace/Whiteboard";
import { EditableMermaid } from "@jotdown/editor/inplace/Mermaid";
import { Blockquote, BulletList, OrderedList, Paragraph } from "@jotdown/editor/inplace/blocks";
import { H1, H2, H3, H4, H5, H6 } from "@jotdown/editor/inplace/Heading";
import { EditableCallout } from "@jotdown/editor/inplace/Callout";
import { EditableFence } from "@jotdown/editor/inplace/Fence";
import { EditableTable } from "@jotdown/editor/inplace/Table";
import { EditableSteps } from "@jotdown/editor/inplace/Steps";
import { EditableFiles } from "@jotdown/editor/inplace/Files";
import { EditableCards } from "@jotdown/editor/inplace/Cards";
import { EditableAccordions } from "@jotdown/editor/inplace/Accordions";
import { PageDescription, PageIcon, PageTitle } from "@jotdown/editor/inplace/Fields";
import { BlockBoundary } from "@jotdown/editor/components/broken/BlockBoundary";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";

/**
 * The reading map with every block a reader can write in swapped for its editable twin.
 *
 * Each twin draws the markup of the block it replaces, on the server and
 * through hydration, and hands that same element to the editor after mount.
 * `p`, `ul`, `ol`, `blockquote`, the headings, `pre`, `table` and the five
 * layout containers are the blocks that take a caret where they stand.
 *
 * Every block that draws more than text sits in a boundary of its own, so a
 * block that throws says so where it stands and the rest of the page reads on.
 *
 * @example getMDXComponents({ a: Link }); // the editable map with links swapped
 */
export function getMDXComponents(components?: MDXComponents) {
  const blocks = readingComponents({
    Steps: EditableSteps,
    Files: EditableFiles,
    Cards: EditableCards,
    Accordions: EditableAccordions,
    pre: EditableFence,
    table: EditableTable,
    p: Paragraph,
    ul: BulletList,
    ol: OrderedList,
    blockquote: Blockquote,
    h1: H1,
    h2: H2,
    h3: H3,
    h4: H4,
    h5: H5,
    h6: H6,
    CalloutContainer: EditableCallout,
    Mermaid: EditableMermaid,
    Whiteboard: EditableWhiteboard,
    ...components,
  });

  return {
    ...blocks,
    Tabs: guarded("Tabs", blocks.Tabs),
    Steps: guarded("Steps", blocks.Steps),
    Files: guarded("Files", blocks.Files),
    Cards: guarded("Cards", blocks.Cards),
    Accordions: guarded("Accordions", blocks.Accordions),
    pre: guarded("Code", blocks.pre),
    table: guarded("Table", blocks.table),
    img: guarded("Image", blocks.img),
    JdFigure: guarded("Figure", blocks.JdFigure),
    Chart: guarded("Chart", blocks.Chart),
    CalloutContainer: guarded("Callout", blocks.CalloutContainer),
    FileAttachment: guarded("FileAttachment", blocks.FileAttachment),
    VideoEmbed: guarded("VideoEmbed", blocks.VideoEmbed),
    LinkEmbed: guarded("LinkEmbed", blocks.LinkEmbed),
    Mermaid: guarded("Mermaid", blocks.Mermaid),
    Whiteboard: guarded("Whiteboard", blocks.Whiteboard),
    ChangelogTimeline: guarded("ChangelogTimeline", blocks.ChangelogTimeline),
  };
}

/**
 * A block drawn inside its own error boundary, which names it and the line it starts on.
 *
 * @example guarded("Chart", Chart); // a Chart that cannot break its page
 */
function guarded<Props extends object>(name: string, Block: ComponentType<Props> | string) {
  return function Guarded(props: Props) {
    const range = SOURCE_RANGE in props && typeof props[SOURCE_RANGE] === "string" ? props[SOURCE_RANGE] : undefined;
    return (
      <BlockBoundary name={name} range={range}>
        {createElement(Block, props)}
      </BlockBoundary>
    );
  };
}

/**
 * The page's title, description and icon, each written where the reader sees it.
 *
 * Named one by one out of the client module, since a server module gets a
 * stand-in for each named export and nothing for an object.
 */
export const EDITABLE_FIELDS = { Title: PageTitle, Description: PageDescription, Icon: PageIcon };
