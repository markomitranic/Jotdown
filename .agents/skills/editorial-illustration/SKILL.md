---
name: editorial-illustration
description: Use only when working on the docs site. Paint an editorial illustration for a docs page, used as a hero visual metaphor that captures the intent of the entire article. Every page opens with one, so use it whenever a page is being written or has none yet.
---

# Editorial illustration

Capture ideas that the article is trying to convey to the reader, and create a hero editorial illustration that a well designed technical magazine would be proud of. A magazine commissions an artist to illustrate a scene that captures the essence and makes the reader _feel_ the point in one glance. Every page/article opens with one, right under the front matter and before the abstract.

Run all four parts autonomously. “Respond to user” means a progress
update: continue without waiting for a reply. Select interpretations,
concepts, palettes, and revisions yourself.

## Part 1. Interpretation

**Goal:** Decide what you want the illustration to say.

- Read the entire prose of the article.
- Highlight **five passages** that contain a goal, a strong claim, tension, surprising detail, or emotional moment.
- Write **three possible interpretations**, each no longer than 20 words. Each should make a statement about the subject.
- Choose the interpretation you most want to explore. Write down **one emotion** you want the reader to feel.

**Example:**
For an article about AI assistants, your interpretations might be:

- _“Delegating routine tasks frees us to do meaningful work.”_
- _“Convenience can gradually become dependence.”_
- _“We are giving unfamiliar systems increasingly intimate responsibilities.”_

**Respond to user:** three interpretation sentences, one selected sentence, and one intended emotion.

## Part 2: Artistic Style

**Goal:** Clearly define the visual style you will use for the illustration.

Visual style: lines, shadows, gradients, composition rules, how light, grain, surfaces and edges are painted. We aim for a consistent whimsical realism in a stylized 2D storybook style, the look of illustrated lore and screenprint illustration, with the light and surfaces of Monument Valley, Global Village Coffeehouse and Gris by Nomada Studio.

Poster Aesthetic, graphic silhouettes and mathematical composition. Emphasize clarity, bold shapes, layering, and a strong visual hierarchy to guide the viewer's eye. A believable world, painted rather than drawn, in which the impossible happens quietly. The world is rendered with a painter's depth and a storyteller's restraint, so the eye has somewhere to travel and one place to rest. Great art direction is achieved through consistency. Every element, from color palette to composition, should reinforce the visual style.

### World & Depth

- Lighting is key, the top lightest, the face toward the light a middle tone, the face away from it the darkest.
- The scene is built in 3-5 layered planes, from what is nearest the camera to what stands behind the subject, each a simple silhouette with an organic, slightly irregular edge.
- Distance is atmosphere: far planes are lighter, hazier, cooler and lower in contrast, near planes are darker and sharper. That alone gives the plate its depth.
- There is always air between the planes: haze, mist or glow, never a hard cut.

### Flow

- One or two long, flowing curves sweep through the scene and carry the eye to the subject: a ribbon, cloth, smoke, a river, a cable, a trail of light, a road, roots. Whatever the scene already holds, drawn as the whiplash curve of Art Nouveau, without its ornament.
- A flowing curve is a solid object with a face of its own. It is lit, grained and lined like everything else, never a bare stroke.
- It is wide enough to show a face, swells where it turns toward the light, tapers at both ends, and runs in S-curves rather than arcs of a circle.
- It twists at least once, so its back shows in the face's core colour.
- It weaves through the planes, passing behind the subject and in front of it, so the curve itself shows the depth. Paint it in pieces split where it passes an object, and line only its two long edges, so no seam crosses it at a split.
- Where it enters a part of the scene under another light, it takes that light.
- Every curve in the scene flows the same way, as if the same wind moved them all. One strong curve beats several thin ones; thin strands beside it read as motion lines.

### Line

