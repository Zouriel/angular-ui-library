/**
 * The pixel work behind `ui-image-editor`, kept free of the DOM so it can be tested anywhere and kept in
 * step with the Flutter port (`image_edit.dart`).
 *
 * An edit is the original pixels plus a **mask** (one byte a pixel: 255 keeps the pixel, 0 erases it) and
 * a **crop** rectangle. Brushes only change the mask, so restoring always brings back the original.
 *
 * Undo keeps per-stroke diffs: the mask is split into 64 × 64 tiles, a stroke records the tiles it
 * touched (before and after, run-length encoded), and a crop change records the two rectangles. History
 * keeps up to 100 steps within 64 MB of encoded data, dropping the oldest first.
 */

/** A crop, in image pixels. */
export interface UiImageCrop { x: number; y: number; width: number; height: number; }

export type UiImageEditorMode = 'crop' | 'erase' | 'restore';

/** Straight (not premultiplied) RGBA pixels, row by row. */
export interface UiImageRaster { width: number; height: number; data: Uint8ClampedArray; }

/** A crop handle, or the inside of the crop ('move'). */
export type UiCropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

export const UI_IMAGE_MAX_SIDE = 4096;
export const UI_CROP_MIN = 8;
const TILE = 64;
const MAX_STEPS = 100;
const MAX_BYTES = 64 * 1024 * 1024;

export interface UiDirtyRect { x: number; y: number; w: number; h: number; }

// ----- Brush -----------------------------------------------------------------------------------------

/**
 * How strongly a round brush of radius `r` acts at distance `d` from its centre (1 full, 0 none).
 * `softness` 0 is a hard edge (with a one-pixel anti-aliased rim), 1 fades from the centre out.
 */
export function brushFalloff(d: number, r: number, softness: number): number {
  const s = Math.min(1, Math.max(0, softness));
  const inner = r * (1 - s);
  if (r - inner < 1) return Math.min(1, Math.max(0, r + 0.5 - d));
  if (d <= inner) return 1;
  if (d >= r) return 0;
  const t = (d - inner) / (r - inner);
  return 1 - t * t * (3 - 2 * t);
}

// ----- Run-length encoding ---------------------------------------------------------------------------

/** Pairs of (run length 1–255, value). A mask is mostly long runs of 255 and 0. */
export function rleEncode(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const v = bytes[i];
    let n = 1;
    while (n < 255 && i + n < bytes.length && bytes[i + n] === v) n++;
    out.push(n, v);
    i += n;
  }
  return Uint8Array.from(out);
}

export function rleDecode(rle: Uint8Array, into: Uint8Array): Uint8Array {
  let o = 0;
  for (let i = 0; i < rle.length; i += 2) {
    into.fill(rle[i + 1], o, o + rle[i]);
    o += rle[i];
  }
  return into;
}

// ----- Crop geometry ---------------------------------------------------------------------------------

export function fullCrop(width: number, height: number): UiImageCrop {
  return { x: 0, y: 0, width, height };
}

export function sameCrop(a: UiImageCrop | null | undefined, b: UiImageCrop | null | undefined): boolean {
  return !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** Keeps a crop whole-pixel, inside the image, and at least the minimum size. */
export function clampCrop(c: UiImageCrop, W: number, H: number): UiImageCrop {
  const min = Math.min(UI_CROP_MIN, W, H);
  const width = Math.round(Math.min(W, Math.max(min, c.width)));
  const height = Math.round(Math.min(H, Math.max(min, c.height)));
  const x = Math.round(Math.min(W - width, Math.max(0, c.x)));
  const y = Math.round(Math.min(H - height, Math.max(0, c.y)));
  return { x, y, width, height };
}

/** The largest crop with ratio `aspect` (width / height) inside `within`, centred on it. */
export function fitAspect(within: UiImageCrop, aspect: number, W: number, H: number): UiImageCrop {
  let w = within.width;
  let h = within.height;
  if (w / h > aspect) w = h * aspect;
  else h = w / aspect;
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(w / aspect));
  if (h > within.height) { h = Math.round(within.height); w = Math.max(1, Math.round(h * aspect)); }
  const x = within.x + (within.width - w) / 2;
  const y = within.y + (within.height - h) / 2;
  return { x: Math.round(Math.min(W - w, Math.max(0, x))), y: Math.round(Math.min(H - h, Math.max(0, y))), width: w, height: h };
}

