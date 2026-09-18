/**
 * Ink for `ui-path-editor`'s draw mode: how a brush turns the samples of a stroke (where the pen went,
 * and how hard it pressed) into the area it paints.
 *
 * A brush is a nib: a circle, or a flat ellipse held at an angle, whose size follows the pressure (or,
 * for a mouse or a finger, how fast it moves). At every sample the nib leaves a stamp; the area between
 * two stamps is their convex hull. The stroke is the union of those hulls — exactly what was painted,
 * loops and overlaps included. Every hull winds the same way, so drawing them as one path with the
 * non-zero rule shows that union without computing it; a host that wants one clean outline unions the
 * hulls with a polygon library (`inkArea` hands them over).
 *
 * All pure: the editor collects samples, these functions shape them.
 */
import type { UiPathXY } from './path';

export type UiBrushKind = 'pen' | 'marker' | 'pencil' | 'brush' | 'calligraphy' | 'eraser';

export interface UiBrush {
  kind: UiBrushKind;
  /** Nib width at normal pressure, in editor units. */
  size: number;
}

export interface UiInkSample extends UiPathXY {
  /** 0…1. Pens report it; for a mouse or a finger it is worked out from speed. */
  pressure: number;
}

interface Profile {
  /** How much pressure changes the width (0 none, 1 from a hairline to wide). */
  pressure: number;
  /** For a finger or mouse: how much speed thins the line. */
  speed: number;
  /** Nib shape: aspect (1 round) and angle in degrees. */
  aspect: number;
  angle: number;
  /** Taper at the start and end, in nib widths. */
  taperStart: number;
  taperEnd: number;
  /** How much the input is steadied (0 raw, 0.8 very smooth). */
  steady: number;
}

const PROFILES: Record<UiBrushKind, Profile> = {
  // A fineliner: even, a touch of pressure so it doesn't look mechanical.
  pen: { pressure: 0.2, speed: 0, aspect: 1, angle: 0, taperStart: 0, taperEnd: 0, steady: 0.35 },
  // A chisel marker: broad, flat, even.
  marker: { pressure: 0, speed: 0, aspect: 0.45, angle: -35, taperStart: 0, taperEnd: 0, steady: 0.45 },
  // A pencil: thin, very pressure-sensitive.
  pencil: { pressure: 0.85, speed: 0.2, aspect: 1, angle: 0, taperStart: 0.6, taperEnd: 0.6, steady: 0.3 },
  // A round brush: swells with pressure, thins when fast, comes to a point at both ends.
  brush: { pressure: 0.9, speed: 0.6, aspect: 1, angle: 0, taperStart: 3, taperEnd: 4, steady: 0.5 },
  // A broad-edge pen: thick across the nib, hairline along it.
  calligraphy: { pressure: 0.45, speed: 0, aspect: 0.14, angle: 45, taperStart: 0, taperEnd: 0, steady: 0.45 },
  eraser: { pressure: 0, speed: 0, aspect: 1, angle: 0, taperStart: 0, taperEnd: 0, steady: 0.3 },
};

/** How much a brush smooths the pen's path as it is drawn (0 raw … 1 very smooth). */
export function brushSteadiness(kind: UiBrushKind): number {
  return PROFILES[kind].steady;
}

/** Whether a brush's width follows pressure at all — a host can show that in its brush picker. */
export function brushUsesPressure(kind: UiBrushKind): boolean {
  return PROFILES[kind].pressure > 0;
}

/**
 * Pressure for pointers that don't have any: slow is firm, fast is light (how ink behaves), for the
 * brushes that care. `prev` is the pressure worked out for the sample before, `distance` how far the
 * pointer went since, in editor units.
 */
export function simulatedPressure(kind: UiBrushKind, prev: number, distance: number, size: number): number {
  const speed = Math.min(1, distance / Math.max(0.5, size * 1.2));
  const target = 0.5 + PROFILES[kind].speed * (0.15 - 0.45 * speed);
  return prev + (target - prev) * 0.35;
}

