import type { ReactNode } from "react";
import { Editable, Slot, defineBlock } from "@jotdown/kit";

type Props = { title?: string; tagline?: string; image?: string; children?: ReactNode };

/**
 * A page's opening: a big title, one line under it, a few words and a picture.
 *
 * @example <Hero title="Notes that publish themselves" tagline="Write in place, ship a static site." />
 */
function HeroBlock({ title, tagline, image, children }: Props) {
  return (
    <section className="not-prose my-10 grid items-center gap-8 rounded-2xl bg-primary/5 p-8 ring-1 ring-primary/15 md:grid-cols-2 md:p-12">
      <div>
        <Editable.Text prop="title" value={title} as="h2" className="block font-semibold text-4xl tracking-tight" />
        <Editable.Text prop="tagline" value={tagline} as="p" className="mt-3 block text-lg text-muted-foreground" />
        <Slot className="prose mt-6">{children}</Slot>
      </div>
      <Editable.Image prop="image" src={image} className="aspect-video w-full rounded-xl object-cover" />
    </section>
  );
}

export const Hero = defineBlock(HeroBlock, {
  title: "Hero",
  description: "A big title, a tagline and a picture",
  props: {
    title: { default: "A new idea" },
    tagline: { default: "Say it in one line" },
    image: { kind: "image" },
  },
  children: "Tell the reader why it matters.",
});
