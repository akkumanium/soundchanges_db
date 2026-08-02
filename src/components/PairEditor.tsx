"use client";

import { useState, useTransition } from "react";
import type { CatalogNode, CatalogTransition } from "@/db/queries";
import { deletePairAction, editPairAction, movePairAction } from "@/app/moderation/actions";

type Row = { id: string; revision: number; approvalStatus: "pending" | "approved" | "rejected"; input: string; output: string; environment: string; exceptions: string; exceptionExamples: string; comment: string; examples: string };
type RuleSnapshot = Omit<Row, "revision" | "approvalStatus"> & { explanation: string };
export function PairEditor({ entry, nodes, canDeleteApproved = false }: { entry: CatalogTransition; nodes: CatalogNode[]; canDeleteApproved?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [, startMove] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => entry.rules.map((rule) => ({ id: rule.id, revision: rule.revision, approvalStatus: rule.approvalStatus, input: rule.input, output: rule.output, environment: rule.environment, exceptions: rule.exceptions, exceptionExamples: rule.exceptionExamples.join(", "), comment: rule.qualifier, examples: rule.examples.map((example) => example.targetForm).join(", ") })));
  const add = () => setRows((current) => [...current, { id: "", revision: 0, approvalStatus: "pending", input: "", output: "", environment: "", exceptions: "", exceptionExamples: "", comment: "", examples: "" }]);
  const moveRule = (index: number, direction: "up" | "down") => setRows((current) => {
    const target = index + (direction === "up" ? -1 : 1);
    if (target < 0 || target >= current.length) return current;
    const reordered = [...current];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    return reordered;
  });
  const move = (direction: "up" | "down") => startMove(() => { const data = new FormData(); data.set("transitionId", entry.id); data.set("direction", direction); return movePairAction(data); });
  const removePair = () => { if (!window.confirm(`Delete “${entry.title}” and all of its sound changes? This cannot be undone.`)) return; startMove(() => { const data = new FormData(); data.set("transitionId", entry.id); return deletePairAction(data); }); };
  const canDeletePair = canDeleteApproved || ((entry.sourceApprovalStatus === "pending" || entry.targetApprovalStatus === "pending") && entry.rules.every((rule) => rule.approvalStatus === "pending"));
  if (!editing) return <button type="button" className="pair-edit" onClick={() => setEditing(true)} aria-label={`Edit ${entry.title}`}>✏️</button>;
  const languageListId = `languages-${entry.id}`;
  return <form action={editPairAction} className="pair-editor"><input type="hidden" name="transitionId" value={entry.id} /><input type="hidden" name="transitionRevision" value={entry.revision} />
    {entry.rules.map((rule) => <input key={rule.id} type="hidden" name="originalRule" value={JSON.stringify(ruleSnapshot(rule))} />)}
    {canDeleteApproved && <div className="pair-editor__move"><span>Pair order</span><button type="button" onClick={() => move("up")}>↑</button><button type="button" onClick={() => move("down")}>↓</button></div>}
    <div className="pair-editor__names"><label>From<input name="sourceName" list={languageListId} required defaultValue={entry.sourceName} /></label><span>→</span><label>To<input name="targetName" list={languageListId} required defaultValue={entry.targetName} /></label></div><datalist id={languageListId}>{nodes.map((node) => <option key={node.id} value={node.name} />)}</datalist>
    <label className="pair-editor__source">Source citation<input name="sourceCitation" readOnly={!canDeleteApproved} defaultValue={entry.sources[0]?.displayCitation ?? ""} placeholder="Author, year, title" /></label>
    <div className="pair-editor__rows">{rows.map((row, index) => { const editable = canDeleteApproved || !row.id || row.approvalStatus === "pending"; return <div className={`rule-fields${editable ? "" : " rule-fields--locked"}`} key={`${row.id}-${index}`}>
      <input type="hidden" name="ruleId" value={row.id} /><input type="hidden" name="ruleRevision" value={row.revision} />
      <div className="rule-fields__order" aria-label={`Move sound change ${index + 1}`}><button type="button" onClick={() => moveRule(index, "up")} disabled={!canDeleteApproved || index === 0} aria-label="Move sound change up">↑</button><button type="button" onClick={() => moveRule(index, "down")} disabled={!canDeleteApproved || index === rows.length - 1} aria-label="Move sound change down">↓</button></div>
      <input name="input" aria-label="Proto sound" required readOnly={!editable} value={row.input} onChange={(event) => update(index, "input", event.target.value, setRows)} placeholder="p" /><span>→</span><input name="output" aria-label="Resulting sound" required readOnly={!editable} value={row.output} onChange={(event) => update(index, "output", event.target.value, setRows)} placeholder="f" />
      <span>/</span><input name="environment" aria-label="Environment" readOnly={!editable} value={row.environment} onChange={(event) => update(index, "environment", event.target.value, setRows)} placeholder="V_V" /><span>/ !</span><input name="exceptions" aria-label="Exceptions" readOnly={!editable} value={row.exceptions} onChange={(event) => update(index, "exceptions", event.target.value, setRows)} placeholder="exceptions" />
      <span>/</span><input name="exceptionExamples" aria-label="Exception examples" readOnly={!editable} value={row.exceptionExamples} onChange={(event) => update(index, "exceptionExamples", event.target.value, setRows)} placeholder="exception words" /><span>/</span><input name="comment" aria-label="Comment" readOnly={!editable} value={row.comment} onChange={(event) => update(index, "comment", event.target.value, setRows)} placeholder="comment" /><span>/</span><input name="examples" aria-label="Examples" readOnly={!editable} value={row.examples} onChange={(event) => update(index, "examples", event.target.value, setRows)} placeholder="examples, comma-separated" />
      {(canDeleteApproved || !row.id || row.approvalStatus === "pending") && <button type="button" className="remove-rule" onClick={() => { if (window.confirm("Remove this sound change? This cannot be undone after saving.")) setRows((current) => current.filter((_, rowIndex) => rowIndex !== index)); }} aria-label="Remove sound change">×</button>}
    </div>; })}</div>
    <div className="pair-editor__actions"><button type="button" className="add-rule" onClick={add}>+</button><button type="submit">Save</button><button type="button" className="cancel-edit" onClick={() => setEditing(false)}>Cancel</button>{canDeletePair && <button type="button" className="delete-pair" onClick={removePair}>Delete pair</button>}</div>
  </form>;
}
function update(index: number, key: keyof Row, value: string, setRows: React.Dispatch<React.SetStateAction<Row[]>>) { setRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row)); }

function ruleSnapshot(rule: CatalogTransition["rules"][number]): RuleSnapshot {
  return {
    id: rule.id,
    input: rule.input,
    output: rule.output,
    environment: rule.environment,
    exceptions: rule.exceptions,
    exceptionExamples: rule.exceptionExamples.join(", "),
    comment: rule.qualifier,
    examples: rule.examples.map((example) => example.targetForm).join(", "),
    explanation: rule.explanation,
  };
}