- A line appears only where a silhouette meets light, in a colour of its own, never black or dark grey. On the edge toward the light it is a lighter, warmer tone of the face. On an edge with a light behind it, it is the rim light, the colour of that glow.
- Edges turned away from the light, or set against a ground of similar value, have no line. A line covers part of a silhouette and fades out along it, never the whole outline.
- The line has one steady weight across the plate, 1.5 to 2.5px at 960 wide, and follows the same wavering path as the edge it traces.
- Lines trace silhouettes only. Where two faces of one object meet, the change of colour draws the edge.
- The line stays solid and crisp. Grain never touches it.
- Light, air, haze and clouds have no line.

### Background

- Behind the scene runs a draughting layer, as if the plate were drawn over its own construction: a compass of rings, crosshairs and marker dots, dotted compass round the subject, astroid stars (four-cusped curves) linked by dotted constellation lines, small crosses, a dashed orbit round a distant shape, and other decorative elements.
- Background decoration remains in daylight, but is updated accordingly and barely visible.
- Draw it in one sigil colour, thin and at partial opacity. It frames the subject and never crosses it. The decorative elements in the background should be subtle and low contrast.

### Surface

- Every surface is textured. Each face carries grain across its whole area, its flat middle included, so no fill reads as clean vector. Grain belongs to a face and follows its light; one even noise layer laid over the whole plate is the lazy version of this.
- A face ramps across up to three colours: its lit colour on the side toward the light, a darker core where the form turns away, and a reflected colour on the far edge, borrowed from what sits beside it. The core is a darker, slightly hue-shifted version of the face itself, never one shadow colour shared by the whole scene.
- Every colour change on a face is grain: the next colour is dotted over the previous one, from no dots to fully solid, so the transition lands on a flat colour instead of fading out into a haze of specks.
- Dots sit close in value to the colour beneath them. Contrast lives in the shapes, not in the grain; a dot that pops off its face reads as dirt. Light dots on a dark ground read as glow, and may be sparser.
- Grain models form inside a silhouette. It follows the turn of a surface and never lies beside an object as a band of cast shadow.
- Solid objects keep a crisp, whole outline. Grain may darken a face right up to its edge, but never eats through it. Only what has no surface of its own, light and air, dissolves into dots at its boundary.
- Smooth, dot-free gradients belong to the sky and to the atmosphere between planes.
- Objects are geometric, but no contour is ruler-straight. Every edge drifts sideways by up to 1px in a slow wave that rises and falls over about 45px, never a shake from one point to the next. Sample the edge every 10px and take each point's drift from a smooth field of its position, so two faces that share an edge waver the same way and no seam opens between them:

```ts
const hash = (x: number, y: number, k: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

const ease = (t: number) => t * t * (3 - 2 * t);

const field = (x: number, y: number, k: number) => {
  const gx = x / 45, gy = y / 45;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const tx = ease(gx - x0), ty = ease(gy - y0);
  const top = hash(x0, y0, k) * (1 - tx) + hash(x0 + 1, y0, k) * tx;
  const bottom = hash(x0, y0 + 1, k) * (1 - tx) + hash(x0 + 1, y0 + 1, k) * tx;
  return top * (1 - ty) + bottom * ty;
};

const waver = ([x, y]: [number, number]) => [x + field(x, y, 1), y + field(x, y, 2)];
```

### Not this

- Photorealism, or anything that tries to be.
- Flash style vector clip art: even fills, perfect lines, no light.
- Clean flat fills beside patches of dots, or dots that contrast with the face they sit on.
- A solid object fraying into dots at its edge, as if it were evaporating.
- One uniform noise texture over the whole plate.
- Black or dark outlines, or one line colour traced round every object like a sticker.
- Blur or depth of field. Distance is haze, never blur.
- Words in the picture.
- A tiny figure standing in for scale or for the reader. A person belongs in the picture only when the idea is about a person, and then close enough to show a face and posture.
- Every object whole and centred, with room to spare around it.

**Respond to user:** Write a long paragraph describing **four working rules** for the illustration.

## Part 3: Ideation

