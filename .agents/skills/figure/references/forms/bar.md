# Bar

For discrete quantities per category, a before and after, a ranking. Each
category has one number and the comparison between bars is the message.

## What it must carry

- Every bar's value printed, the axis starting at zero, and the unit named once.
  Category names unabbreviated, or the reader is decoding a legend.
- A dumbbell carries both endpoint values and the gap between them.
- Where the numbers came from, in the caption.

## Layout

- Four to eight bars, each at least half the pitch wide so the gap never beats
  the bar. A typical pitch is 104 with a 64-wide bar.
- Vertical bars by default. Horizontal when the category labels are long or
  there are more than eight; never rotate a label past 45°.
- Sorted, unless the categories have a natural order such as months.
- A before and after is two bars side by side with the numbers on them, the
  after in the accent.
- One focal bar in the accent; the rest `line-soft` fill, `muted` stroke.
- The value above each bar in `fontSize="10"`, the focal one in the accent.
- No 3D, no shadow, no truncated axis.

## Dumbbell

For exactly two values per item where the gap is the story: one row per item,
two `<circle r="5">` joined by a `line` connector at `strokeWidth="1"`, the two
values labelled at the ends, the focal row in the accent. It hides what happened
in between, which is fine when that is not the point; if it is, draw a
waterfall.
