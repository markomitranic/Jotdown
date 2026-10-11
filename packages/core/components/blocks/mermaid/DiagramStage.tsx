/**
 * Fullscreen overlay that pans and zooms one drawing or image the way a design canvas does.
 *
 * Two-finger scroll pans, pinch (or ctrl/cmd + wheel) zooms around the cursor,
 * dragging pans, `+` `-` `0` work the toolbar, Escape closes. A minimap in the
 * corner shows the whole drawing with a frame over the visible part; it appears
 * while the view moves, unless the whole drawing is in view, and can be clicked
 * or dragged to jump. The view lives in
 * refs and is written straight to the elements, so moving never re-renders
 * React.
 *
 * Zoom anchors on the pointer's position within the stage, measured against the
 * stage's own box. Reading it off the wheel event's `offsetX` instead is what
 * made a big diagram jump: `offsetX` is relative to whichever element in the
 * drawing sits under the cursor, so on a dense drawing the anchor changed with
 * every shape the pointer crossed. A small drawing is mostly empty background,
 * where the stage itself is the target and the two agree, which is why the bug
 * only showed on the big ones.
 *
 * Panning is bounded so an edge of the drawing always reaches at least the
 * middle of the window, and a drawing too tall to fit at 0.1 can still be
 * zoomed out until it does.
 */

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download } from "lucide-react";
import { copyFromButton, imageFileName } from "@jotdown/core/lib/image-file";

/**
 * `variant` names what is on the stage. Mermaid draws in its light palette and
 * is inverted in dark mode, and opens no larger than its natural size; a
 * `jd-fig` figure paints with the theme's own tokens, must not be inverted, and
 * opens fitted to the window; an image opens at its natural size and fills the
 * window on Fit. `svg` is the markup to stage, an `<svg>` or a sized `<img>`.
 * `caption` is shown along the bottom edge. `original` is the file an image was
 * opened from, which the toolbar copies and downloads.
 */
type Props = {
  svg: string;
  caption?: string;
  original?: string;
  onClose: () => void;
  variant?: keyof typeof FILLS;
};

type Size = { width: number; height: number };
type View = { x: number; y: number; scale: number };

/** Safari's trackpad pinch, which arrives as its own event rather than as ctrl + wheel. */
type GestureEvent = Event & { scale: number; clientX: number; clientY: number };

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const FIT_PADDING = 48;
const ZOOM_STEP = 1.25;
const ZOOM_RATE = 0.0055;
const MINIMAP_WIDTH = 220;
const MINIMAP_MAX_HEIGHT = 320;
const MINIMAP_LINGER_MS = 1200;

/**
 * Whether each variant fills the window on opening and on Fit, rather than
 * only shrinking what is too big for it. A Mermaid chart's text is set in
 * pixels, so a small one filling a wide screen reads as a poster; a small image
 * opens at its own size and Fit is how a reader asks for it bigger; a figure is
 * drawn to be read at whatever width it is given.
 */
const FILLS = {
  mermaid: { open: false, fit: false },
  image: { open: false, fit: true },
  figure: { open: true, fit: true },
};

