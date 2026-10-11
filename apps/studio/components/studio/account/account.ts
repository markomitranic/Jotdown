"use client";

import { useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@jotdown/core/lib/fetch-json";
import type { Account } from "@/app/api/auth/route";

/**
 * The GitHub account the studio is signed in as, and the one sign-in dialog anything can open.
 *
 * Signing in or out changes what every list of projects shows, so both ask
 * the studio again for everything it answered before.
 */

/** What `GET /api/auth` answers: the account, where its token came from, and why a token stopped working. */
export type AccountAnswer = {
  account: Account | null;
  source: "environment" | "keychain" | null;
  error?: string;
};

const ACCOUNT_QUERY = ["account"];

/**
 * The account, `undefined` until the studio answers.
 *
 * @example const { account, source } = useAccount().data ?? {};
 */
export function useAccount() {
  return useQuery({
    queryKey: ACCOUNT_QUERY,
    queryFn: () => fetchJson<AccountAnswer>("/api/auth"),
    staleTime: 5 * 60_000,
  });
}

/**
 * Signs the studio out of GitHub and refreshes everything it listed.
 *
 * @example const signOut = useSignOut(); signOut.mutate();
 */
export function useSignOut() {
  const queries = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson("/api/auth", { method: "DELETE" }),
    onSettled: () => queries.invalidateQueries(),
  });
}

let opening = 0;
const listeners = new Set<() => void>();

/**
 * Opens the sign-in dialog with a fresh code.
 *
 * @example openSignIn();
 */
export function openSignIn() {
  opening += 1;
  for (const listener of listeners) listener();
}

/**
 * How many times the sign-in dialog was asked for, so each asking starts a new code.
 *
 * @example const opening = useSignInOpening(); // 0 until something calls openSignIn()
 */
export function useSignInOpening() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => opening,
    () => 0,
  );
}
