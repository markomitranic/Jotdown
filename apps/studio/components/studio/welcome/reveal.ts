/** The pencil draft under the painted sky, drawn to the same 1600 by 1000 frame. */
const DRAFT = { src: "/studio/night-draft.svg", width: 1600, height: 1000 };

const BRUSH = 64;
const SPECK = { spread: 60, smallest: 20, range: 26 };
const STAMP_GAP = 14;
const HEAL_PER_FRAME = 0.035;
const SETTLE_MS = 1800;

/**
 * Wipes the painted sky away along the pointer's trail, showing the pencil draft beneath it.
 *
 * The trail heals over about a second, and the loop stops once it has, so a
 * still page repaints nothing. With reduced motion asked for, it does nothing.
 *
 * @example const stop = revealDraft(scene, canvas); stop();
 */
export function revealDraft(scene: HTMLElement, canvas: HTMLCanvasElement) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  const view = canvas.getContext("2d");
  if (!view) return () => {};

  const draft = new Image();
  draft.src = DRAFT.src;

  let mask: OffscreenCanvas | null = null;
  let drafted: OffscreenCanvas | null = null;
  let scale = 1;
  let last: { x: number; y: number } | null = null;
  let frame = 0;
  let movedAt = 0;

  function fit() {
    const { width, height } = scene.getBoundingClientRect();
    scale = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    mask = new OffscreenCanvas(canvas.width, canvas.height);
    drafted = paintDraft(draft, canvas.width, canvas.height);
  }

  function stamp(x: number, y: number) {
    const brush = mask?.getContext("2d");
    if (!brush) return;
    blob(brush, x, y, BRUSH * scale);
    blob(
      brush,
      x + (Math.random() - 0.5) * SPECK.spread * scale,
      y + (Math.random() - 0.5) * SPECK.spread * scale,
      (SPECK.smallest + Math.random() * SPECK.range) * scale,
    );
  }

  function draw(now: number) {
    const brush = mask?.getContext("2d");
    if (!view || !brush || !mask || !drafted) return;

    brush.globalCompositeOperation = "destination-out";
    brush.fillStyle = `rgba(0, 0, 0, ${HEAL_PER_FRAME})`;
    brush.fillRect(0, 0, mask.width, mask.height);
    brush.globalCompositeOperation = "source-over";

    view.globalCompositeOperation = "copy";
    view.drawImage(mask, 0, 0);
    view.globalCompositeOperation = "source-in";
    view.drawImage(drafted, 0, 0);

    frame = now - movedAt < SETTLE_MS ? requestAnimationFrame(draw) : 0;
  }

  function move(event: PointerEvent) {
    if (!drafted) return;
    const box = scene.getBoundingClientRect();
    const point = { x: (event.clientX - box.left) * scale, y: (event.clientY - box.top) * scale };
    const from = last ?? point;
    const steps = Math.max(1, Math.hypot(point.x - from.x, point.y - from.y) / (STAMP_GAP * scale));

    for (let step = 1; step <= steps; step++) {
      stamp(from.x + ((point.x - from.x) * step) / steps, from.y + ((point.y - from.y) * step) / steps);
    }

    last = point;
    movedAt = performance.now();
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function leave() {
    last = null;
  }

  const resized = new ResizeObserver(() => draft.complete && fit());
  draft.decode().then(fit, () => {});
  resized.observe(scene);
  scene.addEventListener("pointermove", move);
  scene.addEventListener("pointerleave", leave);

  return () => {
    resized.disconnect();
    scene.removeEventListener("pointermove", move);
    scene.removeEventListener("pointerleave", leave);
    cancelAnimationFrame(frame);
  };
}

/**
 * The draft drawn once at the canvas's size, covering it and anchored to the bottom like the painting.
 *
 * @example paintDraft(draft, 2880, 1800); // an OffscreenCanvas holding the draft
 */
function paintDraft(draft: HTMLImageElement, width: number, height: number) {
  const fitted = new OffscreenCanvas(width, height);
  const cover = Math.max(width / DRAFT.width, height / DRAFT.height);
  const drawn = { width: DRAFT.width * cover, height: DRAFT.height * cover };
  fitted
    .getContext("2d")
    ?.drawImage(draft, (width - drawn.width) / 2, height - drawn.height, drawn.width, drawn.height);
  return fitted;
}

/** One soft round dab of the brush, solid in the middle and feathered to nothing at its edge. */
function blob(brush: OffscreenCanvasRenderingContext2D, x: number, y: number, radius: number) {
  const feather = brush.createRadialGradient(x, y, 0, x, y, radius);
  feather.addColorStop(0, "rgba(0, 0, 0, 0.7)");
  feather.addColorStop(0.55, "rgba(0, 0, 0, 0.5)");
  feather.addColorStop(1, "rgba(0, 0, 0, 0)");
  brush.fillStyle = feather;
  brush.beginPath();
  brush.arc(x, y, radius, 0, Math.PI * 2);
  brush.fill();
}