export default function DiagramStage({ svg, caption, original, onClose, variant = "mermaid" }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef = useRef<HTMLDivElement>(null);
  const minimapFrameRef = useRef<HTMLDivElement>(null);

  const drawing = useRef<Size>({ width: 1, height: 1 });
  const minimapScale = useRef(1);
  const floorScale = useRef(MIN_SCALE);
  const view = useRef<View>({ x: 0, y: 0, scale: 1 });
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const paint = useCallback(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const minimap = minimapRef.current;
    const frame = minimapFrameRef.current;
    if (!stage || !canvas || !minimap || !frame) return;

    const { scale } = view.current;
    const width = drawing.current.width * scale;
    const height = drawing.current.height * scale;
    const x = clamp(view.current.x, stage.clientWidth / 2 - width, stage.clientWidth / 2);
    const y = clamp(view.current.y, stage.clientHeight / 2 - height, stage.clientHeight / 2);
    view.current = { x, y, scale };

    canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;

    const k = minimapScale.current;
    frame.style.left = `${(-x / scale) * k}px`;
    frame.style.top = `${(-y / scale) * k}px`;
    frame.style.width = `${(stage.clientWidth / scale) * k}px`;
    frame.style.height = `${(stage.clientHeight / scale) * k}px`;

    clearTimeout(lingerTimer.current);
    const whollyInView = x >= 0 && y >= 0 && x + width <= stage.clientWidth && y + height <= stage.clientHeight;
    if (whollyInView) {
      delete minimap.dataset.active;
      return;
    }

    minimap.dataset.active = "";
    lingerTimer.current = setTimeout(() => delete minimap.dataset.active, MINIMAP_LINGER_MS);
  }, []);

  const zoomAround = useCallback(
    (factor: number, originX: number, originY: number) => {
      const { x, y, scale } = view.current;
      const next = clamp(scale * factor, floorScale.current, MAX_SCALE);
      const ratio = next / scale;
      view.current = {
        scale: next,
        x: originX - (originX - x) * ratio,
        y: originY - (originY - y) * ratio,
      };
      paint();
    },
    [paint],
  );

  const centerOn = useCallback(
    (drawingX: number, drawingY: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const { scale } = view.current;
      view.current = {
        scale,
        x: stage.clientWidth / 2 - drawingX * scale,
        y: stage.clientHeight / 2 - drawingY * scale,
      };
      paint();
    },
    [paint],
  );

  const fit = useCallback(
    (fill: boolean) => {
      const stage = stageRef.current;
      const canvas = canvasRef.current;
      const minimap = minimapRef.current;
      const minimapCanvas = minimapCanvasRef.current;
      if (!stage || !canvas || !minimap || !minimapCanvas) return;

      const size = naturalSize(canvas);
      drawing.current = size;
      for (const el of [canvas, minimapCanvas]) {
        el.style.width = `${size.width}px`;
        el.style.height = `${size.height}px`;
      }

      const k = Math.min(MINIMAP_WIDTH / size.width, MINIMAP_MAX_HEIGHT / size.height);
      minimapScale.current = k;
      minimapCanvas.style.transform = `scale(${k})`;
      minimap.style.width = `${size.width * k}px`;
      minimap.style.height = `${size.height * k}px`;

      const room = Math.max(
        Math.min(
          (stage.clientWidth - FIT_PADDING * 2) / size.width,
          (stage.clientHeight - FIT_PADDING * 2) / size.height,
        ),
        0.01,
      );
      floorScale.current = Math.min(MIN_SCALE, room);

      const scale = fill ? Math.min(room, MAX_SCALE) : Math.min(room, 1);
      view.current = {
        scale,
        x: (stage.clientWidth - size.width * scale) / 2,
        y: (stage.clientHeight - size.height * scale) / 2,
      };
      paint();
    },
    [paint],
  );

  const open = useCallback(() => fit(FILLS[variant].open), [fit, variant]);
  const refit = useCallback(() => fit(FILLS[variant].fit), [fit, variant]);

  const zoomFromCenter = useCallback(
    (factor: number) => {
      const stage = stageRef.current;
      if (stage) zoomAround(factor, stage.clientWidth / 2, stage.clientHeight / 2);
    },
    [zoomAround],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new drawing is fitted again
  useEffect(open, [open, svg]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointerOn = (event: { clientX: number; clientY: number }) => {
      const bounds = stage.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const at = pointerOn(event);
        zoomAround(Math.exp(-event.deltaY * ZOOM_RATE), at.x, at.y);
        return;
      }
      view.current.x -= event.deltaX;
      view.current.y -= event.deltaY;
      paint();
    };

    let pinchFrom: number | null = null;

    const onGestureStart = (event: GestureEvent) => {
      event.preventDefault();
      pinchFrom = view.current.scale;
    };

    const onGestureChange = (event: GestureEvent) => {
      event.preventDefault();
      if (pinchFrom === null) return;
      const at = pointerOn(event);
      zoomAround((pinchFrom * event.scale) / view.current.scale, at.x, at.y);
    };

    const onGestureEnd = (event: GestureEvent) => {
      event.preventDefault();
      pinchFrom = null;
    };

    const gestures: [string, (event: GestureEvent) => void][] = [
      ["gesturestart", onGestureStart],
      ["gesturechange", onGestureChange],
      ["gestureend", onGestureEnd],
    ];

    stage.addEventListener("wheel", onWheel, { passive: false });
    for (const [type, handler] of gestures) {
      stage.addEventListener(type, handler as EventListener, { passive: false });
    }
    return () => {
      stage.removeEventListener("wheel", onWheel);
      for (const [type, handler] of gestures) {
        stage.removeEventListener(type, handler as EventListener);
      }
    };
  }, [paint, zoomAround]);

  useEffect(() => {
    const swallow = (event: Event) => event.preventDefault();
    const onPageZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };

    window.addEventListener("wheel", onPageZoom, { passive: false });
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
      document.addEventListener(type, swallow, { passive: false });
    }
    return () => {
      window.removeEventListener("wheel", onPageZoom);
      for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
        document.removeEventListener(type, swallow);
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "+" || event.key === "=") zoomFromCenter(ZOOM_STEP);
      if (event.key === "-") zoomFromCenter(1 / ZOOM_STEP);
      if (event.key === "0" || event.key.toLowerCase() === "f") refit();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      clearTimeout(lingerTimer.current);
    };
  }, [onClose, refit, zoomFromCenter]);

  const drag = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    view.current.x += event.clientX - active.lastX;
    view.current.y += event.clientY - active.lastY;
    active.lastX = event.clientX;
    active.lastY = event.clientY;
    paint();
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const jumpFromMinimap = (event: React.PointerEvent) => {
    if (event.buttons !== 1) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const k = minimapScale.current;
    centerOn((event.clientX - bounds.left) / k, (event.clientY - bounds.top) / k);
  };

  return createPortal(
    <div className={`jd-stage jd-stage--${variant}`} role="dialog" aria-modal="true" aria-label="Diagram">
      <div className="jd-stage__toolbar">
        <button type="button" onClick={() => zoomFromCenter(1 / ZOOM_STEP)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={refit}>
          Fit
        </button>
        <button type="button" onClick={() => zoomFromCenter(ZOOM_STEP)} aria-label="Zoom in">
          +
        </button>
        {original && (
          <>
            <button
              type="button"
              className="jd-copy"
              title="Copy image"
              aria-label="Copy image"
              onClick={(event) => void copyFromButton(event.currentTarget, original)}
            >
              <Copy className="jd-copy__idle" aria-hidden="true" />
              <Check className="jd-copy__done" aria-hidden="true" />
            </button>
            <a
              href={original}
              download={imageFileName(original)}
              title="Download original"
              aria-label="Download original"
            >
              <Download aria-hidden="true" />
            </a>
          </>
        )}
        <button type="button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div
        ref={stageRef}
        className="jd-stage__viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={canvasRef}
          className="jd-stage__canvas"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the SVG Mermaid rendered from the page's own diagram
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {caption && <p className="jd-stage__caption">{caption}</p>}

      <div
        ref={minimapRef}
        className="jd-stage__minimap"
        aria-hidden="true"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          jumpFromMinimap(event);
        }}
        onPointerMove={jumpFromMinimap}
      >
        <div
          ref={minimapCanvasRef}
          className="jd-stage__canvas jd-stage__minimap-canvas"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the SVG Mermaid rendered from the page's own diagram
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div ref={minimapFrameRef} className="jd-stage__minimap-frame" />
      </div>
    </div>,
    document.body,
  );
}

/** The drawing's own pixel size, read off the image's size or the SVG viewBox. */
function naturalSize(canvas: HTMLElement): Size {
  const image = canvas.querySelector("img");
  if (image) return { width: image.width, height: image.height };

  const box = canvas.querySelector("svg")?.viewBox.baseVal;
  return box && box.width > 0
    ? { width: box.width, height: box.height }
    : { width: canvas.scrollWidth, height: canvas.scrollHeight };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
