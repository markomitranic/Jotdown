"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type Drawing = { drawing: boolean; setDrawing(open: boolean): void };

const DrawingContext = createContext<Drawing>({ drawing: false, setDrawing: () => {} });

/**
 * Shares whether a whiteboard is open over the page, so the save bar can step aside while it is.
 *
 * @example <DrawingProvider><WhiteboardWorkspace … /><InplaceToolbar /></DrawingProvider>
 */
export function DrawingProvider({ children }: { children: ReactNode }) {
  const [drawing, setDrawing] = useState(false);
  return <DrawingContext.Provider value={{ drawing, setDrawing }}>{children}</DrawingContext.Provider>;
}

/** Whether a whiteboard is open over the page, and the switch the workspace flips. */
export function useDrawing() {
  return useContext(DrawingContext);
}
