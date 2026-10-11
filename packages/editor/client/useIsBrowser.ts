"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and on the first client render, true from then on.
 *
 * Every control the editor adds hangs off this, so the prerendered HTML is the
 * reading view exactly and hydration has nothing to reconcile. A reader who
 * never edits sees no trace of any of it.
 *
 * @example const browser = useIsBrowser(); // false, then true
 */
export function useIsBrowser() {
  const [browser, setBrowser] = useState(false);

  useEffect(() => {
    setBrowser(true);
  }, []);

  return browser;
}
