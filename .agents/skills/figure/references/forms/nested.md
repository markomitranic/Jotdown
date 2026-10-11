# Nested containment

For hierarchy through scope: trust zones, a settings cascade, folder nesting,
blast radius. Outer is broader, inner is more specific.

## What it must carry

- Every ring labelled, and what crosses each boundary written on the crossing.
- What is outside the outermost ring. A boundary with nothing beyond it is not a
  boundary.
- Which ring the prose is about, in the accent.

## Layout

- Three to five `<rect rx="8">` nested with a consistent inset: 24 or 32px
  horizontally, 32 or 36px vertically. Irregular padding looks accidental.
- Each level is labelled at its top-left corner with an eyebrow
  (`fontSize="10" letterSpacing="1.5"`).
- Strokes strengthen inward: `line-soft` on the outermost ring, `line`, then
  `ink`, then `accent` on the innermost focal ring. Fills stay `surface` except
  the innermost, which may take a layer bg or `accent-soft`.
- The accent is on one level only, or the hierarchy collapses.

## Anti-patterns

- More than five levels. Information disappears inward.
- Content inside a ring that is not part of the hierarchy. That is a sibling
  figure.
- Using it when two children of one parent must both be shown. Containment
  draws one chain; that case is a tree.
