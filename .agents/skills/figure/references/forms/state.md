# State machine

For finite state logic: an order's status, an auth session, a connection
lifecycle, a wizard, a job queue. The content is the transitions, so every one
is labelled with what triggers it.

## What it must carry

- Every transition labelled with the event that causes it, and its guard when
  there is one.
- The start state, and every end state.
- What happens on an unexpected event, or a caption saying it is out of scope.

## Layout

- States are `<rect rx="8">` in `surface`, name in `fontSize="12" fontWeight="600"`.
- **Start** is a filled `ink` dot, `<circle r="6">`. **End** is a ring: an
  outline circle `r="8"` with a filled `r="5"` inside.
- Transitions are elbow arrows labelled `event [guard] / action`, dropping the
  parts you do not need. A self-loop is a semicircle above the state, from one
  point on its top edge to another 48px along: `M 232,120 A 24,24 0 1 1 280,120`,
  with the label above the arc.
- Orient along the dominant direction, left to right or top to bottom, and
  rearrange states before letting two transitions cross.
- The accent goes on the state the reader should notice: the error state, or
  the completion the whole machine works toward.

## Anti-patterns

- More transitions than twice the number of states. That is two machines.
- "From any state" drawn from every state. One annotation says it:
  `* → Error on timeout`.
- An unlabelled transition. What triggers it is the only reason to draw it.
