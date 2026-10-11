import { cva } from "class-variance-authority";
import { cn } from "cn";

const variants = cva(
  "inline-flex items-center justify-center rounded-md p-2 font-medium text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary/80 disabled:bg-secondary disabled:text-secondary-foreground",
        outline: "border hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        secondary: "border bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "gap-1 px-2 py-1.5 text-xs",
        icon: "p-1.5 [&_svg]:size-5",
        "icon-sm": "p-1.5 [&_svg]:size-4.5",
        "icon-xs": "p-1 [&_svg]:size-4",
      },
    },
  },
);

/**
 * The look of the layout's own small buttons: the sidebar's triggers, search, copy and anchor buttons.
 *
 * A size's padding replaces the base padding rather than sitting beside it.
 * Adapted from Fumadocs UI, MIT.
 *
 * @example <button className={chromeButton({ variant: "ghost", size: "icon-sm" })} />
 */
export function chromeButton(options: Parameters<typeof variants>[0]) {
  return cn(variants(options));
}
