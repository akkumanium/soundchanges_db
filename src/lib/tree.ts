export type ParentRecord = { id: string; parentId: string | null };
export type TransitionRecord = { id: string; sourceNodeId: string; targetNodeId: string };

export function wouldCreateCycle(nodes: ParentRecord[], nodeId: string, proposedParentId: string | null): boolean {
  if (!proposedParentId) return false;
  if (nodeId === proposedParentId) return true;
  const parents = new Map(nodes.map((node) => [node.id, node.parentId]));
  const seen = new Set<string>();
  let current: string | null | undefined = proposedParentId;
  while (current) {
    if (current === nodeId || seen.has(current)) return true;
    seen.add(current);
    current = parents.get(current);
  }
  return false;
}

/**
 * Find direct ancestor-to-target entries made obsolete when a more immediate
 * source stage is inserted before the target. Their rules belong to the new
 * transition, which now represents the final leg of the lineage.
 */
export function bypassedTransitionIds(
  nodes: ParentRecord[],
  transitionRows: TransitionRecord[],
  sourceId: string,
  targetId: string,
  destinationTransitionId: string,
): string[] {
  const parents = new Map(nodes.map((node) => [node.id, node.parentId]));
  const ancestors = new Set<string>();
  const seen = new Set<string>();
  let current = parents.get(sourceId);
  while (current && !seen.has(current)) {
    ancestors.add(current);
    seen.add(current);
    current = parents.get(current);
  }

  return transitionRows
    .filter((transition) =>
      transition.id !== destinationTransitionId
      && transition.targetNodeId === targetId
      && ancestors.has(transition.sourceNodeId))
    .map((transition) => transition.id);
}
