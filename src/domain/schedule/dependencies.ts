// Schedule dependency helpers — Gantt view + CPM support (Step 23).
//
// Covers three concerns:
//   1. Cycle-safe candidate filtering for the "add predecessor" UI.
//      Given a milestone A, a valid predecessor is any milestone on
//      the same project that is NOT reachable as a successor of A
//      (reachable = would create a cycle via A → ... → candidate → A).
//      The picker uses this so users never see invalid options.
//   2. Critical-path computation. For every connected component in
//      the dependency graph, find the longest-duration chain and
//      mark the nodes on it as "critical." Multiple disconnected
//      components each produce their own critical path; we return
//      the union.
//   3. Cycle detection for the server-side add-dependency guard —
//      belt-and-braces even though the client filtered the picker.

export type GraphNode = {
  id: string;
  projectId: string;
  // Inclusive start/end in epoch ms. For marker milestones (no
  // startDate), `startMs` and `endMs` are identical — duration 0.
  // For duration tasks, startMs = startDate, endMs = scheduledDate.
  startMs: number;
  endMs: number;
};

export type Edge = { predecessorId: string; successorId: string };

// --------------------------------------------------------------------
// Adjacency builders
// --------------------------------------------------------------------

export function buildAdjacency(
  edges: Edge[],
): {
  successorsOf: Map<string, Set<string>>;
  predecessorsOf: Map<string, Set<string>>;
} {
  const successorsOf = new Map<string, Set<string>>();
  const predecessorsOf = new Map<string, Set<string>>();
  for (const e of edges) {
    const s = successorsOf.get(e.predecessorId) ?? new Set();
    s.add(e.successorId);
    successorsOf.set(e.predecessorId, s);
    const p = predecessorsOf.get(e.successorId) ?? new Set();
    p.add(e.predecessorId);
    predecessorsOf.set(e.successorId, p);
  }
  return { successorsOf, predecessorsOf };
}

// --------------------------------------------------------------------
// Cycle-safe candidate filter
//
// Valid predecessors for `milestoneId` = all same-project milestones
// OTHER than (a) itself, (b) any node reachable by walking FORWARD
// from milestoneId (because adding those as predecessors would close
// a loop A → ... → B → A). Also excludes any existing predecessors
// so the picker doesn't offer duplicates.
// --------------------------------------------------------------------

export function getValidPredecessorCandidates(input: {
  milestoneId: string;
  allNodes: GraphNode[];
  edges: Edge[];
}): string[] {
  const { milestoneId, allNodes, edges } = input;
  const target = allNodes.find((n) => n.id === milestoneId);
  if (!target) return [];

  const { successorsOf, predecessorsOf } = buildAdjacency(edges);

  // BFS forward from milestoneId to collect everything downstream.
  const reachable = new Set<string>();
  const queue: string[] = [milestoneId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const succs = successorsOf.get(current);
    if (!succs) continue;
    for (const s of succs) {
      if (!reachable.has(s)) {
        reachable.add(s);
        queue.push(s);
      }
    }
  }

  const existingPreds = predecessorsOf.get(milestoneId) ?? new Set();

  return allNodes
    .filter((n) => n.projectId === target.projectId)
    .filter((n) => n.id !== milestoneId)
    .filter((n) => !reachable.has(n.id))
    .filter((n) => !existingPreds.has(n.id))
    .map((n) => n.id);
}

// Server-side guard: would adding (predecessorId → successorId)
// create a cycle? Returns true if `successorId` is reachable by
// walking forward from `predecessorId` transitively — if so, closing
// the edge would loop. Cheap BFS bounded by the graph size.
export function wouldCreateCycle(input: {
  predecessorId: string;
  successorId: string;
  edges: Edge[];
}): boolean {
  if (input.predecessorId === input.successorId) return true;
  const { successorsOf } = buildAdjacency(input.edges);
  const queue: string[] = [input.successorId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === input.predecessorId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const succs = successorsOf.get(current);
    if (!succs) continue;
    for (const s of succs) queue.push(s);
  }
  return false;
}

// --------------------------------------------------------------------
// Critical-path computation
//
// For each connected component, find the node chain with the largest
// total duration (longest earliest-finish time). Returns the union of
// critical nodes across every component, so a project with three
// disconnected dependency chains gets three highlighted paths.
//
// Algorithm: memoized DFS computing longestFinishFrom(node), defined
// as the max end-time reachable by walking forward from `node` along
// any successor chain. The critical node set is then any node whose
// earliestFinish == latestFinish (no slack) within its component.
// --------------------------------------------------------------------

