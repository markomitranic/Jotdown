"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { cn } from "cn";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { RadioGroup } from "radix-ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jotdown/core/components/ui/tooltip";

type Mode = "light" | "system" | "dark";

const MODES = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "system", label: "Match system", Icon: Monitor },
  { mode: "dark", label: "Dark", Icon: Moon },
] as const;

const PILL_OFFSET = {
  light: "translate-x-0",
  system: "translate-x-full",
  dark: "translate-x-[200%]",
};

const noop = () => () => {};

/**
 * Light, system and dark as one three-way switch, with system in the middle.
 *
 * A pill slides under the chosen mode. Under system, the mode the system picked
 * is lit a little, so the switch still says which one is showing. Nothing is
 * chosen until the browser has read the stored preference.
 *
 * @example <ThemeSwitch className="ms-auto" />
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, systemTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const chosen = mounted ? (theme as Mode) : undefined;
  const seen = chosen === "system" ? systemTheme : undefined;

  function choose(mode: string) {
    if (!document.startViewTransition) return setTheme(mode);

    document.startViewTransition(() => flushSync(() => setTheme(mode)));
  }

  return (
    <RadioGroup.Root
      value={chosen ?? ""}
      onValueChange={choose}
      orientation="horizontal"
      aria-label="Colour mode"
      className={cn("relative inline-flex rounded-full p-1", className)}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1 left-1 size-6.5 rounded-full bg-accent transition-transform duration-200 ease-out motion-reduce:transition-none",
          chosen ? PILL_OFFSET[chosen] : "invisible",
        )}
      />

      {MODES.map(({ mode, label, Icon }) => (
        <Tooltip key={mode}>
          <TooltipTrigger asChild>
            <RadioGroup.Item
              value={mode}
              aria-label={label}
              className={cn(
                "relative size-6.5 rounded-full p-1.5 text-muted-foreground outline-none transition-colors",
                "hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
                "aria-checked:text-accent-foreground",
                seen === mode && "text-foreground *:opacity-70",
              )}
            >
              <Icon className="size-full" fill={mode === "system" ? "none" : "currentColor"} />
            </RadioGroup.Item>
          </TooltipTrigger>
          <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
      ))}
    </RadioGroup.Root>
  );
}
