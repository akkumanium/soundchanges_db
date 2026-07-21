export type ParentRecord = { id: string; parentId: string | null };

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
