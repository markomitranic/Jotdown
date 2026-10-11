"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Check, Copy, ExternalLink, LoaderCircle, X } from "lucide-react";
import { cn } from "cn";
import { postJson } from "@jotdown/core/lib/fetch-json";
import type { DeviceCode, SignInState } from "@/server/auth/device";
import { useSignInOpening } from "./account";

type Step =
  | { kind: "asking" }
  | { kind: "code"; code: DeviceCode }
  | { kind: "signed-in" }
  | { kind: "over"; reason: string };

const REASONS: Record<Exclude<SignInState, "waiting" | "signed-in">, string> = {
  expired: "The code expired before GitHub saw it.",
  denied: "GitHub was told not to let Jotdown in.",
};

/**
 * The GitHub sign-in: a code to type on github.com, and the wait while you do.
 *
 * Opens whenever something calls `openSignIn()`, asks for a code at once, and
 * asks GitHub at its own pace whether the code was entered. Once it was, every
 * list of projects is fetched again and the dialog closes itself.
 *
 * @example <SignInDialog />
 */
export function SignInDialog() {
  const opening = useSignInOpening();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "asking" });
  const queries = useQueryClient();
  const router = useRouter();

  const begin = useEffectEvent(() => {
    setOpen(true);
    askForCode();
  });

  useEffect(() => {
    if (opening > 0) begin();
  }, [opening]);

  function askForCode() {
    setStep({ kind: "asking" });
    postJson<DeviceCode>("/api/auth", { action: "start" })
      .then((code) => setStep({ kind: "code", code }))
      .catch((error: Error) => setStep({ kind: "over", reason: error.message }));
  }

  const signedIn = useEffectEvent(() => {
    setStep({ kind: "signed-in" });
    queries.invalidateQueries();
    router.refresh();
    setTimeout(() => setOpen(false), 900);
  });

  const waiting = open && step.kind === "code" ? step.code : null;

  useEffect(() => {
    if (!waiting) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      const answer = await postJson<{ state: SignInState }>("/api/auth", { action: "check" }).catch(() => ({
        state: null,
      }));
      if (stopped) return;
      if (answer.state === "waiting") {
        timer = setTimeout(check, waiting.interval * 1000);
        return;
      }
      if (answer.state === "signed-in") return signedIn();
      setStep({ kind: "over", reason: answer.state ? REASONS[answer.state] : "GitHub could not be reached." });
    };

    timer = setTimeout(check, waiting.interval * 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [waiting]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="fixed top-[18vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl bg-popover p-6 text-popover-foreground text-sm shadow-2xl outline-none ring-1 ring-foreground/10 data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in"
        >
          <DialogPrimitive.Title className="font-medium text-base">Sign in to GitHub</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1.5 text-muted-foreground">
            Enter the code on GitHub, and Jotdown can open and save your repositories as you.
          </DialogPrimitive.Description>
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute top-4 right-4 grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>

          <div className="mt-5">
            {step.kind === "asking" && <CodeBox>{null}</CodeBox>}
            {step.kind === "code" && <CodeToEnter code={step.code} />}
            {step.kind === "signed-in" && (
              <p role="status" className="flex h-24 items-center justify-center gap-2 font-medium">
                <Check className="size-4 text-primary" aria-hidden="true" />
                Signed in
              </p>
            )}
            {step.kind === "over" && (
              <div role="alert" className="flex flex-col items-start gap-3">
                <p>{step.reason}</p>
                <button type="button" onClick={askForCode} className={PRIMARY}>
                  Get a new code
                </button>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const PRIMARY =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3.5 font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover";

/**
 * The code, a way to copy it, and the button that copies it and opens GitHub's page for it.
 *
 * @example <CodeToEnter code={{ userCode: "WDJB-MJHT", verificationUri: "https://github.com/login/device", … }} />
 */
function CodeToEnter({ code }: { code: DeviceCode }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code.userCode).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function copyAndOpen() {
    await copy();
    window.open(code.verificationUri, "_blank", "noopener");
  }

  return (
    <>
      <CodeBox>
        <span className="font-medium font-mono text-2xl tracking-[0.18em]">{code.userCode}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy the code"}
          className="absolute top-2 right-2 grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </CodeBox>

      <button
        type="button"
        onClick={copyAndOpen}
        // biome-ignore lint/a11y/noAutofocus: the one thing to do in the dialog, ready once the code arrives
        autoFocus
        className={cn(PRIMARY, "mt-4 w-full")}
      >
        Copy code and open GitHub
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </button>

      <p role="status" className="mt-3 flex items-center justify-center gap-2 text-muted-foreground text-xs">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        Waiting for GitHub
      </p>
    </>
  );
}

function CodeBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid h-24 place-items-center rounded-lg border border-border bg-secondary/50">
      {children ?? <span className="h-7 w-44 animate-pulse rounded-md bg-foreground/8" />}
    </div>
  );
}
