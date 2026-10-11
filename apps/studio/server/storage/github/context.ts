import { AsyncLocalStorage } from "node:async_hooks";
import type { Session } from "../../auth/session";
import type { Target } from "./projects";

/**
 * The repository and token one editing request works against.
 *
 * The editing route pins these from its own URL, so a save always lands in the
 * project whose page it came from, even when another tab has switched projects.
 */
export const editingContext = new AsyncLocalStorage<{ remote: Target; session: Session }>();
