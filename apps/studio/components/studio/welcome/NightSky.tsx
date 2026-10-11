"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import { revealDraft } from "./reveal";

/**
 * A full-screen painted night sky whose paint the pointer wipes away, showing the pencil draft beneath.
 *
 * The painting is a plain image, so it shows before any script runs. Touch
 * drags paint the trail instead of scrolling, since the page is one screen.
 * In the installed app the sky runs up under the window's own buttons, and
 * the corners beside them wear the colour of its top edge.
 *
 * @example <NightSky><h1>Jotdown</h1></NightSky>
 */
export function NightSky({ children }: { children: ReactNode }) {
  const scene = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!scene.current || !canvas.current) return;
    return revealDraft(scene.current, canvas.current);
  }, []);

  return (
    <main
      ref={scene}
      data-edge-to-edge=""
      data-one-screen=""
      data-title-bar-colour="#221f45"
      className="relative h-dvh touch-none overflow-hidden bg-black text-white"
    >
      <Image
        src="/studio/night-painted.svg"
        alt=""
        width={1920}
        height={1080}
        unoptimized
        className="pointer-events-none absolute inset-0 size-full object-cover object-bottom"
      />
      {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas without a tabIndex is never focused, and this one is decoration */}
      <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />
      {children}
    </main>
  );
}