/**
 * Where a crop goes when `handle` is dragged by (dx, dy) image pixels from `start`: inside the image, at
 * least 8 px, and keeping `aspect` (width / height) when it's set. Corners keep the opposite corner
 * still; edges keep the opposite edge still (and, with an aspect, stay centred the other way).
 */
export function dragCrop(start: UiImageCrop, handle: UiCropHandle, dx: number, dy: number, W: number, H: number, aspect: number | null): UiImageCrop {
  const min = Math.min(UI_CROP_MIN, W, H);
  if (handle === 'move') {
    return clampCrop({ ...start, x: start.x + dx, y: start.y + dy }, W, H);
  }
  const L = start.x, T = start.y, R = start.x + start.width, B = start.y + start.height;
  const west = handle.includes('w'), east = handle.includes('e'), north = handle.includes('n'), south = handle.includes('s');
  if (!aspect) {
    let l = L, t = T, r = R, b = B;
    if (west) l = Math.min(Math.max(0, L + dx), R - min);
    if (east) r = Math.max(Math.min(W, R + dx), L + min);
    if (north) t = Math.min(Math.max(0, T + dy), B - min);
    if (south) b = Math.max(Math.min(H, B + dy), T + min);
    const x = Math.round(l), y = Math.round(t);
    return { x, y, width: Math.round(r) - x, height: Math.round(b) - y };
  }
  const minW = Math.max(min, min * aspect);
  const finish = (x: number, y: number, w: number) => {
    let width = Math.max(1, Math.round(w));
    let height = Math.max(1, Math.round(width / aspect));
    if (height > H) { height = H; width = Math.round(height * aspect); }
    if (width > W) { width = W; height = Math.round(width / aspect); }
    const cx = Math.round(Math.min(W - width, Math.max(0, x)));
    const cy = Math.round(Math.min(H - height, Math.max(0, y)));
    return { x: cx, y: cy, width, height };
  };
  if ((west || east) && (north || south)) {
    const ax = west ? R : L, ay = north ? B : T;
    const px = (west ? L : R) + dx, py = (north ? T : B) + dy;
    const rawW = (px - ax) * (east ? 1 : -1);
    const rawH = (py - ay) * (south ? 1 : -1);
    const maxW = Math.min(east ? W - ax : ax, (south ? H - ay : ay) * aspect);
    const w = Math.min(maxW, Math.max(minW, rawW, rawH * aspect));
    const h = w / aspect;
    return finish(east ? ax : ax - w, south ? ay : ay - h, w);
  }
  if (west || east) {
    const ax = west ? R : L;
    const cy = (T + B) / 2;
    const rawW = ((west ? L : R) + dx - ax) * (east ? 1 : -1);
    const maxW = Math.min(east ? W - ax : ax, 2 * Math.min(cy, H - cy) * aspect);
    const w = Math.min(maxW, Math.max(minW, rawW));
    return finish(east ? ax : ax - w, cy - w / aspect / 2, w);
  }
  const ay = north ? B : T;
  const cx = (L + R) / 2;
  const rawH = ((north ? T : B) + dy - ay) * (south ? 1 : -1);
  const maxH = Math.min(south ? H - ay : ay, (2 * Math.min(cx, W - cx)) / aspect);
  const h = Math.min(maxH, Math.max(minW / aspect, rawH));
  const w = h * aspect;
  return finish(cx - w / 2, south ? ay : ay - h, w);
}

// ----- The edit --------------------------------------------------------------------------------------

interface TileDiff { index: number; before: Uint8Array; after: Uint8Array; }
interface Step { tiles: TileDiff[]; crop: { before: UiImageCrop; after: UiImageCrop } | null; bytes: number; }

