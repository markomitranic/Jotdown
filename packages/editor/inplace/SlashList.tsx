import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "cn";
import { BlockPreview, type PreviewKind } from "./previews";

/** One visible choice in a slash menu. */
export type SlashChoice = {
  title: string;
  hint: string;
  glyph: string;
};

type Props<T extends SlashChoice> = {
  items: T[];
  selected: number;
  query: string;
  /** The block the selected choice makes, for the preview beside the menu. */
  preview: PreviewKind | null;
  onSelect(item: T): void;
  /** Makes the choice under the pointer the selected one, as the arrow keys do. */
  onPoint(index: number): void;
};

const PANEL =
  "max-h-76 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10";

/**
 * The list face of the slash menu, with a preview of the selected block beside it.
 *
 * Keyboard state belongs to the suggestion plugin. This component only draws
 * the current choices, keeps the selected one in view, and keeps a click from
 * taking focus from the editor. The pointer picks a choice only when it really
 * moves from where it was first seen, because a list scrolled by the arrow
 * keys slides a new row under a resting pointer and the browser reports that
 * as a move.
 *
 * @example <SlashList items={items} selected={0} query="" preview="paragraph" onSelect={select} onPoint={point} />
 */
export function SlashList<T extends SlashChoice>({ items, selected, query, preview, onSelect, onPoint }: Props<T>) {
  const [row, setRow] = useState<HTMLElement | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    row?.scrollIntoView({ block: "nearest" });
  }, [row]);

  if (items.length === 0) {
    return (
      <div className={cn(PANEL, "w-70")}>
        <p className="m-0 px-3 py-2 text-muted-foreground text-sm">Nothing matches "{query}"</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn(PANEL, "w-70")} role="listbox">
        {items.map((item, index) => (
          // biome-ignore lint/a11y/useFocusableInteractive: focus stays in the editor, which moves the active option with the arrow keys
          // biome-ignore lint/a11y/useKeyWithClickEvents: the editor picks the active option with Enter, the click is for the pointer
          <div
            key={item.title}
            ref={index === selected ? setRow : undefined}
            role="option"
            aria-selected={index === selected}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
              index === selected && "bg-accent text-accent-foreground",
            )}
            onMouseDown={(event) => event.preventDefault()}
            onMouseMove={({ clientX: x, clientY: y }) => {
              const last = pointer.current;
              const moved = last !== null && (x !== last.x || y !== last.y);
              pointer.current = { x, y };
              if (moved && index !== selected) onPoint(index);
            }}
            onClick={() => onSelect(item)}
          >
            <span
              className={cn(
                "grid size-6.5 shrink-0 place-items-center rounded-md border border-border bg-muted font-mono text-[0.72rem] text-muted-foreground leading-none",
                index === selected && "border-primary text-primary",
              )}
            >
              {item.glyph}
            </span>
            <span className="flex flex-col leading-tight">
              {item.title}
              <small className="font-label text-[0.66rem] text-muted-foreground">{item.hint}</small>
            </span>
          </div>
        ))}
      </div>

      <BlockPreview kind={preview} row={row} />
    </>
  );
}
