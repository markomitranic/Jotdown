"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A button's copy action and whether it just copied, which stays true for a moment and a half.
 *
 * Adapted from Fumadocs UI, MIT.
 *
 * @example const [copied, copy] = useCopyButton(() => navigator.clipboard.writeText(text));
 */
export function useCopyButton(onCopy: () => void | Promise<void>): [boolean, () => void] {
  const [checked, setChecked] = useState(false);
  const action = useRef(onCopy);
  const timer = useRef<number | null>(null);
  action.current = onCopy;

  const onClick = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    Promise.resolve(action.current()).then(() => {
      setChecked(true);
      timer.current = window.setTimeout(() => setChecked(false), 1500);
    });
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return [checked, onClick];
}