**Goal:** Discover a strong visual expression of your chosen interpretation.

(3.1) Start by listing **ten concrete objects or actions** associated with the article and your interpretation. Find somewhere in the physical world where that one aspect already happens, then give it a twist, one small impossibility that makes the viewer look twice and then smile.

Start from the article's own nouns wherever they can be pictured. A reader already knows what they mean, so nothing has to be translated, and the impossible act carries the whimsy. Reach for a stand-in object only when the article's noun cannot be drawn.

Example: For dependence, these might include: leaning, carrying, feeding, following, crutches, roots, strings, a ritual, a journey, a battery.

(3.2) Write the concepts in the reply, each in a long paragraph, **four different concepts**, using one prompt for each:

- **Scene:** Show a situation in which the idea becomes visible.
- **Replacement:** Replace an expected object with something that changes the meaning.
- **Fusion:** Combine two objects into one.
- **Reversal:** Swap who controls, supports, carries, or depends on whom.

(3.3) Compare the four concepts using these priorities, in order:

1. Article fidelity: identify the passage supporting the concept. Reject concepts that imply claims the article does not make.
2. Visual mechanism: name the visible action, relationship, or transformation that expresses the interpretation. Reject concepts whose meaning depends on something described but not depicted. When the article's subject acts, the object playing it must visibly act too: its posture, direction or gaze does the thing. If an object cannot be made to act, cast a different one rather than trust the reader to infer it.
3. Legibility: whimsy is welcome, confusion is not. The impossible act is the point, so commit to it fully and never explain it away with a plausible mechanism. What must hold is association: every object carries the meaning a reader already gives it, and the one impossible act joins them. Ask whether a stranger, seeing only the picture, would name the same idea. Reject a concept whose objects have to be translated before the picture makes sense.
4. Emotional contribution: identify how scale, posture, composition, or colour supports the intended emotion. Treat the emotional effect as an inference, supported by those visible choices.

(3.4) Shortlist two concepts. For each, record its strongest mechanism and its main weakness in one sentence each.

(3.5) Choose the concept that best satisfies the priorities above. Borrow from the other concept only when the addition addresses a named weakness without weakening the central visual mechanism.

**Respond to user:** one selected concept, described in great detail in a long paragraph.

## Part 4: Execution

**Goal:** Produce a finished SVG illustration whose visual decisions support the concept.

Choose the visual language that will best convey the concept: the perspective, framing, and spatial relationships within the scene. The camera is a storytelling choice, made fresh for every plate. Its distance sets how close the reader stands to the idea, its height sets whether the subject towers over them or lies below them, and its lens sets how much of the surrounding world matters. Start from the relationship the picture is about, and place the camera where that relationship fills the frame. Frame the moment the idea happens, not the whole of every object taking part: a reader recognises a thing from a part of it, and the frame's edge cuts through whatever does not carry the idea.

- Develop the selected rough at the intended proportions. Gather the references needed for the objects and environments in it.
- Make **two small studies** using the chosen style and concept, from two different camera positions: one where the whole scene fits, and one that frames only the part where the idea happens and lets the rest run off the edges. Select one.
- Produce the finished work by revisiting and polishing the selected study. Identify and correct anything that makes the central relationship difficult to read.

### Define the colour palette

The project configuration provides a starting palette for your illustration, as the project's theme in `.jotdown/config.json`. Take the project theme as the baseline, and depart from it if required by the scene or the mood you want to convey.

The illustration must exist in dark and light mode, with the light mode being the same scene painted in a "different time of day". Never primitively invert one to get the other: inversion turns glow into grime and shadow into fog. Use the palette to carefully craft the mood and readability for each mode.

Grain densities belong to the palette too. Shadow grain is usually denser at night and glows stronger, while lit faces carry more highlight grain by day. Each face gets its own core and reflected colour, in both modes, and each solid object its own line colour.

**Respond to user:** the defined colour palette for both light and dark modes, explaining the choices and how they support the scene and mood.

### Put it on the page

