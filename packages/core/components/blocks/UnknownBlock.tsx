import type { ComponentType, ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import { Blocks } from "lucide-react";
import { SOURCE_RANGE } from "@jotdown/core/lib/source-range";

type Props = { children?: ReactNode; [SOURCE_RANGE]?: string };

/**
 * A labelled stand-in for a tag nothing here can draw, so a page using it still reads.
 *
 * It keeps the block's stamp, so the block can still be moved and deleted, and
 * shows whatever was written between its tags beneath the label.
 *
 * @example const Hero = unknownBlock("Hero"); <Hero>Welcome.</Hero>
 */
export function unknownBlock(name: string): ComponentType<Props> {
  return function UnknownBlock({ children, [SOURCE_RANGE]: stamp }: Props) {
    return (
      <div data-src-range={stamp} className="not-prose my-6 rounded-lg border border-border border-dashed px-4 py-3">
        <p className="flex items-center gap-2 text-sm">
          <Blocks className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium font-mono">{name}</span>
          <span className="text-muted-foreground">is drawn by the project's site</span>
        </p>
        {children && <div className="prose mt-2 text-muted-foreground">{children}</div>}
      </div>
    );
  };
}

/**
 * The component map with a stand-in for every tag the page's text uses that the map does not draw.
 *
 * A tag the map is missing would otherwise stop the whole page, since MDX
 * throws on the first component it cannot find.
 *
 * @example withUnknownBlocks(components, "<Hero />"); // components plus a stand-in Hero
 */
export function withUnknownBlocks<Map extends MDXComponents>(components: Map, text: string): Map {
  const used = new Set(Array.from(text.matchAll(/<([A-Z]\w*)/g), (match) => match[1] ?? ""));
  const missing = [...used].filter((name) => name && !(name in components));
  return { ...components, ...Object.fromEntries(missing.map((name) => [name, unknownBlock(name)])) };
}
