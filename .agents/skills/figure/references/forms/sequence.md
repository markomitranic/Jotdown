# Sequence

For request and response flows, a protocol exchange, an API trace, a token
refresh, an incident reconstruction. Time flows down; actors sit across the top.

## What it must carry

- Every message labelled with what is sent, not with the verb alone.
- The return, or its deliberate absence marked as fire-and-forget.
- What is synchronous and what is not, and where the caller waits.

## Layout

- Actors as boxes in a row at the top. From each, a **lifeline**: a dashed
  vertical `line-soft` line (`strokeDasharray="3 3"`) down to the bottom.
- Messages are horizontal arrows between lifelines, at least 24px apart
  vertically, labelled above the line with the call or the payload.
- An **activation bar** shows when an actor holds control: a `<rect>` 8px wide
  on the lifeline, `line-soft` fill, `muted` stroke, spanning the interval.
  Stack two for a nested call. Every bar that opens closes.
- A self-message is a short U on the right of the lifeline: out 24px, down
  24px, back in, label to its right.
- A sync call is solid with a filled head. Its return runs dashed 24px below it
  with a filled head pointing back, never solid. An async event is dashed with
  an open head, a marker whose path has `fill="none"` and a `muted` stroke.
- The accent goes on one headline message, the happy-path response the figure
  is about. Never on both branches of an alternative.

## Branches

When the flow branches (valid vs. invalid token, a retry, an optional step),
draw a **fragment frame** rather than two free-floating arrow clusters: a
`<rect rx="4">` with a `line` stroke spanning only the lifelines involved, a
small tab in its top-left corner reading `ALT`, `OPT` or `LOOP`
(`fontSize="9.5" letterSpacing="1"`), and the guard under the tab in brackets
(`[token valid]`, `[retry ≤ 3]`). An `alt` has at most two regions, split by a
dashed horizontal hairline, the second region guarded `[else]`.

- The frame's sides sit at least 12px outside the outermost lifeline it covers.
- One fragment per figure by default, never nested more than one level. A
  refresh path that needs more is its own figure.

## Budget

Five lifelines, twelve messages, one fragment. Over that, split: the happy path
in one figure, the failure or refresh path in the next.

## Anti-patterns

- An arrow pointing upward. Time never reverses.
- A label sitting across another lifeline. Shorten it or move the message down.
- Lanes instead of lifelines. That is a swimlane, a different grammar.
- `if / else` drawn as two arrow clusters with no frame.
- Fragment labels in the sans face; they are mono like every other tag.