/**
 * The nib's half-size at each sample, pressure and tapering applied. While the stroke is still being
 * drawn (`finished` false) its end isn't known, so only the start tapers — and every radius depends on
 * its own sample alone, which lets the editor extend a stroke without redoing what's drawn.
 */
export function inkRadii(samples: readonly UiInkSample[], brush: UiBrush, finished = true): number[] {
  const pr = PROFILES[brush.kind];
  const base = Math.max(0.05, brush.size / 2);
  const lengths = [0];
  for (let i = 1; i < samples.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
  }
  const total = lengths.at(-1) ?? 0;
  const startLen = pr.taperStart * brush.size;
  const endLen = pr.taperEnd * brush.size;
  return samples.map((s, i) => {
    let f = pressureFactor(pr, s.pressure);
    if (startLen > 0) f *= ease(Math.min(1, lengths[i] / (finished ? Math.min(startLen, total / 2) || 1 : startLen)));
    if (finished && endLen > 0 && total > 0) f *= ease(Math.min(1, (total - lengths[i]) / Math.min(endLen, total / 2)));
    return base * Math.max(0.08, f);
  });
}

/** One sample's radius while drawing, `along` being how far into the stroke it is (see `inkRadii`). */
export function inkRadiusAt(sample: UiInkSample, along: number, brush: UiBrush): number {
  const pr = PROFILES[brush.kind];
  let f = pressureFactor(pr, sample.pressure);
  const startLen = pr.taperStart * brush.size;
  if (startLen > 0) f *= ease(Math.min(1, along / startLen));
  return Math.max(0.05, brush.size / 2) * Math.max(0.08, f);
}

/** p = 0.5 draws at the brush's size; harder is wider, lighter is thinner. */
function pressureFactor(pr: Profile, pressure: number): number {
  return 1 + pr.pressure * (Math.max(0, Math.min(1, pressure)) - 0.5) * 1.6;
}

/** The painted piece between two samples (or a single dot when `b` is null). */
export function inkPiece(a: UiPathXY, ra: number, b: UiPathXY | null, rb: number, brush: UiBrush): UiPathXY[] {
  const pr = PROFILES[brush.kind];
  const sa = stamp(a, ra, pr, stampSegments(pr, ra));
  return convexHull(b ? [...sa, ...stamp(b, rb, pr, stampSegments(pr, rb))] : sa);
}

const stampSegments = (pr: Profile, r: number) => (pr.aspect < 0.3 ? 12 : Math.max(10, Math.min(28, Math.round(8 + r * 1.5))));

const ease = (t: number) => 0.15 + 0.85 * Math.sin((t * Math.PI) / 2);

