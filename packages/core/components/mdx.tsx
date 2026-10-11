import type { ComponentProps } from "react";
import Link from "fumadocs-core/link";
import type { MDXComponents } from "mdx/types";
import FileAttachment from "@jotdown/core/components/blocks/FileAttachment";
import VideoEmbed from "@jotdown/core/components/blocks/VideoEmbed";
import LinkEmbed from "@jotdown/core/components/blocks/LinkEmbed";
import DocImage from "@jotdown/core/components/blocks/DocImage";
import Table from "@jotdown/core/components/blocks/Table";
import JdFigure from "@jotdown/core/components/blocks/JdFigure";
import Chart from "@jotdown/core/components/blocks/Chart";
import { Mermaid } from "@jotdown/core/components/blocks/Mermaid";
import { Fence } from "@jotdown/core/components/blocks/Fence";
import { Whiteboard } from "@jotdown/core/components/blocks/Whiteboard";
import {
  ChangelogRelease,
  ChangelogSection,
  ChangelogTimeline,
} from "@jotdown/core/components/blocks/changelog/Timeline";
import { CalloutContainer, CalloutDescription, CalloutTitle } from "@jotdown/core/components/blocks/Callout";
import { Accordion, Accordions } from "@jotdown/core/components/blocks/Accordions";
import { Card, Cards } from "@jotdown/core/components/blocks/Cards";
import {
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
} from "@jotdown/core/components/blocks/CodeBlock";
import { File, Files, Folder } from "@jotdown/core/components/blocks/Files";
import { Heading } from "@jotdown/core/components/blocks/Heading";
import { Step, Steps } from "@jotdown/core/components/blocks/Steps";
import { Tab, Tabs } from "@jotdown/core/components/blocks/Tabs";

/**
 * Components every document can use without importing them, as a reader sees them.
 *
 * MDX resolves a capitalised tag against this map. Keep the list short: each
 * entry is a tag an author has to know exists, and the block list in the
 * blocks skill has to grow with it.
 *
 * Most of them are never typed by hand, because a remark plugin in
 * `source.config.ts` writes them and this map is where that rewrite finds
 * something to render. A `:::note` becomes the three Callout tags, a ```mermaid
 * fence becomes `<Mermaid />`, and a `<figure className="jd-fig">` becomes
 * `JdFigure`, which marks a hand-drawn figure as one the fullscreen stage opens.
 * `img` is the markdown image, taken over so a screenshot arrives framed and
 * capped, and `table` is a scrolling table with a widened table's width on its
 * box. Headings link to themselves, and fences written side by side with
 * `tab="…"` arrive as the four `CodeBlockTab` tags. The three `Changelog` tags are never typed at all: a page carrying
 * `changelog: true` in its front matter is cut into them by `remarkChangelog`.
 *
 * An app that edits pages passes its own editable blocks in `components`,
 * each drawing the same markup as the one it replaces.
 *
 * @example getMDXComponents({ a: Link }); // the reading map with links swapped
 */
export function getMDXComponents(components?: MDXComponents) {
  return {
    a: Link,
    h1: (props: ComponentProps<"h1">) => <Heading as="h1" {...props} />,
    h2: (props: ComponentProps<"h2">) => <Heading as="h2" {...props} />,
    h3: (props: ComponentProps<"h3">) => <Heading as="h3" {...props} />,
    h4: (props: ComponentProps<"h4">) => <Heading as="h4" {...props} />,
    h5: (props: ComponentProps<"h5">) => <Heading as="h5" {...props} />,
    h6: (props: ComponentProps<"h6">) => <Heading as="h6" {...props} />,
    CodeBlockTabs,
    CodeBlockTabsList,
    CodeBlockTabsTrigger,
    CodeBlockTab,
    Tabs,
    Tab,
    Steps,
    Step,
    Files,
    Folder,
    File,
    Cards,
    Card,
    Accordions,
    Accordion,
    pre: Fence,
    img: DocImage,
    table: Table,
    JdFigure,
    Chart,
    CalloutContainer,
    CalloutTitle,
    CalloutDescription,
    FileAttachment,
    VideoEmbed,
    LinkEmbed,
    Mermaid,
    Whiteboard,
    ChangelogTimeline,
    ChangelogRelease,
    ChangelogSection,
    ...components,
  } satisfies MDXComponents;
}

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
