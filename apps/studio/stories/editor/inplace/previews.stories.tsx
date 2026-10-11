import preview from "@/.storybook/preview";
import { PREVIEWS, PreviewFace, type PreviewKind } from "@jotdown/editor/inplace/previews";

const KINDS = Object.keys(PREVIEWS) as PreviewKind[];

/** Every block's preview card at once, so a restyled block or a new brand is checked in one look. */
const meta = preview.meta({
  title: "Studio/Block previews",
  render: () => (
    <div className="grid grid-cols-[repeat(auto-fill,296px)] gap-4 p-6">
      {KINDS.map((kind) => (
        <figure key={kind} className="m-0 flex flex-col gap-1.5">
          <figcaption className="font-mono text-muted-foreground text-xs">{kind}</figcaption>
          <div className="rounded-lg bg-popover p-1.5 pb-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
            <PreviewFace kind={kind} />
          </div>
        </figure>
      ))}
    </div>
  ),
});

export const Gallery = meta.story();