/** The nib's outline at one sample. */
function stamp(at: UiPathXY, r: number, pr: Profile, segments: number): UiPathXY[] {
  const a = (pr.angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const ry = Math.max(r * pr.aspect, 0.04);
  const out: UiPathXY[] = [];
  for (let k = 0; k < segments; k++) {
    const t = (k * 2 * Math.PI) / segments;
    const x = r * Math.cos(t);
    const y = ry * Math.sin(t);
    out.push({ x: at.x + x * cos - y * sin, y: at.y + x * sin + y * cos });
  }
  return out;
}

/** Convex hull (Andrew's monotone chain), counter-clockwise in screen terms. */
export function convexHull(points: readonly UiPathXY[]): UiPathXY[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: UiPathXY, a: UiPathXY, b: UiPathXY) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: UiPathXY[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: UiPathXY[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

/**
 * The area a stroke paints, as convex pieces that all wind the same way: one per step between samples
 * (a single sample is one stamp, a dot). Their union is the stroke.
 */
export function inkArea(samples: readonly UiInkSample[], brush: UiBrush): UiPathXY[][] {
  if (!samples.length) return [];
  const radii = inkRadii(samples, brush);
  if (samples.length === 1) return [inkPiece(samples[0], radii[0], null, 0, brush)];
  const pieces: UiPathXY[][] = [];
  for (let i = 1; i < samples.length; i++) pieces.push(inkPiece(samples[i - 1], radii[i - 1], samples[i], radii[i], brush));
  return pieces;
}

/** The pieces as one SVG path (draw it with `fill-rule: nonzero`). */
export function inkD(pieces: readonly UiPathXY[][]): string {
  return pieces.map(pieceD).join('');
}

export function pieceD(piece: readonly UiPathXY[]): string {
  if (!piece.length) return '';
  let d = `M${r2(piece[0].x)} ${r2(piece[0].y)}`;
  for (let i = 1; i < piece.length; i++) d += `L${r2(piece[i].x)} ${r2(piece[i].y)}`;
  return d + 'Z';
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Samples closer together than `spacing` merge into one (the last keeps the heaviest pressure), so a pen
 * resting in place doesn't pile up stamps.
 */
export function thinSamples(samples: readonly UiInkSample[], spacing: number): UiInkSample[] {
  const out: UiInkSample[] = [];
  for (const s of samples) {
    const last = out.at(-1);
    if (last && Math.hypot(s.x - last.x, s.y - last.y) < spacing) {
      last.pressure = Math.max(last.pressure, s.pressure);
      continue;
    }
    out.push({ ...s });
  }
  const end = samples.at(-1);
  const kept = out.at(-1);
  if (end && kept && (kept.x !== end.x || kept.y !== end.y)) out.push({ ...end });
  return out;
}

// ----- Snap to shape -------------------------------------------------------------------------------
//
// Hold the pen still at the end of a stroke and it snaps to what it looked like — a straight line, a
// circle or ellipse, a rectangle, a triangle — drawn with the same brush (Apple's "snap to shape").

export type UiInkShape =
  | { kind: 'line'; from: UiPathXY; to: UiPathXY }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'polygon'; points: UiPathXY[] };

/** What a stroke most looks like, or null if it's just a scribble. */
export function recognizeShape(samples: readonly UiPathXY[]): UiInkShape | null {
  if (samples.length < 3) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, length = 0;
  samples.forEach((p, i) => {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    if (i) length += Math.hypot(p.x - samples[i - 1].x, p.y - samples[i - 1].y);
  });
  const size = Math.hypot(maxX - minX, maxY - minY);
  if (size < 1e-6 || length < 1e-6) return null;
  const gap = Math.hypot(last.x - first.x, last.y - first.y);

  // Straight: the ends are nearly as far apart as the stroke is long.
  if (gap / length > 0.94) return { kind: 'line', from: { x: first.x, y: first.y }, to: { x: last.x, y: last.y } };
  // Anything else has to come back round to where it started.
  if (gap > Math.max(size * 0.28, length * 0.12)) return null;

  const loop = [...samples];
  const corners = cornerPoints(loop, size * 0.09);
  if (corners.length === 3 || corners.length === 4) {
    const fit = polygonFit(loop, corners);
    if (fit < size * 0.06) {
      if (corners.length === 4) return { kind: 'polygon', points: squareUp(corners) };
      return { kind: 'polygon', points: corners };
    }
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = (maxX - minX) / 2;
  const ry = (maxY - minY) / 2;
  // Ellipse: every sample is about the same normalised distance from the middle.
  const off = loop.reduce((worst, p) => {
    const d = Math.hypot((p.x - cx) / Math.max(rx, 1e-6), (p.y - cy) / Math.max(ry, 1e-6));
    return Math.max(worst, Math.abs(d - 1));
  }, 0);
  if (off < 0.3) {
    // Nearly round is round.
    const r = (rx + ry) / 2;
    return Math.abs(rx - ry) / r < 0.14 ? { kind: 'ellipse', cx, cy, rx: r, ry: r } : { kind: 'ellipse', cx, cy, rx, ry };
  }
  return null;
}

/** The corners of a closed stroke, by simplifying it until only the sharp turns are left. */
function cornerPoints(loop: UiPathXY[], tolerance: number): UiPathXY[] {
  const pts = rdp([...loop, loop[0]], tolerance);
  pts.pop();
  // Neighbouring corners closer than a tolerance are one corner (where the stroke closed up).
  const merged: UiPathXY[] = [];
  for (const p of pts) {
    const prev = merged.at(-1);
    if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < tolerance * 2.5) continue;
    merged.push(p);
  }
  if (merged.length > 2 && Math.hypot(merged[0].x - merged.at(-1)!.x, merged[0].y - merged.at(-1)!.y) < tolerance * 2.5) merged.pop();
  return merged;
}

function rdp(points: UiPathXY[], tolerance: number): UiPathXY[] {
  if (points.length < 3) return points;
  const a = points[0];
  const b = points[points.length - 1];
  let far = -1;
  let dist = tolerance;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(points[i], a, b);
    if (d > dist) { dist = d; far = i; }
  }
  if (far < 0) return [a, b];
  const left = rdp(points.slice(0, far + 1), tolerance);
  const right = rdp(points.slice(far), tolerance);
  return [...left.slice(0, -1), ...right];
}

function distanceToSegment(p: UiPathXY, a: UiPathXY, b: UiPathXY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** How far the stroke strays from the polygon through the corners, at its worst. */
function polygonFit(loop: UiPathXY[], corners: UiPathXY[]): number {
  let worst = 0;
  for (const p of loop) {
    let best = Infinity;
    for (let i = 0; i < corners.length; i++) best = Math.min(best, distanceToSegment(p, corners[i], corners[(i + 1) % corners.length]));
    worst = Math.max(worst, best);
  }
  return worst;
}

/** A four-cornered stroke that's nearly a rectangle becomes one (sides square to the page if close). */
function squareUp(corners: UiPathXY[]): UiPathXY[] {
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  // Each corner near a corner of the box? Then it's an upright rectangle.
  const box = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }];
  const near = corners.every((p) => box.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < Math.max(w, h) * 0.2));
  if (!near) return corners;
  // Keep the direction it was drawn in.
  const start = box.reduce((bi, q, i) => (Math.hypot(corners[0].x - q.x, corners[0].y - q.y) < Math.hypot(corners[0].x - box[bi].x, corners[0].y - box[bi].y) ? i : bi), 0);
  const area = corners.reduce((s, p, i) => { const q = corners[(i + 1) % 4]; return s + p.x * q.y - q.x * p.y; }, 0);
  const order = area > 0 ? [0, 1, 2, 3] : [0, 3, 2, 1];
  return order.map((k) => box[(start + k) % 4]);
}

/**
 * Samples along a recognised shape, at the stroke's average pressure — so the snapped shape is drawn
 * with the same brush as the stroke it replaced.
 */
export function shapeSamples(shape: UiInkShape, pressure: number, step: number): UiInkSample[] {
  const out: UiInkSample[] = [];
  const along = (a: UiPathXY, b: UiPathXY, withEnd: boolean) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let i = 0; i < n + (withEnd ? 1 : 0); i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n, pressure });
  };
  if (shape.kind === 'line') {
    along(shape.from, shape.to, true);
  } else if (shape.kind === 'polygon') {
    const pts = shape.points;
    pts.forEach((p, i) => along(p, pts[(i + 1) % pts.length], i === pts.length - 1));
  } else {
    const n = Math.max(24, Math.ceil((Math.PI * 2 * Math.max(shape.rx, shape.ry)) / step));
    for (let i = 0; i <= n; i++) {
      const t = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      out.push({ x: shape.cx + shape.rx * Math.cos(t), y: shape.cy + shape.ry * Math.sin(t), pressure });
    }
  }
  return out;
}
