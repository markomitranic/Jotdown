"use client";

import { useEffect } from "react";

/** How many bitmap pixels a plate gets per unit of its `viewBox`, sharp on a Retina screen at the column's width. */
const SCALE = 2;

const PLATES = ".jd-fig--plate .jd-fig-frame > svg";

/** The colour mode each painted bitmap was drawn in, so a mode switch repaints it and a clone with no pixels is painted afresh. */
const paintedIn = new WeakMap<HTMLCanvasElement, boolean>();
const painting = new WeakSet<SVGSVGElement>();

/**
 * Paints every editorial illustration on the page into a bitmap once, and shows that in place of the live drawing.
 *
 * A plate shades every face through an SVG noise filter, and WebKit runs those
 * filters again on every repaint, so a sidebar sliding or a dialog opening
 * stalls for hundreds of milliseconds. A bitmap only scales. Each plate is
 * painted after it appears, again when the colour mode changes, and a copy the
 * editor clones in is painted like any other. A plate that fails keeps its
 * live drawing.
 *
 * @example <PlatePainter />
 */
export default function PlatePainter() {
  useEffect(() => {
    let queued = 0;
    const paintAll = () => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(() => {
        for (const drawing of document.querySelectorAll<SVGSVGElement>(PLATES)) void paint(drawing);
      });
    };

    const watcher = new MutationObserver(paintAll);
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    watcher.observe(document.body, { childList: true, subtree: true });
    paintAll();

    return () => {
      cancelAnimationFrame(queued);
      watcher.disconnect();
    };
  }, []);

  return null;
}

/**
 * Paints one plate into the bitmap that covers it, unless it already shows the current colour mode.
 *
 * @example await paint(document.querySelector(".jd-fig--plate svg"));
 */
async function paint(drawing: SVGSVGElement) {
  const frame = drawing.parentElement;
  const dark = document.documentElement.classList.contains("dark");
  const existing = frame?.querySelector<HTMLCanvasElement>(":scope > canvas.jd-fig-raster");
  if (!frame || painting.has(drawing) || (existing && paintedIn.get(existing) === dark)) return;

  const { width, height } = drawing.viewBox.baseVal;
  if (!width || !height) return;

  painting.add(drawing);
  try {
    const image = await standalone(drawing, dark, width * SCALE, height * SCALE);
    const canvas = existing ?? frame.appendChild(rasterFor(drawing));
    canvas.width = width * SCALE;
    canvas.height = height * SCALE;
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    paintedIn.set(canvas, dark);
  } catch {
    return;
  } finally {
    painting.delete(drawing);
  }
}

/**
 * The plate as an image of its own, at a fixed size, in the colour mode the page is in.
 *
 * A plate's dark palette hangs off a `.dark` ancestor, so in dark mode the
 * drawing is nested in an outer SVG that carries the class.
 *
 * @example await standalone(drawing, true, 1920, 1080); // HTMLImageElement, decoded
 */
async function standalone(drawing: SVGSVGElement, dark: boolean, width: number, height: number) {
  const copy = drawing.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  copy.removeAttribute("style");

  const markup = dark
    ? `<svg xmlns="http://www.w3.org/2000/svg" class="dark" width="${width}" height="${height}">${copy.outerHTML}</svg>`
    : copy.outerHTML;
  const address = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));

  try {
    const image = new Image(width, height);
    image.src = address;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(address);
  }
}

/**
 * The canvas a plate is painted into, described for a screen reader the way the drawing was.
 *
 * @example frame.append(rasterFor(drawing));
 */
function rasterFor(drawing: SVGSVGElement) {
  const canvas = document.createElement("canvas");
  canvas.className = "jd-fig-raster";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", drawing.getAttribute("aria-label") ?? "");
  return canvas;
}
