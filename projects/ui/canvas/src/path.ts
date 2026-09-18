/**
 * Vector outlines for `ui-path-editor`: points with optional curve handles, grouped into contours,
 * grouped into items. Every function here is pure — it returns new values and never mutates — so a
 * host can keep its own history of edits.
 *
 * Coordinates are absolute in the editor's units, handles included. A point with neither handle is a
 * corner; one with handles is smooth, and the segment on either side of it is a cubic Bézier.
 */

export interface UiPathXY {
  x: number;
  y: number;
}

export interface UiPathPoint extends UiPathXY {
  /** Curve handle on the side of the previous point. */
  in?: UiPathXY | null;
  /** Curve handle on the side of the next point. */
  out?: UiPathXY | null;
}

export interface UiPathContour {
  points: UiPathPoint[];
  /** Closed outlines are filled; open ones are lines. */
  closed: boolean;
}

export interface UiPathItem {
  id: string;
  contours: UiPathContour[];
  /** Cut this out of the items below it rather than adding to them (the host decides what that means). */
  cut?: boolean;
  /**
   * How this item combines with the items below it, as in Photoshop's path operations: add to them, cut
   * out of them (same as `cut`), keep only where they overlap, or keep all but the overlap.
   */
  op?: UiPathOp;
  /** Paint for the item's fill preview in the editor. */
  fill?: string | null;
  name?: string;
}

export type UiPathOp = 'add' | 'cut' | 'intersect' | 'exclude';

/** An item's operation, reading the older `cut` flag too. */
export function itemOp(item: UiPathItem): UiPathOp {
  return item.op ?? (item.cut ? 'cut' : 'add');
}

export interface UiPathBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UiPointRef {
  contour: number;
  point: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The SVG `d` for a set of contours. */
export function pathD(contours: readonly UiPathContour[]): string {
  const parts: string[] = [];
  for (const c of contours) {
    const pts = c.points;
    if (!pts.length) continue;
    parts.push(`M${round(pts[0].x)} ${round(pts[0].y)}`);
    const count = c.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < count; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      parts.push(segmentD(a, b));
    }
    if (c.closed) parts.push('Z');
  }
  return parts.join(' ');
}

function segmentD(a: UiPathPoint, b: UiPathPoint): string {
  if (!a.out && !b.in) return `L${round(b.x)} ${round(b.y)}`;
  const c1 = a.out ?? a;
  const c2 = b.in ?? b;
  return `C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(b.x)} ${round(b.y)}`;
}

/** The `d` for one segment on its own (from point i to the next). */
export function segmentPathD(contour: UiPathContour, index: number): string {
  const a = contour.points[index];
  const b = contour.points[(index + 1) % contour.points.length];
  return `M${round(a.x)} ${round(a.y)} ${segmentD(a, b)}`;
}

/** How many segments a contour has. */
export function segmentCount(contour: UiPathContour): number {
  const n = contour.points.length;
  return n < 2 ? 0 : contour.closed ? n : n - 1;
}

function cubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** A point along segment i at t (0…1). */
export function pointOnSegment(contour: UiPathContour, index: number, t: number): UiPathXY {
  const a = contour.points[index];
  const b = contour.points[(index + 1) % contour.points.length];
  const c1 = a.out ?? a;
  const c2 = b.in ?? b;
  return { x: cubic(a.x, c1.x, c2.x, b.x, t), y: cubic(a.y, c1.y, c2.y, b.y, t) };
}

/** The contour as a polyline: curves sampled, straight segments kept as their two ends. */
export function flattenContour(contour: UiPathContour, stepsPerCurve = 16): UiPathXY[] {
  const out: UiPathXY[] = [];
  const pts = contour.points;
  if (!pts.length) return out;
  out.push({ x: pts[0].x, y: pts[0].y });
  for (let i = 0; i < segmentCount(contour); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (!a.out && !b.in) {
      out.push({ x: b.x, y: b.y });
      continue;
    }
    for (let s = 1; s <= stepsPerCurve; s++) out.push(pointOnSegment(contour, i, s / stepsPerCurve));
  }
  if (contour.closed && out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) out.pop();
  }
  return out;
}