export function computeCriticalPath(input: {
  nodes: GraphNode[];
  edges: Edge[];
}): Set<string> {
  const { nodes, edges } = input;
  if (nodes.length === 0) return new Set();

  const { successorsOf, predecessorsOf } = buildAdjacency(edges);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Group into connected components via undirected BFS.
  const components: string[][] = [];
  const visited = new Set<string>();
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const comp: string[] = [];
    const queue = [n.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      comp.push(cur);
      for (const s of successorsOf.get(cur) ?? []) queue.push(s);
      for (const p of predecessorsOf.get(cur) ?? []) queue.push(p);
    }
    components.push(comp);
  }

  const critical = new Set<string>();
  for (const comp of components) {
    // Skip trivial singletons — a lone node with no deps has no
    // "path" to highlight and marking it critical visually adds
    // noise rather than information.
    if (comp.length < 2) continue;

    // Forward pass: earliestFinish[node] = max(earliestFinish[pred]) + duration.
    // If no predecessors within the component, earliestFinish = endMs
    // (wall-clock end). Nodes keyed by id.
    const earliestFinish = new Map<string, number>();
    const topoOrder = topologicalSort(comp, successorsOf, predecessorsOf);
    for (const id of topoOrder) {
      const node = nodeById.get(id);
      if (!node) continue;
      const duration = Math.max(0, node.endMs - node.startMs);
      const preds = predecessorsOf.get(id);
      if (!preds || preds.size === 0) {
        earliestFinish.set(id, node.endMs);
        continue;
      }
      let maxPred = 0;
      for (const p of preds) {
        maxPred = Math.max(maxPred, earliestFinish.get(p) ?? 0);
      }
      earliestFinish.set(id, maxPred + duration);
    }

    // Component project finish = max earliestFinish across terminal
    // nodes (no successors in this component).
    let projectFinish = 0;
    for (const id of comp) {
      if ((successorsOf.get(id)?.size ?? 0) === 0) {
        projectFinish = Math.max(projectFinish, earliestFinish.get(id) ?? 0);
      }
    }

    // Backward pass: latestFinish[node] = min(latestFinish[succ] - succ.duration).
    // Terminals start at projectFinish.
    const latestFinish = new Map<string, number>();
    for (const id of [...topoOrder].reverse()) {
      const node = nodeById.get(id);
      if (!node) continue;
      const succs = successorsOf.get(id);
      if (!succs || succs.size === 0) {
        latestFinish.set(id, projectFinish);
        continue;
      }
      let minSuccLateStart = Infinity;
      for (const s of succs) {
        const succNode = nodeById.get(s);
        if (!succNode) continue;
        const succDuration = Math.max(0, succNode.endMs - succNode.startMs);
        const succLateFinish = latestFinish.get(s) ?? projectFinish;
        minSuccLateStart = Math.min(
          minSuccLateStart,
          succLateFinish - succDuration,
        );
      }
      latestFinish.set(
        id,
        minSuccLateStart === Infinity ? projectFinish : minSuccLateStart,
      );
    }

    // Critical = zero-slack nodes (EF == LF). Small rounding tolerance
    // in case dates-as-ms introduce sub-second drift.
    const TOLERANCE_MS = 1000;
    for (const id of comp) {
      const ef = earliestFinish.get(id);
      const lf = latestFinish.get(id);
      if (ef == null || lf == null) continue;
      if (Math.abs(ef - lf) <= TOLERANCE_MS) critical.add(id);
    }
  }

  return critical;
}

// Kahn's topo sort over a specific node set. Returns ids in
// dependency-respecting order (predecessors before successors).
// Cycles would break this, but they're rejected at insert time via
// wouldCreateCycle — defensive fallback ignores any orphan loops.
function topologicalSort(
  nodeIds: string[],
  successorsOf: Map<string, Set<string>>,
  predecessorsOf: Map<string, Set<string>>,
): string[] {
  const idSet = new Set(nodeIds);
  const inDegree = new Map<string, number>();
  for (const id of nodeIds) {
    const preds = predecessorsOf.get(id);
    let d = 0;
    if (preds) for (const p of preds) if (idSet.has(p)) d += 1;
    inDegree.set(id, d);
  }
  const ready: string[] = [];
  for (const [id, d] of inDegree) if (d === 0) ready.push(id);

  const order: string[] = [];
  while (ready.length > 0) {
    const cur = ready.shift()!;
    order.push(cur);
    const succs = successorsOf.get(cur);
    if (!succs) continue;
    for (const s of succs) {
      if (!idSet.has(s)) continue;
      const next = (inDegree.get(s) ?? 0) - 1;
      inDegree.set(s, next);
      if (next === 0) ready.push(s);
    }
  }
  // If order.length < nodeIds.length, there's a cycle we failed to
  // detect earlier. Append the leftovers so the CP computation
  // doesn't silently drop nodes — they'll just miss the EF/LF
  // bookkeeping and won't be marked critical.
  for (const id of nodeIds) if (!order.includes(id)) order.push(id);
  return order;
}