The illustration is a file of its own, an upload like any other image, and the
page shows it as a plain markdown image on the first line under the front
matter:

```md
![What happens in the scene, in one sentence](/img/docs/illustration-<page>.svg "The message of the illustration. Max one sentence.")
```

- **Never paste the SVG into the page.** A painted plate runs to hundreds of
  kilobytes of path data. Inline, it is the first thing every agent reads in
  the page, it is compiled again with every edit, and the browser cannot cache
  it. As a file it costs the page one line.
- The file lives in `docs/_uploads/img/docs/`, where the in-page editor puts an
  upload, named `illustration-<page>.svg` after the page it opens, with the
  folders in the name: `docs/studio/branding.mdx` gets
  `illustration-studio-branding.svg`.
- **The alt** says what happens in the scene, for somebody who cannot see it.
- **The title** is the message, not a description of the scene. It is the
  caption printed under the picture, and the one shown when the reader expands
  it.

### The file

```svg
<svg xmlns="http://www.w3.org/2000/svg" id="dark" class="pr" width="960" height="540" viewBox="0 0 960 540">
  <style>
    .pr { --pr-sky: #d9dcf7; --pr-face-lit: #c9b2e6; --pr-face-core: #9a82c9; --pr-face-bounce: #e6b8c9; --pr-texture: 0.2; }
    .pr:target { --pr-sky: #0a0920; --pr-face-lit: #3a327f; --pr-face-core: #221c55; --pr-face-bounce: #5b3f7a; --pr-texture: 0.3; }
  </style>
  <rect width="960" height="540" fill="var(--pr-sky)" />
  ...
</svg>
```

- **Both palettes live in the one file.** Every colour is a variable named for
  its role, set twice in the `<style>`: the light palette on the drawing's
  class, the dark one under `:target`. In dark mode the page draws the same
  file at `#dark`, which is what makes `:target` match, so the root keeps
  `id="dark"`. Paint with `var(--pr-…)` in fills, strokes and gradient stops.
- **This is plain SVG, not JSX.** Attributes are spelled as SVG spells them:
  `class`, `stop-color`, `stroke-width`, `stroke-linecap`, `fill-opacity`,
  `color-interpolation-filters`, and the camelCase ones SVG itself has,
  `viewBox`, `baseFrequency`, `numOctaves`, `gradientUnits`.
- `width="960" height="540"` gives the picture its size; the page scales it
  down to the column.
- **The file stands alone.** An image cannot see the page, so nothing in it
  reaches outside: no `--jd-*` tokens, no fonts, no links to other files, no
  script. Hex colours are fine here, because a plate is artwork with its own
  ground.
- **Generate it.** Write the shapes with a scratch script that prints the SVG,
  and keep the script out of the project. Only the `.svg` ships.
- **Static only.** No animation, no CSS transitions. Filters are fine.

### Shade with grain

Several per plate (haze, blur, grain). Shading keeps each pixel of the shape fully or not at all, with the chance set by the pixel's opacity, then lays that grain over the smooth shape at 35%, so the texture stays soft:

```svg
<filter
  id="pr-dz"
  x="-5%"
  y="-5%"
  width="110%"
  height="110%"
  color-interpolation-filters="sRGB"
>
  <feTurbulence
    type="fractalNoise"
    baseFrequency="1.6"
    numOctaves="2"
    seed="4"
    result="noise"
  />
  <feColorMatrix
    in="noise"
    type="matrix"
    values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.9 0 0 0 -0.45"
    result="spread"
  />
  <feComposite
    in="SourceAlpha"
    in2="spread"
    operator="arithmetic"
    k2="1"
    k3="-1"
    k4="0.49"
    result="diff"
  />
  <feComponentTransfer in="diff" result="mask">
    <feFuncA type="discrete" tableValues="0 1" />
  </feComponentTransfer>
  <feComponentTransfer in="SourceGraphic" result="solid">
    <feFuncA type="linear" slope="255" />
  </feComponentTransfer>
  <feComposite in="solid" in2="mask" operator="in" result="grain" />
  <feComposite
    in="grain"
    in2="SourceGraphic"
    operator="arithmetic"
    k2="0.35"
    k3="0.65"
  />
</filter>
```