/** Bounds of the drawn outline (curves sampled, not their handles). */
export function pathBounds(contours: readonly UiPathContour[]): UiPathBounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of contours) {
    for (const p of flattenContour(c, 24)) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

/** Applies a mapping to every point and handle. */
export function mapContours(contours: readonly UiPathContour[], f: (p: UiPathXY) => UiPathXY): UiPathContour[] {
  return contours.map((c) => ({
    closed: c.closed,
    points: c.points.map((p) => ({
      ...f(p),
      in: p.in ? f(p.in) : null,
      out: p.out ? f(p.out) : null,
    })),
  }));
}

export function translateContours(contours: readonly UiPathContour[], dx: number, dy: number): UiPathContour[] {
  return mapContours(contours, (p) => ({ x: p.x + dx, y: p.y + dy }));
}

/** Scales about an origin. */
export function scaleContours(contours: readonly UiPathContour[], ox: number, oy: number, sx: number, sy: number): UiPathContour[] {
  return mapContours(contours, (p) => ({ x: ox + (p.x - ox) * sx, y: oy + (p.y - oy) * sy }));
}

/** Rotates about a centre, in degrees. */
export function rotateContours(contours: readonly UiPathContour[], cx: number, cy: number, degrees: number): UiPathContour[] {
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return mapContours(contours, (p) => ({ x: cx + (p.x - cx) * cos - (p.y - cy) * sin, y: cy + (p.x - cx) * sin + (p.y - cy) * cos }));
}

/** The nearest spot on any segment to a point: which segment, where along it, and how far away. */
export function nearestOnPath(
  contours: readonly UiPathContour[], at: UiPathXY, samples = 32,
): { contour: number; segment: number; t: number; distance: number; point: UiPathXY } | null {
  let best: { contour: number; segment: number; t: number; distance: number; point: UiPathXY } | null = null;
  contours.forEach((c, ci) => {
    for (let s = 0; s < segmentCount(c); s++) {
      for (let k = 0; k <= samples; k++) {
        const t = k / samples;
        const p = pointOnSegment(c, s, t);
        const d = Math.hypot(p.x - at.x, p.y - at.y);
        if (!best || d < best.distance) best = { contour: ci, segment: s, t, distance: d, point: p };
      }
    }
  });
  return best;
}

function lerp(a: UiPathXY, b: UiPathXY, t: number): UiPathXY {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function replaceContour(contours: readonly UiPathContour[], index: number, next: UiPathContour | UiPathContour[]): UiPathContour[] {
  const list = [...contours];
  list.splice(index, 1, ...(Array.isArray(next) ? next : [next]));
  return list;
}

/** Adds a point on segment `segment` at t, keeping the curve exactly as it was. */
export function insertPoint(contours: readonly UiPathContour[], contour: number, segment: number, t: number): { contours: UiPathContour[]; point: UiPointRef } {
  const c = contours[contour];
  const pts = c.points.map((p) => ({ ...p }));
  const i = segment;
  const j = (segment + 1) % pts.length;
  const a = pts[i];
  const b = pts[j];
  let added: UiPathPoint;
  if (!a.out && !b.in) {
    added = lerp(a, b, t);
  } else {
    // de Casteljau: the two halves of the curve share the new point.
    const p0: UiPathXY = a;
    const p1 = a.out ?? a;
    const p2 = b.in ?? b;
    const p3: UiPathXY = b;
    const q0 = lerp(p0, p1, t), q1 = lerp(p1, p2, t), q2 = lerp(p2, p3, t);
    const r0 = lerp(q0, q1, t), r1 = lerp(q1, q2, t);
    const s = lerp(r0, r1, t);
    pts[i] = { ...a, out: q0 };
    pts[j] = { ...b, in: q2 };
    added = { x: s.x, y: s.y, in: r0, out: r1 };
  }
  pts.splice(i + 1, 0, added);
  return { contours: replaceContour(contours, contour, { closed: c.closed, points: pts }), point: { contour, point: i + 1 } };
}

/** Removes a point. A contour left with fewer than two points goes too. */
export function deletePoint(contours: readonly UiPathContour[], ref: UiPointRef): UiPathContour[] {
  const c = contours[ref.contour];
  const pts = c.points.filter((_, i) => i !== ref.point);
  if (pts.length < 2) return contours.filter((_, i) => i !== ref.contour);
  return replaceContour(contours, ref.contour, { closed: c.closed && pts.length > 2, points: pts });
}

/**
 * Breaks the outline at a point. A closed outline opens there (the point becomes both of its ends);
 * an open one splits into two lines that each keep a copy of the point.
 */
export function breakAt(contours: readonly UiPathContour[], ref: UiPointRef): UiPathContour[] {
  const c = contours[ref.contour];
  const pts = c.points;
  const at = pts[ref.point];
  if (c.closed) {
    const rotated = [...pts.slice(ref.point), ...pts.slice(0, ref.point)];
    const end = { ...at, out: null };
    const start = { ...at, in: null };
    return replaceContour(contours, ref.contour, { closed: false, points: [start, ...rotated.slice(1), end] });
  }
  if (ref.point === 0 || ref.point === pts.length - 1) return [...contours];
  const first = [...pts.slice(0, ref.point), { ...at, out: null }];
  const second = [{ ...at, in: null }, ...pts.slice(ref.point + 1)];
  return replaceContour(contours, ref.contour, [{ closed: false, points: first }, { closed: false, points: second }]);
}

/** Closes an open outline, or reopens a closed one at its first point. */
export function toggleClosed(contours: readonly UiPathContour[], contour: number): UiPathContour[] {
  const c = contours[contour];
  if (c.closed) return breakAt(contours, { contour, point: 0 });
  return replaceContour(contours, contour, { closed: c.points.length > 2, points: c.points });
}

/**
 * Joins the ends of two open outlines (or closes one onto itself) where the two given end points are.
 * Ends that sit on top of each other become one point.
 */
export function joinEnds(contours: readonly UiPathContour[], a: UiPointRef, b: UiPointRef): UiPathContour[] {
  const ca = contours[a.contour];
  const cb = contours[b.contour];
  const isEnd = (c: UiPathContour, i: number) => !c.closed && (i === 0 || i === c.points.length - 1);
  if (!isEnd(ca, a.point) || !isEnd(cb, b.point)) return [...contours];
  if (a.contour === b.contour) return toggleClosed(contours, a.contour);
  // Orient so A ends at the joining point and B starts at it.
  const aPts = a.point === 0 ? [...ca.points].reverse().map(swapHandles) : ca.points;
  const bPts = b.point === 0 ? cb.points : [...cb.points].reverse().map(swapHandles);
  const last = aPts[aPts.length - 1];
  const first = bPts[0];
  const same = Math.hypot(last.x - first.x, last.y - first.y) < 0.5;
  const merged = same
    ? [...aPts.slice(0, -1), { ...last, out: first.out ?? null }, ...bPts.slice(1)]
    : [...aPts, ...bPts];
  const joined: UiPathContour = { closed: false, points: merged };
  const rest = contours.filter((_, i) => i !== a.contour && i !== b.contour);
  return [...rest, joined];
}

function swapHandles(p: UiPathPoint): UiPathPoint {
  return { ...p, in: p.out ?? null, out: p.in ?? null };
}

/**
 * Makes a corner smooth (handles along the line between its neighbours, a third of the way to each)
 * or a smooth point a corner (handles removed).
 */
export function toggleSmooth(contours: readonly UiPathContour[], ref: UiPointRef): UiPathContour[] {
  const c = contours[ref.contour];
  const pts = c.points;
  const p = pts[ref.point];
  let next: UiPathPoint;
  if (p.in || p.out) {
    next = { x: p.x, y: p.y, in: null, out: null };
  } else {
    const n = pts.length;
    const prev = ref.point > 0 ? pts[ref.point - 1] : c.closed ? pts[n - 1] : null;
    const after = ref.point < n - 1 ? pts[ref.point + 1] : c.closed ? pts[0] : null;
    const dirFrom = prev ?? p;
    const dirTo = after ?? p;
    let dx = dirTo.x - dirFrom.x;
    let dy = dirTo.y - dirFrom.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const back = prev ? Math.hypot(p.x - prev.x, p.y - prev.y) / 3 : 0;
    const fwd = after ? Math.hypot(after.x - p.x, after.y - p.y) / 3 : 0;
    next = {
      x: p.x, y: p.y,
      in: prev ? { x: p.x - dx * back, y: p.y - dy * back } : null,
      out: after ? { x: p.x + dx * fwd, y: p.y + dy * fwd } : null,
    };
  }
  return replaceContour(contours, ref.contour, { closed: c.closed, points: pts.map((q, i) => (i === ref.point ? next : q)) });
}

/** Moves a point and its handles together. */
export function movePoint(contours: readonly UiPathContour[], ref: UiPointRef, to: UiPathXY): UiPathContour[] {
  const c = contours[ref.contour];
  const p = c.points[ref.point];
  const dx = to.x - p.x;
  const dy = to.y - p.y;
  const moved: UiPathPoint = {
    x: to.x, y: to.y,
    in: p.in ? { x: p.in.x + dx, y: p.in.y + dy } : null,
    out: p.out ? { x: p.out.x + dx, y: p.out.y + dy } : null,
  };
  return replaceContour(contours, ref.contour, { closed: c.closed, points: c.points.map((q, i) => (i === ref.point ? moved : q)) });
}

/** Moves several points (and their handles) by the same amount. */
export function movePoints(contours: readonly UiPathContour[], refs: readonly UiPointRef[], dx: number, dy: number): UiPathContour[] {
  const moving = new Set(refs.map((r) => `${r.contour}:${r.point}`));
  return contours.map((c, ci) => ({
    closed: c.closed,
    points: c.points.map((p, pi) => {
      if (!moving.has(`${ci}:${pi}`)) return p;
      return {
        x: p.x + dx, y: p.y + dy,
        in: p.in ? { x: p.in.x + dx, y: p.in.y + dy } : null,
        out: p.out ? { x: p.out.x + dx, y: p.out.y + dy } : null,
      };
    }),
  }));
}

/** Removes several points at once (see `deletePoint` for what happens to a contour left too short). */
export function deletePoints(contours: readonly UiPathContour[], refs: readonly UiPointRef[]): UiPathContour[] {
  const doomed = new Set(refs.map((r) => `${r.contour}:${r.point}`));
  const out: UiPathContour[] = [];
  contours.forEach((c, ci) => {
    const pts = c.points.filter((_, pi) => !doomed.has(`${ci}:${pi}`));
    if (pts.length === c.points.length) out.push(c);
    else if (pts.length >= 2) out.push({ closed: c.closed && pts.length > 2, points: pts });
  });
  return out;
}

/** Every point of every contour. */
export function allPoints(contours: readonly UiPathContour[]): UiPointRef[] {
  return contours.flatMap((c, contour) => c.points.map((_, point) => ({ contour, point })));
}

/**
 * Pulls handles out of a point, both in line with the drag (the Convert Point tool): the handle on the
 * next segment follows the pointer, the other mirrors it.
 */
export function pullHandles(contours: readonly UiPathContour[], ref: UiPointRef, to: UiPathXY): UiPathContour[] {
  const c = contours[ref.contour];
  const p = c.points[ref.point];
  const next: UiPathPoint = { x: p.x, y: p.y, out: { x: to.x, y: to.y }, in: { x: 2 * p.x - to.x, y: 2 * p.y - to.y } };
  return replaceContour(contours, ref.contour, { closed: c.closed, points: c.points.map((q, i) => (i === ref.point ? next : q)) });
}

/** The same outline traced the other way round. */
export function reverseContour(c: UiPathContour): UiPathContour {
  return { closed: c.closed, points: [...c.points].reverse().map(swapHandles) };
}

/** Twice the signed area of a contour's outline: positive runs clockwise on screen. */
export function contourArea(c: UiPathContour): number {
  const pts = flattenContour(c, 12);
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s;
}

/** Whether a point is inside a closed contour (even–odd, curves sampled). */
export function insideContour(c: UiPathContour, at: UiPathXY): boolean {
  const pts = flattenContour(c, 12);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if ((a.y > at.y) !== (b.y > at.y) && at.x < ((b.x - a.x) * (at.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Winds an item's closed outlines consistently — outer outlines clockwise, holes the other way — so
 * that under the non-zero rule pieces add up instead of cancelling where they overlap (a piece flipped
 * by scaling, or drawn the other way round with the pen, would otherwise punch a hole).
 */
export function orientContours(contours: readonly UiPathContour[]): UiPathContour[] {
  const closed = contours.filter((c) => c.closed && c.points.length > 2);
  return contours.map((c) => {
    if (!c.closed || c.points.length < 3) return c;
    const probe = c.points[0];
    const depth = closed.filter((o) => o !== c && insideContour(o, probe)).length;
    const clockwise = contourArea(c) > 0;
    return clockwise === (depth % 2 === 0) ? c : reverseContour(c);
  });
}

/**
 * Moves one handle of a point. The opposite handle turns to stay in line (keeping its own length), so a
 * smooth point stays smooth — hold `free` to bend just the one side.
 */
export function moveHandle(
  contours: readonly UiPathContour[], ref: UiPointRef, side: 'in' | 'out', to: UiPathXY, free = false,
): UiPathContour[] {
  const c = contours[ref.contour];
  const p = c.points[ref.point];
  const other = side === 'in' ? p.out : p.in;
  let mirrored = other ?? null;
  if (other && !free) {
    const len = Math.hypot(other.x - p.x, other.y - p.y);
    const dx = p.x - to.x;
    const dy = p.y - to.y;
    const d = Math.hypot(dx, dy) || 1;
    mirrored = { x: p.x + (dx / d) * len, y: p.y + (dy / d) * len };
  }
  const next: UiPathPoint = side === 'in' ? { ...p, in: to, out: mirrored } : { ...p, out: to, in: mirrored };
  return replaceContour(contours, ref.contour, { closed: c.closed, points: c.points.map((q, i) => (i === ref.point ? next : q)) });
}

// ----- Starting shapes ---------------------------------------------------------------------------

const KAPPA = 0.5522847498;

export function rectContour(x: number, y: number, w: number, h: number, radius = 0): UiPathContour {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (r <= 0) {
    return { closed: true, points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] };
  }
  const k = r * KAPPA;
  return {
    closed: true,
    points: [
      { x: x + r, y, in: { x: x + r - k, y }, out: null },
      { x: x + w - r, y, in: null, out: { x: x + w - r + k, y } },
      { x: x + w, y: y + r, in: { x: x + w, y: y + r - k }, out: null },
      { x: x + w, y: y + h - r, in: null, out: { x: x + w, y: y + h - r + k } },
      { x: x + w - r, y: y + h, in: { x: x + w - r + k, y: y + h }, out: null },
      { x: x + r, y: y + h, in: null, out: { x: x + r - k, y: y + h } },
      { x, y: y + h - r, in: { x, y: y + h - r + k }, out: null },
      { x, y: y + r, in: null, out: { x, y: y + r - k } },
    ],
  };
}

export function ellipseContour(cx: number, cy: number, rx: number, ry: number): UiPathContour {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return {
    closed: true,
    points: [
      { x: cx, y: cy - ry, in: { x: cx - kx, y: cy - ry }, out: { x: cx + kx, y: cy - ry } },
      { x: cx + rx, y: cy, in: { x: cx + rx, y: cy - ky }, out: { x: cx + rx, y: cy + ky } },
      { x: cx, y: cy + ry, in: { x: cx + kx, y: cy + ry }, out: { x: cx - kx, y: cy + ry } },
      { x: cx - rx, y: cy, in: { x: cx - rx, y: cy + ky }, out: { x: cx - rx, y: cy - ky } },
    ],
  };
}

/** A regular polygon (3 sides is a triangle), pointing up, fitting the box. */
export function polygonContour(x: number, y: number, w: number, h: number, sides: number): UiPathContour {
  const n = Math.max(3, Math.min(64, Math.round(sides)));
  return {
    closed: true,
    points: Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: x + w / 2 + (w / 2) * Math.cos(a), y: y + h / 2 + (h / 2) * Math.sin(a) };
    }),
  };
}

export function starContour(x: number, y: number, w: number, h: number, spikes = 5, inner = 0.45): UiPathContour {
  const n = Math.max(3, Math.min(24, Math.round(spikes)));
  return {
    closed: true,
    points: Array.from({ length: n * 2 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / n;
      const r = i % 2 === 0 ? 1 : inner;
      return { x: x + w / 2 + (w / 2) * r * Math.cos(a), y: y + h / 2 + (h / 2) * r * Math.sin(a) };
    }),
  };
}

/** A door or window: straight sides and bottom, a round top. */
export function archContour(x: number, y: number, w: number, h: number): UiPathContour {
  const r = Math.min(w / 2, h);
  const k = r * KAPPA;
  const top = y + r;
  return {
    closed: true,
    points: [
      { x, y: y + h },
      { x, y: top, in: null, out: { x, y: top - k } },
      { x: x + w / 2, y, in: { x: x + w / 2 - k, y }, out: { x: x + w / 2 + k, y } },
      { x: x + w, y: top, in: { x: x + w, y: top - k }, out: null },
      { x: x + w, y: y + h },
    ],
  };
}
