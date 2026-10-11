"use client";

import { useRef, useState, type CSSProperties, type DragEvent } from "react";
import Image from "next/image";
import { cn } from "cn";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { Button } from "@jotdown/core/components/ui/button";
import { optimizable } from "@jotdown/core/lib/images";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@jotdown/core/components/ui/item";
import {
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireItem,
} from "@jotdown/core/components/ui/questionnaire";
import { PALETTES, type Palette, type SetupAnswers } from "@/lib/setup";
import { Question } from "./Choices";
import { drawIcon } from "./icon";

type Props = {
  title: string;
  palette: SetupAnswers["palette"];
  icon: string | null;
  onPalette: (palette: SetupAnswers["palette"]) => void;
  onIcon: (icon: { base64: string; preview: string } | null) => void;
};

/**
 * A starting palette and an icon, with the docs drawn small in both modes as they will look.
 *
 * The icon is dropped or chosen, and drawn into a square straight away, so the
 * preview shows exactly what the project gets. All of it stays changeable
 * later in the config.
 *
 * @example <LookStep title="Checkout" palette="neutral" icon={null} onPalette={setPalette} onIcon={setIcon} />
 */
export function LookStep({ title, palette, icon, onPalette, onIcon }: Props) {
  const chosen = PALETTES.find((each) => each.id === palette) ?? PALETTES[0];

  return (
    <QuestionnaireItem name="look" className="gap-6">
      <Question
        title="How should they look?"
        description="A starting palette and an icon. Both can change later in the config."
      />

      <div className="grid grid-cols-2 gap-3">
        <Preview palette={chosen} mode="light" title={title} icon={icon} />
        <Preview palette={chosen} mode="dark" title={title} icon={icon} />
      </div>

      <QuestionnaireChoices aria-label="Palette" className="grid-cols-3">
        {PALETTES.map((each) => (
          <QuestionnaireChoice
            key={each.id}
            value={each.id}
            checked={each.id === palette}
            onChange={() => onPalette(each.id)}
            className="items-center"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 overflow-hidden rounded-full ring-1 ring-foreground/15"
              >
                <span className="flex-1" style={{ background: each.light.primary }} />
                <span className="flex-1" style={{ background: each.dark.primary }} />
              </span>
              <span className="truncate font-medium">{each.name}</span>
            </span>
          </QuestionnaireChoice>
        ))}
      </QuestionnaireChoices>

      <IconField icon={icon} onIcon={onIcon} />
    </QuestionnaireItem>
  );
}

/** The icon: dropped on the square or chosen with the button, and removed again. */
function IconField({ icon, onIcon }: Pick<Props, "icon" | "onIcon">) {
  const picker = useRef<HTMLInputElement>(null);
  const drawing = useMutation({ mutationFn: drawIcon, onSuccess: onIcon });
  const [over, setOver] = useState(false);

  const problem = drawing.error?.message ?? "";

  function take(file: File | undefined) {
    if (file) drawing.mutate(file);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files[0]);
  }

  return (
    <Item variant="outline">
      <ItemMedia>
        <button
          type="button"
          onClick={() => picker.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          aria-label={icon ? "Replace the icon" : "Choose an icon"}
          className={cn(
            "grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed text-muted-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
            over
              ? "border-primary bg-primary/10 text-primary"
              : "border-foreground/20 hover:border-foreground/40 hover:text-foreground",
            icon && "border-solid p-1",
          )}
        >
          {icon ? (
            <Image
              src={icon}
              alt=""
              width={40}
              height={40}
              unoptimized={!optimizable(icon)}
              className="size-full object-contain"
            />
          ) : (
            <ImagePlus className="size-5" aria-hidden="true" />
          )}
        </button>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Icon</ItemTitle>
        <ItemDescription
          className={cn(problem && "text-destructive")}
          role={problem ? "alert" : undefined}
          aria-live="polite"
        >
          {drawing.isPending
            ? "Drawing the icon…"
            : problem || "Drop a square image here. It becomes the sidebar mark and the tab icon."}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {icon && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onIcon(null)}>
            Remove
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={drawing.isPending}
          onClick={() => picker.current?.click()}
        >
          {icon ? "Replace" : "Choose an image"}
        </Button>
      </ItemActions>
      <input
        ref={picker}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          take(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </Item>
  );
}

/**
 * The docs drawn small in one mode: the sidebar with the icon and title, a heading, text, a link and a button in the palette's colours.
 */
function Preview({
  palette,
  mode,
  title,
  icon,
}: {
  palette: Palette;
  mode: "light" | "dark";
  title: string;
  icon: string | null;
}) {
  const { background, foreground, primary } = palette[mode];
  const paint = {
    "--mock-bg": background,
    "--mock-fg": foreground,
    "--mock-primary": primary,
    "--mock-line": `color-mix(in oklab, ${foreground} 13%, ${background})`,
    "--mock-soft": `color-mix(in oklab, ${foreground} 8%, ${background})`,
    "--mock-muted": `color-mix(in oklab, ${foreground} 45%, ${background})`,
  } as CSSProperties;

  return (
    <figure
      aria-label={`${palette.name} in ${mode} mode`}
      style={paint}
      className="flex aspect-[16/10] overflow-hidden rounded-lg bg-(--mock-bg) text-(--mock-fg) ring-1 ring-foreground/10"
    >
      <div className="flex w-[34%] flex-col gap-2 border-(--mock-line) border-e bg-(--mock-soft) p-2.5">
        <div className="flex items-center gap-1.5">
          {icon ? (
            <Image
              src={icon}
              alt=""
              width={64}
              height={16}
              unoptimized={!optimizable(icon)}
              className="h-4 w-auto max-w-16 shrink-0 rounded-[3px] object-contain"
            />
          ) : (
            <span className="size-4 rounded-[3px] bg-(--mock-primary)" />
          )}
          <span className="truncate font-medium text-[0.625rem]">{title || "Documentation"}</span>
        </div>
        <span className="mt-1 h-1.5 w-4/5 rounded-full bg-(--mock-primary) opacity-80" />
        <span className="h-1.5 w-3/5 rounded-full bg-(--mock-muted) opacity-50" />
        <span className="h-1.5 w-2/3 rounded-full bg-(--mock-muted) opacity-50" />
        <span className="h-1.5 w-1/2 rounded-full bg-(--mock-muted) opacity-50" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <span className="truncate font-serif text-sm leading-tight">Getting started</span>
        <span className="h-1.5 w-full rounded-full bg-(--mock-muted) opacity-40" />
        <span className="h-1.5 w-11/12 rounded-full bg-(--mock-muted) opacity-40" />
        <span className="h-1.5 w-3/4 rounded-full bg-(--mock-muted) opacity-40" />
        <span className="mt-0.5 font-medium text-(--mock-primary) text-[0.5625rem] underline underline-offset-2">
          Read the architecture
        </span>
        <span className="mt-auto self-start rounded-[4px] bg-(--mock-primary) px-2 py-1 font-medium text-(--mock-bg) text-[0.5625rem]">
          Open
        </span>
      </div>
    </figure>
  );
}
