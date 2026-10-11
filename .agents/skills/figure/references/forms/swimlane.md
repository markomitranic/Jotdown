# Swimlane

For a cross-functional process: who does which step, and where the work
changes hands. The handoffs are the content.

## Is this the right file

Two lanes at least, and at least one step that crosses a lane. The handoff is
the content, so a process whose every step sits in one lane is a flowchart or a
`<Steps>` block, and a set of actors who never hand anything to each other is
`what-talks-to-what.md`.

Lanes are who does the work, never what stage it is in. Stage columns with the
same actor throughout are a process or a timeline.

## What it must carry

- Every lane named with its owner.
- Every handoff arrow labelled with what is handed over: the document, the
  ticket, the approval. An unlabelled crossing is the one step nobody can
  reconstruct.
- Where the work waits, when waiting is part of the story.

## Layout

- One horizontal lane per actor or team (or one column each, if the flow runs
  down). The lane's name is an eyebrow (`fontSize="10" letterSpacing="1.5"`,
  `muted`) in the left margin. Lanes are separated by `line-soft` hairlines.
- Each step is a `<rect rx="4">` inside the lane of whoever performs it. A step
  never straddles two lanes; pick one owner.
- Arrows show the flow. The ones that cross a lane boundary are the handoffs,
  and the handoff that costs the most coupling or latency is the one that gets
  the accent.
- Lanes need not hold the same number of steps. A lane with one step is fine.
- Order the steps so the flow runs mostly straight. Arrows snaking back and
  forth mean the steps are in the wrong order, not that the process is complex.
- Five lanes at most.

## Process variant

Use it when what each step consumes and produces matters as much as who does
it. Each step carries two small chips on its edge naming the payload in and out
(`FILE`, `TABLE`, `REPORT`, `DATASET`), a tool sublabel in `fontSize="9.5"`
under its name, and the step columns are numbered across the top. When the
payload types do not matter, it is a plain swimlane. A data pipeline across
roles (admins set up, engineers ingest, scientists model, consumers query) is
the canonical case, with the focal cross-role handoff in the accent.

## Anti-patterns

- Lanes without labels.
- Using it when the real question is "who owns what" rather than "what happens
  in what order". That is an org chart.
- Using it for a state census with no flow. That is a kanban board.
