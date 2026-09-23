import { useEffect } from "react";
import { useBlocker } from "react-router-dom";

/** Warn on browser refresh/close when the form is dirty. */
export function useBeforeUnloadGuard(when: boolean) {
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);
}

/**
 * Blocks in-app navigation when `when` is true and shows a confirm dialog.
 * Pair with `useBeforeUnloadGuard` for full coverage.
 */
export function UnsavedGuard({ when, message = "You have unsaved changes. Leave without saving?" }: {
  when: boolean;
  message?: string;
}) {
  useBeforeUnloadGuard(when);
  const blocker = useBlocker(when);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const leave = window.confirm(message);
    if (leave) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, message]);

  return null;
}
