# Story map

The Jeff Patton user story map: what is the whole story, and where do we cut
the first release. Narrative order runs left to right, priority runs top to
bottom, and the release cut is the point of the figure. Neither a kanban (that
shows state) nor a journey (that shows feeling).

## What it must carry

- The backbone in the order a user meets it, left to right.
- The cut line, and what sits below it.
- Which slice is the one being built, in the accent.

## Layout

- **Backbone**: up to five activities in the order the user experiences them,
  as header cards 200px wide (`<rect rx="4">`, layer bg fill), each with an
  `ACTIVITY 1` eyebrow and its name in `fontSize="12" fontWeight="600"`, 24px
  gutters.
- **Walking skeleton**: under each activity, its user steps as 32px-tall cards,
  one or two per activity, the row bottom aligned across activities.
- **Release slices**: full-width bands below, labelled in a 96px left margin
  (`MVP`, `RELEASE 2`, `LATER`), alternating a faint `line-soft` fill and none.
  Story cards inside are 48px tall in their activity's column, with a title and
  an `RPT-114 · 3pt` sublabel. Where a slice has a gap, dashed `line-soft`
  column separators run from under the backbone to the bottom so the grid still
  reads as columns.
- **The release cut**: a full-width `accent` rule (`strokeWidth="1.5"`) directly
  under the MVP band with a `RELEASE CUT` label at its right end.
- The one riskiest story card is the second accent element: `accent-soft` fill,
  dashed `accent` stroke, a small `RISK` tag.

## Budget

Five activities, three slices, twelve cards, four per slice.

## Anti-patterns

- No cut line. Then it is a backlog in a grid.
- Columns ordered by priority instead of narrative.
- Cards that are features rather than user-visible outcomes.
- Slices named by quarter. They drift the moment the schedule does.
