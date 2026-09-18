import { describe, expect, it } from 'vitest';
import { convexHull, inkArea, inkRadii, recognizeShape, shapeSamples, thinSamples, type UiInkSample } from './ink';

const line = (from: [number, number], to: [number, number], n = 20, pressure = 0.5): UiInkSample[] =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: from[0] + ((to[0] - from[0]) * i) / n, y: from[1] + ((to[1] - from[1]) * i) / n, pressure }));

const bounds = (pieces: { x: number; y: number }[][]) => {
  const pts = pieces.flat();
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

const signedArea = (poly: { x: number; y: number }[]) =>
  poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p.x * q.y - q.x * p.y; }, 0);

describe('ink', () => {
  it('a pen stroke paints its length plus a round cap at each end, its width wide', () => {
    const b = bounds(inkArea(line([10, 50], [90, 50]), { kind: 'pen', size: 6 }));
    expect(b.w).toBeCloseTo(86, 0);
    expect(b.h).toBeCloseTo(6, 0);
  });

  it('every painted piece winds the same way, so the non-zero rule shows their union', () => {
    const scribble = Array.from({ length: 60 }, (_, i) => ({ x: 50 + 30 * Math.cos(i / 5), y: 50 + 20 * Math.sin(i / 3), pressure: 0.5 }));
    const signs = new Set(inkArea(scribble, { kind: 'brush', size: 5 }).map((p) => Math.sign(signedArea(p))));
    expect([...signs]).toEqual([1]);
  });

  it('pressure changes a pencil, not a marker', () => {
    const light = line([0, 0], [100, 0], 20, 0.1);
    const hard = line([0, 0], [100, 0], 20, 0.9);
    const mid = (r: number[]) => r[10];
    expect(mid(inkRadii(hard, { kind: 'pencil', size: 4 }))).toBeGreaterThan(mid(inkRadii(light, { kind: 'pencil', size: 4 })) * 3);
    expect(mid(inkRadii(hard, { kind: 'marker', size: 4 }))).toBeCloseTo(mid(inkRadii(light, { kind: 'marker', size: 4 })), 6);
  });

  it('a brush comes to a point at both ends once finished, only at the start while drawing', () => {
    const s = line([0, 0], [200, 0], 40);
    const done = inkRadii(s, { kind: 'brush', size: 8 });
    expect(done[0]).toBeLessThan(done[20] * 0.3);
    expect(done[40]).toBeLessThan(done[20] * 0.3);
    const drawing = inkRadii(s, { kind: 'brush', size: 8 }, false);
    expect(drawing[40]).toBeCloseTo(drawing[20], 6);
  });

  it('a broad-edge nib is thick across its angle and a hairline along it', () => {
    // Thickness measured square to the stroke's direction.
    const thickness = (dx: number, dy: number) => {
      const pieces = inkArea(line([0, 0], [dx, dy]), { kind: 'calligraphy', size: 10 });
      const len = Math.hypot(dx, dy);
      const across = pieces.flat().map((p) => (p.x * -dy + p.y * dx) / len);
      return Math.max(...across) - Math.min(...across);
    };
    // The nib sits at 45°: drawn along it (down-right) the line is a hairline, across it the full nib.
    expect(thickness(60, 60)).toBeLessThan(2);
    expect(thickness(60, -60)).toBeGreaterThan(9);
  });

  it('a single touch is a dot', () => {
    const pieces = inkArea([{ x: 5, y: 5, pressure: 0.5 }], { kind: 'pen', size: 4 });
    expect(pieces).toHaveLength(1);
    expect(bounds(pieces).w).toBeCloseTo(4, 0);
  });

  it('samples too close together merge, keeping the end', () => {
    const s = thinSamples([{ x: 0, y: 0, pressure: 0.3 }, { x: 0.1, y: 0, pressure: 0.8 }, { x: 5, y: 0, pressure: 0.5 }, { x: 5.2, y: 0, pressure: 0.5 }], 1);
    expect(s.map((p) => p.x)).toEqual([0, 5, 5.2]);
    expect(s[0].pressure).toBe(0.8);
  });

  it('a convex hull drops the points inside', () => {
    expect(convexHull([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 3 }, { x: 10, y: 10 }, { x: 0, y: 10 }])).toHaveLength(4);
  });

  describe('snap to shape', () => {
    const wobble = (i: number) => Math.sin(i * 1.7) * 0.6;

    it('a nearly straight stroke is a line', () => {
      const s = Array.from({ length: 30 }, (_, i) => ({ x: i * 3, y: i * 1.5 + wobble(i) }));
      expect(recognizeShape(s)?.kind).toBe('line');
    });

    it('a round loop is a circle, a flat one an ellipse', () => {
      const loop = (rx: number, ry: number) => Array.from({ length: 50 }, (_, i) => {
        const t = (i / 49) * Math.PI * 2;
        return { x: 50 + rx * Math.cos(t) + wobble(i), y: 50 + ry * Math.sin(t) + wobble(i + 3) };
      });
      const circle = recognizeShape(loop(20, 19));
      expect(circle?.kind).toBe('ellipse');
      if (circle?.kind === 'ellipse') expect(circle.rx).toBe(circle.ry);
      const ellipse = recognizeShape(loop(30, 12));
      expect(ellipse?.kind).toBe('ellipse');
      if (ellipse?.kind === 'ellipse') expect(ellipse.rx).toBeGreaterThan(ellipse.ry * 2);
    });

    const polyline = (corners: [number, number][]) => corners.flatMap(([ax, ay], k) => {
      const [bx, by] = corners[(k + 1) % corners.length];
      return Array.from({ length: 12 }, (_, i) => ({ x: ax + ((bx - ax) * i) / 12 + wobble(i + k), y: ay + ((by - ay) * i) / 12 + wobble(i + k + 5) }));
    });

    it('four corners make an upright rectangle', () => {
      const shape = recognizeShape(polyline([[0, 0], [60, 1], [61, 40], [1, 39]]));
      expect(shape?.kind).toBe('polygon');
      if (shape?.kind === 'polygon') {
        expect(shape.points).toHaveLength(4);
        expect(new Set(shape.points.map((p) => Math.round(p.x))).size).toBe(2);
      }
    });

    it('three corners make a triangle', () => {
      const shape = recognizeShape(polyline([[0, 50], [30, 0], [60, 50]]));
      expect(shape?.kind).toBe('polygon');
      if (shape?.kind === 'polygon') expect(shape.points).toHaveLength(3);
    });

    it('a squiggle is left as it is', () => {
      expect(recognizeShape(Array.from({ length: 60 }, (_, i) => ({ x: i, y: 10 * Math.sin(i / 5) })))).toBeNull();
    });

    it('a snapped shape is redrawn along its outline, closed', () => {
      const s = shapeSamples({ kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }, 0.5, 1);
      expect(s[0]).toMatchObject({ x: 0, y: 0 });
      expect(s.at(-1)).toMatchObject({ x: 0, y: 0 });
    });
  });
});
