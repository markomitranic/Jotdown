# User journey

For what one person does across the stages of an experience and how it feels
at each. The sentiment curve is what makes it a journey; if you cannot name a
feeling for every stage, it is a swimlane or a timeline.

## What it must carry

- The stages named in the order the person meets them, what they do at each, and
  how it feels.
- At least one drop, wait or friction point. A journey where everything is fine
  has nothing to show.
- Whose journey it is, in the caption.

## Layout

A vertical stack for one persona:

- **Stage headers**: up to six equal columns with 24px gutters, each with an
  eyebrow (`STAGE 1`) over the stage name in `fontSize="12" fontWeight="600"`.
- **Sentiment band**: a 160px-tall plot directly under the headers, with three
  `line-soft` hairlines for `HIGH`, `NEUTRAL` and `LOW`, labelled in the left
  margin in `fontSize="10"` `muted`, horizontal text only. A `muted` polyline
  (`strokeWidth="1.5"`) runs through one `<circle r="5">` per stage, each snapped
  to one of five named levels (`HIGH`, `MED-HIGH`, `NEUTRAL`, `MED-LOW`, `LOW`).
  The curve is data, not a connector, so the elbow rule does not apply to it.
- The trough stage's dot and the segment arriving at it are the accent.
- **Content rows** under the band, each labelled in the left margin: `ACTIONS`
  (what the person does, one short line per stage, `fontSize="12"`),
  `TOUCHPOINTS` (email, app, docs, in `fontSize="9.5"` `muted`), and at most one
  more for a metric or an owner. Hairlines between rows.
- **Pain markers**: a small dashed `accent` tag under the trough stage's action
  naming the friction. Two at most, only at the dip.

## Anti-patterns

- A numeric sentiment axis. Sentiment here is five named levels, not a score.
- Emoji as sentiment. They do not print, localise or survive small sizes.
- Two personas on one map. Two curves erase each other.
- Pain markers on every stage. Then nothing is focal.
- A system flow with no human in it. That is `what-talks-to-what.md`.
