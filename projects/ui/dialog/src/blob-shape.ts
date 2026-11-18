/**
 * The outline of a blob toast: a pill that grows a card beneath it as one shape.
 *
 * `progress` 0 is the pill alone; 1 is the pill as a tab on a `width` x `bodyHeight` card, with a
 * concave join where the tab's sides meet the card's shoulders. In between the card grows out of the
 * pill's lower half. Above 1 (a spring overshooting) only the card's bottom edge moves further.
 *
 * The Flutter twin (`blob_shape.dart`) builds the same pieces from the same numbers.
 */
export interface UiBlobGeometry {
  /** Width of the card, and of the box the pill is placed in. */
  width: number;
  pillWidth: number;
  pillHeight: number;
  /** Height of the card below the pill when fully open. */
  bodyHeight: number;
  /** Where the pill sits over the card. `left` / `right` are flush with that side. */
  align: 'left' | 'center' | 'right';
  progress: number;
  /** Corner radius of the card. */
  radius: number;
  /** Radius of the concave join between tab and card. */
  fillet: number;
}

/** One closed piece of the outline, all drawn clockwise so they add up under either fill rule. */
export type UiBlobPiece =
  | { kind: 'rrect'; left: number; top: number; right: number; bottom: number; radius: number }
  | { kind: 'rect'; left: number; top: number; right: number; bottom: number }
  /** The sliver that rounds an inside corner at (x, y); `side` is the way the card runs from it. */
  | { kind: 'fillet'; x: number; y: number; r: number; side: -1 | 1 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The pieces whose union is the blob. The first is always the pill. */
export function uiBlobPieces(g: UiBlobGeometry): UiBlobPiece[] {
  const { width: W, pillHeight: ph, bodyHeight: H } = g;
  const pw = Math.min(g.pillWidth, W);
  const p = Math.max(0, g.progress);
  const pc = Math.min(1, p);
  const rp = ph / 2;
  const x0 = g.align === 'left' ? 0 : g.align === 'right' ? W - pw : (W - pw) / 2;
  const xr = x0 + pw;
  const pieces: UiBlobPiece[] = [{ kind: 'rrect', left: x0, top: 0, right: xr, bottom: ph, radius: rp }];
  if (p <= 0 || H <= 0) return pieces;

  // The card: from the flat part of the pill's lower half out to the full box.
  const l = lerp(Math.min(x0 + rp, (x0 + xr) / 2), 0, pc);
  const r = lerp(Math.max(xr - rp, (x0 + xr) / 2), W, pc);
  const t = lerp(rp, ph, pc);
  const b = ph + H * p;
  const rb = Math.max(0, Math.min(g.radius, (b - t) / 2, (r - l) / 2));
  pieces.push({ kind: 'rrect', left: l, top: t, right: r, bottom: b, radius: rb });

  // The neck squares off the pill's lower half down to the card, one half per side.
  const cx = (x0 + xr) / 2;
  for (const side of [-1, 1] as const) {
    const pillEdge = side < 0 ? x0 : xr;
    const cardEdge = side < 0 ? l : r;
    const flush = side < 0 ? x0 < 0.5 : W - xr < 0.5;
    if (flush) {
      // The tab's side runs straight into the card's: cover the card's rounded corner too.
      pieces.push(rect(cx, cardEdge, rp, t + rb));
      continue;
    }
    const shoulder = (cardEdge - pillEdge) * side;
    // Never past the flat part of the card's top edge.
    const neckEdge = side < 0 ? Math.max(pillEdge, cardEdge + rb) : Math.min(pillEdge, cardEdge - rb);
    if ((neckEdge - cx) * side > 0 && t > rp) pieces.push(rect(cx, neckEdge, rp, t));
    const f = Math.min(g.fillet, t - rp, shoulder - rb);
    if (f > 0.05) pieces.push({ kind: 'fillet', x: pillEdge, y: t, r: f, side });
  }
  return pieces;
}

function rect(x1: number, x2: number, top: number, bottom: number): UiBlobPiece {
  return { kind: 'rect', left: Math.min(x1, x2), top, right: Math.max(x1, x2), bottom };
}

const n = (v: number) => String(Math.round(v * 100) / 100);

/** The blob as SVG path data. */
export function uiBlobPath(g: UiBlobGeometry): string {
  return uiBlobPieces(g).map((s) => {
    if (s.kind === 'rect') return `M${n(s.left)} ${n(s.top)}H${n(s.right)}V${n(s.bottom)}H${n(s.left)}Z`;
    if (s.kind === 'fillet') {
      const { x, y, r, side } = s;
      // Clockwise both ways: along the card's top to the corner, up the tab, and back round the arc.
      return side < 0
        ? `M${n(x)} ${n(y - r)}V${n(y)}H${n(x - r)}A${n(r)} ${n(r)} 0 0 0 ${n(x)} ${n(y - r)}Z`
        : `M${n(x + r)} ${n(y)}H${n(x)}V${n(y - r)}A${n(r)} ${n(r)} 0 0 0 ${n(x + r)} ${n(y)}Z`;
    }
    const { left: l, top: t, right: r, bottom: b } = s;
    const q = Math.max(0, Math.min(s.radius, (r - l) / 2, (b - t) / 2));
    const a = `A${n(q)} ${n(q)} 0 0 1 `;
    return `M${n(l + q)} ${n(t)}H${n(r - q)}${a}${n(r)} ${n(t + q)}V${n(b - q)}${a}${n(r - q)} ${n(b)}H${n(l + q)}${a}${n(l)} ${n(b - q)}V${n(t + q)}${a}${n(l + q)} ${n(t)}Z`;
  }).join('');
}

/** A damped spring stepped by hand, so the toast can overshoot a little as the card lands. */
export class UiBlobSpring {
  value = 0;
  velocity = 0;
  target = 0;
  constructor(readonly stiffness = 260, readonly damping = 24) {}

  get resting(): boolean {
    return Math.abs(this.target - this.value) < 0.001 && Math.abs(this.velocity) < 0.01;
  }

  /** Advances by `dt` seconds. Closing never bounces: the value stops at 0. */
  step(dt: number): void {
    let left = Math.min(dt, 0.064);
    while (left > 0) {
      const h = Math.min(left, 0.004);
      this.velocity += (this.stiffness * (this.target - this.value) - this.damping * this.velocity) * h;
      this.value += this.velocity * h;
      left -= h;
    }
    if (this.value < 0) { this.value = 0; this.velocity = 0; }
    if (this.resting) { this.value = this.target; this.velocity = 0; }
  }
}
