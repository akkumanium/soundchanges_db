"use client";

import { useTransition } from "react";
import { discardCatalogChangeAction, verifyCatalogChangeAction } from "@/app/moderation/actions";

export function BrowseReviewActions({ changeId }: { changeId: string }) {
  const [pending, startTransition] = useTransition();

  function run(action: "verify" | "discard") {
    if (action === "discard" && !window.confirm("Discard this complete change and restore the previous catalogue state?")) return;
    const data = new FormData();
    data.set("changeId", changeId);
    startTransition(() => action === "verify" ? verifyCatalogChangeAction(data) : discardCatalogChangeAction(data));
  }

  return <span className="inline-review__actions">
    <button type="button" disabled={pending} onClick={() => run("verify")}>Verify</button>
    <button className="inline-review__discard" type="button" disabled={pending} onClick={() => run("discard")}>Discard</button>
  </span>;
}
