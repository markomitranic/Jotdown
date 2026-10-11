"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine } from "lucide-react";
import { fetchJson } from "@jotdown/core/lib/fetch-json";
import type { Update } from "@/server/updates";

/**
 * A link to a newer Jotdown release, shown only when there is one.
 *
 * @example <UpdateNotice />
 */
export function UpdateNotice() {
  const { data } = useQuery({
    queryKey: ["update"],
    queryFn: () => fetchJson<{ update: Update | null }>("/api/update"),
    staleTime: 3_600_000,
  });
  if (!data?.update) return null;

  return (
    <a
      href={data.update.url}
      target="_blank"
      rel="noreferrer"
      className="flex h-7 items-center gap-1.5 rounded-md px-2 text-white/75 outline-none transition-colors [-webkit-app-region:no-drag] hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
    >
      <ArrowDownToLine className="size-3.5" aria-hidden="true" />
      Jotdown {data.update.version} is out
    </a>
  );
}
