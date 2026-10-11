import { describe, expect, it } from "vitest";
import { createRoster, type Mounted } from "./roster";

/**
 * Stand-ins for the elements the editors mounted on, ordered by where they sit.
 *
 * `compareDocumentPosition` is the only thing the roster asks a DOM node, so a
 * row of numbers answers it exactly as a page would and the test needs no
 * browser at all.
 */
function page(count: number) {
  const at = new Map<object, number>();

  const elements = Array.from({ length: count }, (_, index) => {
    const element = {
      compareDocumentPosition: (other: object) => (at.get(other)! > index ? 4 : 2),
    } as unknown as HTMLElement;

    at.set(element, index);
    return element;
  });

  return elements;
}

function seat(dom: HTMLElement): Mounted {
  return { dom, enter: () => {}, absorb: () => true };
}

describe("createRoster", () => {
  it("finds the nearest editor on either side, not the farthest", () => {
    const [first, second, third] = page(3) as [HTMLElement, HTMLElement, HTMLElement];
    const roster = createRoster();
    const seats = [first, second, third].map(seat);
    seats.forEach((one) => roster.join(one));

    expect(roster.beside(second, 1)).toBe(seats[2]!);
    expect(roster.beside(second, -1)).toBe(seats[0]!);
    expect(roster.beside(first, -1)).toBeNull();
    expect(roster.beside(third, 1)).toBeNull();
  });

  it("steps over an editor that has left, so a merged block is not a stop", () => {
    const [first, second, third] = page(3) as [HTMLElement, HTMLElement, HTMLElement];
    const roster = createRoster();
    const seats = [first, second, third].map(seat);
    const leave = roster.join(seats[1]!);
    roster.join(seats[0]!);
    roster.join(seats[2]!);

    leave();

    expect(roster.beside(first, 1)).toBe(seats[2]!);
  });
});
