"use client";

import { useState } from "react";
import { addPairAction } from "@/app/moderation/actions";

export function PairCreator() {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="add-pair" type="button" onClick={() => setOpen(true)}>Add language pair</button>;
  return <form className="pair-creator" action={addPairAction}><label>From<input name="sourceName" required placeholder="Proto-language or stage" /></label><span>→</span><label>To<input name="targetName" required placeholder="Language or stage" /></label><button type="submit">Add</button><button type="button" className="cancel-edit" onClick={() => setOpen(false)}>Cancel</button></form>;
}
