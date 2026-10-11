import type { ReactNode } from "react";
import { Card, Cards } from "./Cards";

/** One card of the grid: where it leads and what it says. */
export type SectionCard = { href: string; title: string; description?: ReactNode };

/**
 * The grid of pages a section landing page ends with, under its own heading.
 *
 * @example <SectionCards heading="In this section" cards={[{ href: "/manual", title: "Manual" }]} />
 */
export function SectionCards({ heading, cards }: { heading: string; cards: SectionCard[] }) {
  return (
    <>
      <h2>{heading}</h2>
      <Cards>
        {cards.map((card) => (
          <Card key={card.href} href={card.href} title={card.title} description={card.description} />
        ))}
      </Cards>
    </>
  );
}
