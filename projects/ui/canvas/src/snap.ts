import { Component, input } from '@angular/core';

/** An axis-aligned rectangle in stage units. */
export interface UiRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A guide line to draw: vertical at x = `at` spanning y from..to, or horizontal at y = `at`. */
export interface UiGuide {
  orientation: 'vertical' | 'horizontal';
  at: number;
  from: number;
  to: number;
}

export interface UiSnapResult {
  /** Offset to add to the moving rect so it snaps. */
  dx: number;
  dy: number;
  guides: UiGuide[];
}

/**
 * Snaps a moving rectangle's edges and centre to those of other rectangles (and any extra lines,
 * such as the stage's own centre). Each axis snaps independently to its closest candidate within
 * `threshold` stage units.
 *
 * Pure: give it rects in stage units, get back an offset and the guides to show.
 */
export function uiSnap(
  moving: UiRect,
  targets: readonly UiRect[],
  threshold: number,
  extra: { vertical?: readonly number[]; horizontal?: readonly number[] } = {},
): UiSnapResult {
  const xs = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const ys = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];

  type Candidate = { line: number; span: [number, number] };
  const vertical: Candidate[] = (extra.vertical ?? []).map((line) => ({ line, span: [-1e9, 1e9] }));
  const horizontal: Candidate[] = (extra.horizontal ?? []).map((line) => ({ line, span: [-1e9, 1e9] }));
  for (const t of targets) {
    for (const line of [t.x, t.x + t.w / 2, t.x + t.w]) vertical.push({ line, span: [t.y, t.y + t.h] });
    for (const line of [t.y, t.y + t.h / 2, t.y + t.h]) horizontal.push({ line, span: [t.x, t.x + t.w] });
  }

  const best = (values: number[], candidates: Candidate[]) => {
    let result: { delta: number; line: number; span: [number, number] } | null = null;
    for (const v of values)
      for (const c of candidates) {
        const delta = c.line - v;
        if (Math.abs(delta) <= threshold && (!result || Math.abs(delta) < Math.abs(result.delta)))
          result = { delta, line: c.line, span: c.span };
      }
    return result;
  };

  const bx = best(xs, vertical);
  const by = best(ys, horizontal);
  const dx = bx?.delta ?? 0;
  const dy = by?.delta ?? 0;
  const guides: UiGuide[] = [];
  const snapped = { x: moving.x + dx, y: moving.y + dy, w: moving.w, h: moving.h };

  // A guide spans the moving rect and the rect it snapped to, so you can see what lined up.
  if (bx) {
    const infinite = bx.span[0] < -1e8;
    const from = infinite ? snapped.y : Math.min(snapped.y, bx.span[0]);
    const to = infinite ? snapped.y + snapped.h : Math.max(snapped.y + snapped.h, bx.span[1]);
    guides.push({ orientation: 'vertical', at: bx.line, from, to });
  }
  if (by) {
    const infinite = by.span[0] < -1e8;
    const from = infinite ? snapped.x : Math.min(snapped.x, by.span[0]);
    const to = infinite ? snapped.x + snapped.w : Math.max(snapped.x + snapped.w, by.span[1]);
    guides.push({ orientation: 'horizontal', at: by.line, from, to });
  }
  return { dx, dy, guides };
}

/** The axis-aligned bounds of a rotated box. */
export function uiRotatedBounds(box: UiRect & { rotate?: number }): UiRect {
  const rad = ((box.rotate ?? 0) * Math.PI) / 180;
  if (!rad) return { x: box.x, y: box.y, w: box.w, h: box.h };
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = box.w * cos + box.h * sin;
  const h = box.w * sin + box.h * cos;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** `ui-snap-guides` — draws guide lines from {@link uiSnap} over a positioned stage. */
@Component({
  selector: 'ui-snap-guides',
  host: { 'aria-hidden': 'true' },
  template: `
    @for (g of guides(); track $index) {
      @if (g.orientation === 'vertical') {
        <span class="g v" [style.left.px]="g.at * scale()" [style.top.px]="g.from * scale()" [style.height.px]="(g.to - g.from) * scale()"></span>
      } @else {
        <span class="g h" [style.top.px]="g.at * scale()" [style.left.px]="g.from * scale()" [style.width.px]="(g.to - g.from) * scale()"></span>
      }
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
    .g { position: absolute; background: var(--ui-color-accent, var(--ui-color-danger)); }
    .g.v { width: 1px; margin-left: -0.5px; }
    .g.h { height: 1px; margin-top: -0.5px; }
  `,
})
export class UiSnapGuides {
  guides = input<readonly UiGuide[]>([]);
  scale = input(1);
}