interface Stroke {
  mode: 'erase' | 'restore';
  r: number;
  softness: number;
  /** Tile index -> its mask bytes before the stroke. */
  saved: Map<number, Uint8Array>;
  /** The last two pointer positions, for the curve through them. */
  prev: { x: number; y: number };
  last: { x: number; y: number };
}

/**
 * One image being edited: pixels, mask, crop and history. `onDirty` hears which part of the image needs
 * redrawing after any change.
 */
export class UiImageEdit {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
  readonly mask: Uint8Array;
  crop: UiImageCrop;
  private readonly cols: number;
  private readonly rows: number;
  /** 1 for each tile with anything erased in it. */
  private readonly marked: Uint8Array;
  private markedCount = 0;
  private undoStack: Step[] = [];
  private redoStack: Step[] = [];
  private bytes = 0;
  private stroke: Stroke | null = null;
  onDirty: (r: UiDirtyRect) => void = () => {};

  constructor(raster: UiImageRaster) {
    this.width = raster.width;
    this.height = raster.height;
    this.pixels = raster.data;
    this.mask = new Uint8Array(this.width * this.height).fill(255);
    this.crop = fullCrop(this.width, this.height);
    this.cols = Math.ceil(this.width / TILE);
    this.rows = Math.ceil(this.height / TILE);
    this.marked = new Uint8Array(this.cols * this.rows);
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  get stepCount(): number { return this.undoStack.length; }
  get historyBytes(): number { return this.bytes; }
  get stroking(): boolean { return !!this.stroke; }

  /** Anything erased, or a crop smaller than the image. */
  get dirty(): boolean {
    return this.markedCount > 0 || !sameCrop(this.crop, fullCrop(this.width, this.height));
  }

  /** The mask value (0–255) at a pixel. */
  maskAt(x: number, y: number): number {
    return this.mask[Math.floor(y) * this.width + Math.floor(x)];
  }

  // ----- Strokes -----

  /** Starts a stroke at (x, y) in image pixels; `size` is the brush's diameter. Paints the first dab. */
  beginStroke(mode: 'erase' | 'restore', x: number, y: number, size: number, softness: number): void {
    this.cancelStroke();
    this.stroke = { mode, r: Math.max(0.5, size / 2), softness, saved: new Map(), prev: { x, y }, last: { x, y } };
    this.segment({ x, y }, { x, y });
  }

  /**
   * Carries the stroke on to (x, y). The line bends smoothly through the pointer positions: each step
   * draws the curve from the middle of the last two moves to the middle of the next.
   */
  strokeTo(x: number, y: number): void {
    const s = this.stroke;
    if (!s) return;
    if (Math.hypot(x - s.last.x, y - s.last.y) < 0.5) return;
    const from = { x: (s.prev.x + s.last.x) / 2, y: (s.prev.y + s.last.y) / 2 };
    const to = { x: (s.last.x + x) / 2, y: (s.last.y + y) / 2 };
    this.curve(from, s.last, to);
    s.prev = s.last;
    s.last = { x, y };
  }

  /**
   * Carries the stroke on to (x, y) in a straight line, with no smoothing: the Shift-click line. A
   * stroke can go on freehand after it.
   */
  lineTo(x: number, y: number): void {
    const s = this.stroke;
    if (!s) return;
    // Finish any curve in progress to where the stroke really is, then go straight from there.
    this.segment({ x: (s.prev.x + s.last.x) / 2, y: (s.prev.y + s.last.y) / 2 }, s.last);
    this.segment(s.last, { x, y });
    s.prev = { x, y };
    s.last = { x, y };
  }

  /** Ends the stroke: one undo step. Returns whether it changed anything. */
  endStroke(): boolean {
    const s = this.stroke;
    if (!s) return false;
    // Finish the curve's last half, to where the pointer lifted.
    this.segment({ x: (s.prev.x + s.last.x) / 2, y: (s.prev.y + s.last.y) / 2 }, s.last);
    this.stroke = null;
    const tiles: TileDiff[] = [];
    for (const [index, before] of s.saved) {
      const after = this.readTile(index);
      if (equalBytes(before, after)) continue;
      tiles.push({ index, before: rleEncode(before), after: rleEncode(after) });
      this.remark(index, after);
    }
    if (!tiles.length) return false;
    this.push({ tiles, crop: null, bytes: tiles.reduce((n, t) => n + t.before.length + t.after.length, 0) });
    return true;
  }

  /** Throws a stroke in progress away, putting the mask back as it was. */
  cancelStroke(): void {
    const s = this.stroke;
    if (!s) return;
    this.stroke = null;
    for (const [index, before] of s.saved) this.writeTile(index, before);
  }

  /** A quadratic curve, as straight pieces short enough not to show at this brush size. */
  private curve(a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }): void {
    const s = this.stroke!;
    const chord = Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y);
    const n = Math.min(64, Math.max(1, Math.ceil(chord / Math.max(2, s.r * 0.5))));
    let p = a;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const q = {
        x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
        y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
      };
      this.segment(p, q);
      p = q;
    }
  }

  /**
   * Paints a straight piece of the stroke: every pixel takes the brush's strength at its distance from
   * the piece (a capsule), so the edge is smooth with no dab marks. Erase keeps the lower mask value
   * and restore the higher, so going over a spot twice in one stroke doesn't build up.
   */
  private segment(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const s = this.stroke!;
    const reach = s.r + 1;
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - reach)), x1 = Math.min(this.width - 1, Math.ceil(Math.max(a.x, b.x) + reach));
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - reach)), y1 = Math.min(this.height - 1, Math.ceil(Math.max(a.y, b.y) + reach));
    if (x0 > x1 || y0 > y1) return;
    for (let ty = Math.floor(y0 / TILE); ty <= Math.floor(y1 / TILE); ty++) {
      for (let tx = Math.floor(x0 / TILE); tx <= Math.floor(x1 / TILE); tx++) {
        const index = ty * this.cols + tx;
        if (!s.saved.has(index)) s.saved.set(index, this.readTile(index));
      }
    }
    const erase = s.mode === 'erase';
    const W = this.width;
    const m = this.mask;
    const vx = b.x - a.x, vy = b.y - a.y;
    const vv = vx * vx + vy * vy;
    const limit = (s.r + 0.5) * (s.r + 0.5);
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5 - a.y;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - a.x;
        const t = vv ? Math.min(1, Math.max(0, (px * vx + py * vy) / vv)) : 0;
        const dx = px - t * vx, dy = py - t * vy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= limit) continue;
        const f = brushFalloff(Math.sqrt(d2), s.r, s.softness);
        if (f <= 0) continue;
        const i = y * W + x;
        if (erase) {
          const v = Math.round(255 * (1 - f));
          if (v < m[i]) m[i] = v;
        } else {
          const v = Math.round(255 * f);
          if (v > m[i]) m[i] = v;
        }
      }
    }
    this.onDirty({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }

  // ----- Crop -----

  /** Sets the crop as one undo step (nothing happens when it's the same). Returns whether it changed. */
  commitCrop(next: UiImageCrop, before: UiImageCrop = this.crop): boolean {
    const after = clampCrop(next, this.width, this.height);
    this.crop = after;
    if (sameCrop(before, after)) return false;
    this.push({ tiles: [], crop: { before, after }, bytes: 32 });
    return true;
  }

  /** Sets the crop without recording it (the host setting it). */
  setCrop(next: UiImageCrop): void {
    this.crop = clampCrop(next, this.width, this.height);
  }

  // ----- History -----

  undo(): boolean {
    this.cancelStroke();
    const step = this.undoStack.pop();
    if (!step) return false;
    this.apply(step, 'before');
    this.redoStack.push(step);
    return true;
  }

  redo(): boolean {
    this.cancelStroke();
    const step = this.redoStack.pop();
    if (!step) return false;
    this.apply(step, 'after');
    this.undoStack.push(step);
    return true;
  }

  /** Back to the original image and the whole frame (or `to`), as one undo step. */
  reset(to: UiImageCrop = fullCrop(this.width, this.height)): boolean {
    this.cancelStroke();
    const full = new Uint8Array(TILE * TILE).fill(255);
    const tiles: TileDiff[] = [];
    for (let index = 0; index < this.marked.length; index++) {
      if (!this.marked[index]) continue;
      const before = this.readTile(index);
      const after = full.subarray(0, before.length);
      tiles.push({ index, before: rleEncode(before), after: rleEncode(after) });
      this.writeTile(index, after);
    }
    const whole = clampCrop(to, this.width, this.height);
    const crop = sameCrop(this.crop, whole) ? null : { before: this.crop, after: whole };
    this.crop = whole;
    if (!tiles.length && !crop) return false;
    this.push({ tiles, crop, bytes: 32 + tiles.reduce((n, t) => n + t.before.length + t.after.length, 0) });
    return true;
  }

  private apply(step: Step, side: 'before' | 'after'): void {
    for (const t of step.tiles) {
      const bytes = rleDecode(t[side], new Uint8Array(this.tileLength(t.index)));
      this.writeTile(t.index, bytes);
    }
    if (step.crop) this.crop = step.crop[side];
  }

  private push(step: Step): void {
    this.undoStack.push(step);
    this.bytes += step.bytes;
    for (const r of this.redoStack) this.bytes -= r.bytes;
    this.redoStack = [];
    while (this.undoStack.length > MAX_STEPS || (this.bytes > MAX_BYTES && this.undoStack.length > 1)) {
      this.bytes -= this.undoStack.shift()!.bytes;
    }
  }

  // ----- Tiles -----

  private tileRect(index: number): UiDirtyRect {
    const tx = index % this.cols, ty = Math.floor(index / this.cols);
    const x = tx * TILE, y = ty * TILE;
    return { x, y, w: Math.min(TILE, this.width - x), h: Math.min(TILE, this.height - y) };
  }

  private tileLength(index: number): number {
    const r = this.tileRect(index);
    return r.w * r.h;
  }

  private readTile(index: number): Uint8Array {
    const r = this.tileRect(index);
    const out = new Uint8Array(r.w * r.h);
    for (let row = 0; row < r.h; row++) {
      const from = (r.y + row) * this.width + r.x;
      out.set(this.mask.subarray(from, from + r.w), row * r.w);
    }
    return out;
  }

  private writeTile(index: number, bytes: Uint8Array): void {
    const r = this.tileRect(index);
    for (let row = 0; row < r.h; row++) {
      this.mask.set(bytes.subarray(row * r.w, row * r.w + r.w), (r.y + row) * this.width + r.x);
    }
    this.remark(index, bytes);
    this.onDirty(r);
  }

  private remark(index: number, bytes: Uint8Array): void {
    const was = this.marked[index];
    const now = bytes.some((v) => v !== 255) ? 1 : 0;
    this.marked[index] = now;
    this.markedCount += now - was;
  }

  // ----- Output -----

  /** The original pixels with the mask applied, for a part of the image (the display uses it). */
  composeRegion(r: UiDirtyRect): Uint8ClampedArray<ArrayBuffer> {
    const out = new Uint8ClampedArray(r.w * r.h * 4);
    for (let row = 0; row < r.h; row++) {
      const y = r.y + row;
      for (let col = 0; col < r.w; col++) {
        const x = r.x + col;
        const i = y * this.width + x;
        const o = (row * r.w + col) * 4;
        out[o] = this.pixels[i * 4];
        out[o + 1] = this.pixels[i * 4 + 1];
        out[o + 2] = this.pixels[i * 4 + 2];
        out[o + 3] = Math.round((this.pixels[i * 4 + 3] * this.mask[i]) / 255);
      }
    }
    return out;
  }

  /** The result: the crop, with erased pixels transparent. */
  result(): UiImageRaster {
    const c = this.crop;
    return { width: c.width, height: c.height, data: this.composeRegion({ x: c.x, y: c.y, w: c.width, h: c.height }) };
  }
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
