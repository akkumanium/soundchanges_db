"use client";

import { useTransition } from "react";
import { revertCatalogChangeAction } from "@/app/moderation/actions";

export function RevertChangeButton({ changeId }: { changeId: string }) {
  const [pending, startTransition] = useTransition();
  return <button className="button-secondary" type="button" disabled={pending} onClick={() => {
    if (!window.confirm("Revert this complete change? The reversion will be recorded as a new history entry.")) return;
    const data = new FormData();
    data.set("changeId", changeId);
    startTransition(() => revertCatalogChangeAction(data));
  }}>{pending ? "Reverting…" : "Revert change"}</button>;
}
