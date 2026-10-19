import type { UiWfLifecycle } from './schema';

/**
 * Lays out a lifecycle diagram: states in columns by how many moves they are from the starting
 * state, ordered inside a column to keep arrows short. The algorithm is deterministic (no
 * randomness, ties broken by state order) and mirrored in the Flutter library, so a lifecycle
 * looks the same on both; `layout.spec.ts` and the Flutter tests check the same cases.
 */

export const WF_NODE_W = 172;
export const WF_NODE_H = 56;
export const WF_GAP_X = 96;
export const WF_GAP_Y = 40;

export interface UiWfPoint {
  x: number;
  y: number;
}

export interface UiWfEdge {
  id: string;
  from: string;
  to: string;
  /** Goes against the flow (to an earlier column or the same one): drawn as a loop underneath. */
  back: boolean;
}

export interface UiWfLayout {
  /** Top-left corner of each state's card. */
  positions: Record<string, UiWfPoint>;
  edges: UiWfEdge[];
  width: number;
  height: number;
}

/** The arrows of a lifecycle (transitions from "any state" are drawn separately, not as edges). */
export function lifecycleEdges(lc: UiWfLifecycle): { id: string; from: string; to: string }[] {
  const ids = new Set(lc.states.map((s) => s.id));
  const out: { id: string; from: string; to: string }[] = [];
  for (const t of lc.transitions) {
    if (t.from === '*' || !ids.has(t.to)) continue;
    for (const f of t.from) if (ids.has(f) && f !== t.to) out.push({ id: `${t.id}:${f}`, from: f, to: t.to });
  }
  return out;
}

/**
 * Transitions that leave a state and come back to it (e.g. "Ask for more documents" from Review to
 * Review). They don't take part in the layout; the diagram draws each as a loop over its card.
 */
export function lifecycleSelfLoops(lc: UiWfLifecycle): { id: string; state: string }[] {
  const ids = new Set(lc.states.map((s) => s.id));
  return lc.transitions.filter((t) => t.from !== '*' && ids.has(t.to) && t.from.includes(t.to)).map((t) => ({ id: `${t.id}:${t.to}`, state: t.to }));
}

/** A loop over the top of a card (`at` is its top-left corner), and where its label goes. */
export function selfLoopPath(at: UiWfPoint, lane = 0): { d: string; label: UiWfPoint } {
  const x1 = at.x + WF_NODE_W * 0.62 + lane * 8, x2 = at.x + WF_NODE_W * 0.38 - lane * 8, y = at.y;
  const top = y - 30 - lane * 12;
  return { d: `M ${x1} ${y} C ${x1} ${top}, ${x2} ${top}, ${x2} ${y}`, label: { x: (x1 + x2) / 2, y: top + 4 } };
}