Make the colour opaque with `feFuncA`, never with a `255` in an `feColorMatrix`: WebKit on macOS, the desktop app and Safari, drops a matrix value that large and paints nothing. Keep `k2` and `k3` summing to 1; raise `k2` for a stronger grain.

Paint a face flat in its lit colour, then lay the same shape over it once per step of its ramp, each overlay one colour whose opacity changes, and run every overlay through the filter:

```svg
<linearGradient id="pr-face-core" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0.2" stop-color="var(--pr-face-core)" stop-opacity="0" />
  <stop offset="0.7" stop-color="var(--pr-face-core)" stop-opacity="1" />
</linearGradient>
<linearGradient id="pr-face-bounce" x1="1" y1="0" x2="0" y2="0">
  <stop offset="0" stop-color="var(--pr-face-bounce)" stop-opacity="1" />
  <stop offset="0.3" stop-color="var(--pr-face-bounce)" stop-opacity="0" />
</linearGradient>

<polygon points="…" fill="var(--pr-face-lit)" />
<polygon points="…" fill="var(--pr-face-core)" fill-opacity="var(--pr-texture)" filter="url(#pr-dz)" />
<polygon points="…" fill="url(#pr-face-core)" filter="url(#pr-dz)" />
<polygon points="…" fill="url(#pr-face-bounce)" filter="url(#pr-dz)" />
```

- The first overlay is the face's texture: its core colour at an even, low opacity, 0.15 to 0.3.
- Each overlay changes opacity only, never colour. A stop's opacity is how many dots survive there: 0 is none, 1 is solid.
- Run every transition all the way to 1, so it lands on the next colour. An overlay that stops at half opacity leaves a haze of specks.
- Stack overlays in the order of the ramp: texture, core, reflected colour, then any highlight or glow.
- Keep `k4` just under `0.5`, or fully transparent parts of the gradient leak stray dots.

### Render it and look

```sh
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix task)"
bun .agents/skills/editorial-illustration/scripts/render.ts docs/_uploads/img/docs/illustration-<page>.svg
```

The script draws the file as the page will, once by day and once at `#dark`,
and prints the path of each screenshot. For each path, call `view_image` agent
tool with that path. Evaluate the returned images against the criteria below.
Revise the SVG where needed, then render and inspect again.

Apply a revision when it addresses an observable problem or an article mismatch. Render and inspect the revised composition all over again. Allow at most two critique-and-revision rounds, then continue with the strongest version and report any unresolved concern. Look for traces of sloppy work, and redo if needed:

- Identify the visible relationship or action that communicates the selected interpretation. Check that it is readable at page width. If the meaning depends on explaining something the picture does not visibly show, revise the image.
- Are the shadows consistent with the light source?
- The impossibile geometry should look intentional, with consistent spatial logic around it.
- Does the composition guide the viewer's eye effectively?
- How much of the frame does the central relationship fill? If the whole subject fits with room to spare, the camera is too far. Would moving closer lose anything that carries the idea? If not, move closer.
- Do the objects read as what they are, and not as something else of a similar shape?
- Is the color palette harmonious and appropriate for the scene?
- Does the scene convey the intended mood or atmosphere effectively?
- Is the negative space used effectively to balance the composition?
- Does the light version read as the same scene at another hour, not a negative?
- Do the contours waver without losing their geometry, and without a seam where two faces meet?
- Does a flowing curve lead the eye to the subject and weave through the planes?
- Does a line appear only where a silhouette meets light, fading out along it, with no black line and no object outlined all the way round?
- Zoom into the grain. Is every face textured, do its dots sit close in value to the fill, and does each transition land on a solid colour? Does every solid object keep its outline?
