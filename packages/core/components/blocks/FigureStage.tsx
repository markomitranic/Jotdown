"use client";

import { useEffect, useState } from "react";
import DiagramStage from "@jotdown/core/components/blocks/mermaid/DiagramStage";
import { copyFromButton } from "@jotdown/core/lib/image-file";

type Staged = { markup: string; caption?: string; variant: "figure" | "image"; original?: string };

/**
 * Opens any stageable figure or image on the page in the fullscreen stage, and copies an image.
 *
 * One listener on the document, rather than one per figure, because the
 * in-page editor copies a block's markup when it is duplicated or moved, and a
 * copy has no React behind it. A figure is handed over as its own SVG, so it
 * paints with the same `--jd-fig-*` tokens and follows the colour mode; an
 * image as a fresh copy of its original file, sized to that file's pixels and
 * opened once it has loaded. The caption is shown under either.
 *
 * @example <FigureStage />
 */
export default function FigureStage() {
  const [staged, setStaged] = useState<Staged | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const copy = event.target.closest<HTMLElement>("[data-copy-image]");
      if (copy?.dataset.copyImage) return void copyFromButton(copy, copy.dataset.copyImage);

      const figure = stagedFigure(event.target);
      if (figure) return setStaged(figure);

      void stagedImage(event.target).then((image) => image && setStaged(image));
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!staged) return null;

  return (
    <DiagramStage
      svg={staged.markup}
      caption={staged.caption}
      variant={staged.variant}
      original={staged.original}
      onClose={() => setStaged(null)}
    />
  );
}

/** The drawing and hidden caption of a `jd-fig` clicked anywhere but one of its own links. */
function stagedFigure(target: Element): Staged | null {
  const figure = target.closest(".jd-fig--stage");
  const drawing = figure?.querySelector("svg");
  if (!figure || !drawing) return null;

  const control = target.closest("a, button");
  if (control && !control.matches(".jd-fig__hint")) return null;

  const caption = figure.querySelector("figcaption")?.textContent?.trim();
  return { markup: drawing.outerHTML, caption, variant: "figure" };
}

/**
 * A clicked markdown image as its original file, with the caption written under it.
 *
 * In dark mode an SVG's night copy is the one showing, so that is the one staged.
 *
 * The original is loaded before the stage opens, with the picture marked
 * `data-busy` meanwhile so it can show it is on its way, and a second click
 * in that time does nothing. The picture the page already shows stands in for
 * the original when it cannot be loaded.
 */
async function stagedImage(target: Element): Promise<Staged | null> {
  const shot = target.closest(".jd-shot__open, .jd-shot__expand")?.closest<HTMLElement>(".jd-shot");
  const night = shot?.querySelector<HTMLImageElement>(".jd-shot-night");
  const image = night?.checkVisibility() ? night : shot?.querySelector("img");
  if (!shot || !image?.naturalWidth || "busy" in shot.dataset) return null;

  const original = image.dataset.src ?? image.currentSrc;
  const full = new Image();
  full.src = original;

  shot.dataset.busy = "";
  const loaded = await full
    .decode()
    .then(
      () => full,
      () => image,
    )
    .finally(() => delete shot.dataset.busy);

  const copy = new Image(loaded.naturalWidth, loaded.naturalHeight);
  copy.src = loaded.currentSrc || loaded.src;
  copy.alt = image.alt;

  const caption = shot.querySelector(".jd-shot-caption")?.textContent?.trim();
  return { markup: copy.outerHTML, caption, variant: "image", original };
}
