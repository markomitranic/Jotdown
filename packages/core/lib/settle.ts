/**
 * Waits `ms`, or gives up the moment the query it delays is called off, so typing asks once it pauses.
 *
 * @example await settle(signal, 250); // resolves 250ms later unless the query was cancelled first
 */
export function settle(signal: AbortSignal, ms: number) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