export function autoLayout(lc: UiWfLifecycle, keepManual = true): UiWfLayout {
  const states = lc.states;
  const index = new Map(states.map((s, i) => [s.id, i]));
  const raw = lifecycleEdges(lc);
  const out = new Map<string, string[]>(states.map((s) => [s.id, []]));
  for (const e of raw) out.get(e.from)!.push(e.to);

  // 1. Break cycles with a depth-first walk from the starting state (then any unvisited state, in order):
  //    an edge to a state still on the walk's stack goes back.
  const back = new Set<string>();
  const color = new Map<string, 0 | 1 | 2>();
  const visit = (id: string) => {
    color.set(id, 1);
    for (const e of raw.filter((x) => x.from === id)) {
      const c = color.get(e.to) ?? 0;
      if (c === 1) back.add(e.id);
      else if (c === 0) visit(e.to);
    }
    color.set(id, 2);
  };
  const initial = states.find((s) => s.category === 'initial') ?? states[0];
  if (initial) visit(initial.id);
  for (const s of states) if (!color.get(s.id)) visit(s.id);
  const forward = raw.filter((e) => !back.has(e.id));

  // 2. Columns: the longest forward path from a state with no forward arrows into it.
  const rank = new Map<string, number>(states.map((s) => [s.id, 0]));
  for (let pass = 0; pass < states.length; pass++) {
    let changed = false;
    for (const e of forward) {
      const r = (rank.get(e.from) ?? 0) + 1;
      if (r > (rank.get(e.to) ?? 0)) { rank.set(e.to, r); changed = true; }
    }
    if (!changed) break;
  }

  // A final state no arrow leads to (reached only "from any state") goes with the other outcomes, last.
  const lastRank = Math.max(0, ...rank.values());
  for (const st of states)
    if (st.category === 'terminal' && lastRank > 0 && !forward.some((e) => e.to === st.id || e.from === st.id)) rank.set(st.id, lastRank);

  // 3. Order inside columns: start in state order, then two barycentre sweeps (down then up).
  const maxRank = Math.max(0, ...rank.values());
  const columns: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const s of states) columns[rank.get(s.id)!].push(s.id);
  const pos = () => {
    const m = new Map<string, number>();
    for (const col of columns) col.forEach((id, i) => m.set(id, i));
    return m;
  };
  const sweep = (down: boolean) => {
    const order = down ? columns.map((_, i) => i).slice(1) : columns.map((_, i) => i).reverse().slice(1);
    for (const c of order) {
      const p = pos();
      const neighbours = (id: string) => forward.filter((e) => (down ? e.to === id : e.from === id)).map((e) => (down ? e.from : e.to)).map((n) => p.get(n)!);
      const score = (id: string) => {
        const ns = neighbours(id);
        return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : p.get(id)!;
      };
      columns[c] = [...columns[c]].sort((a, b) => score(a) - score(b) || index.get(a)! - index.get(b)!);
    }
  };
  sweep(true);
  sweep(false);

  // 4. Coordinates: columns left to right, each column centred on the tallest one.
  const tallest = Math.max(1, ...columns.map((c) => c.length));
  const positions: Record<string, UiWfPoint> = {};
  columns.forEach((col, c) => {
    const offset = ((tallest - col.length) * (WF_NODE_H + WF_GAP_Y)) / 2;
    col.forEach((id, i) => (positions[id] = { x: c * (WF_NODE_W + WF_GAP_X), y: Math.round(offset + i * (WF_NODE_H + WF_GAP_Y)) }));
  });
  if (keepManual && lc.layout) {
    for (const [id, p] of Object.entries(lc.layout)) if (positions[id] && Array.isArray(p) && p.length === 2) positions[id] = { x: p[0], y: p[1] };
  }
  const xs = Object.values(positions);
  const width = xs.length ? Math.max(...xs.map((p) => p.x)) + WF_NODE_W : WF_NODE_W;
  const height = xs.length ? Math.max(...xs.map((p) => p.y)) + WF_NODE_H : WF_NODE_H;
  const edges = raw.map((e) => ({ ...e, back: back.has(e.id) || (positions[e.to]?.x ?? 0) <= (positions[e.from]?.x ?? 0) }));
  return { positions, edges, width, height };
}

/**
 * An arrow between two cards as an SVG path with rounded right-angle bends, and where its label
 * goes. Forward arrows leave a card's right side and enter the next card's left side; arrows going
 * back loop underneath both cards. `lane` separates arrows that share the same pair of cards.
 */
export function edgePath(from: UiWfPoint, to: UiWfPoint, back: boolean, lane = 0): { d: string; label: UiWfPoint } {
  const r = 8;
  if (!back) {
    const x1 = from.x + WF_NODE_W, y1 = from.y + WF_NODE_H / 2 + lane * 10;
    const x2 = to.x, y2 = to.y + WF_NODE_H / 2 + lane * 10;
    const mx = Math.round((x1 + x2) / 2);
    if (Math.abs(y2 - y1) < 1) return { d: `M ${x1} ${y1} H ${x2}`, label: { x: mx, y: y1 - 8 } };
    const dir = y2 > y1 ? 1 : -1;
    const rr = Math.min(r, Math.abs(y2 - y1) / 2, Math.abs(mx - x1));
    return {
      d: `M ${x1} ${y1} H ${mx - rr} Q ${mx} ${y1} ${mx} ${y1 + dir * rr} V ${y2 - dir * rr} Q ${mx} ${y2} ${mx + rr} ${y2} H ${x2}`,
      label: { x: mx, y: (y1 + y2) / 2 },
    };
  }
  const x1 = from.x + WF_NODE_W / 2 + lane * 12, y1 = from.y + WF_NODE_H;
  const x2 = to.x + WF_NODE_W / 2 + lane * 12, y2 = to.y + WF_NODE_H;
  // Lanes a label's height apart, so stacked arrows' labels don't overlap.
  const low = Math.max(y1, y2) + 28 + lane * 22;
  const dir = x2 > x1 ? 1 : -1;
  return {
    d: `M ${x1} ${y1} V ${low - r} Q ${x1} ${low} ${x1 + dir * r} ${low} H ${x2 - dir * r} Q ${x2} ${low} ${x2} ${low - r} V ${y2}`,
    label: { x: (x1 + x2) / 2, y: low },
  };
}
