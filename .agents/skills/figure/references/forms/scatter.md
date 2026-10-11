# Scatter

For the relationship, or lack of one, between two continuous variables:
clusters, outliers, the high and low performers.

## What it must carry

- Both axes with their units, and n stated.
- Outliers labelled. An outlier the reader cannot name is the reason they stop
  trusting the chart.
- What a bubble's area encodes, when there is one.

## Layout

- Five to thirty points as `<circle r="5">`, `line-soft` fill, `muted` stroke.
  The focal point is `r="6"` in the accent.
- Label the focal point and one or two notable outliers, never every point.
- A trend line only when the trend is obvious to the eye, dashed `line`. Never
  force a fit.
- Optional quadrant dividers at the medians, dashed `line-soft`, each quadrant
  named in `fontSize="10"` `muted`.
- Both axes include zero when absolute position matters, and neither does when
  the range is tiny and far from zero.

## Bubble

For three quantities per item where the joint reading is the story: which items
combine a bad position with a big footprint. Area, never radius, is proportional
to the third value, and the caption says so. Not for a third value that is a
category (use the focal accent for that), and not for magnitudes spanning
several orders (the small bubbles vanish).

## Beeswarm

For one variable with one dot per item, when the crowd itself is the story.
Points pack against each other along the value axis instead of jittering, so
density is visible and no dot hides another. The focal dot in the accent.
