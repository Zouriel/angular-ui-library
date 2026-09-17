import { describe, expect, it } from 'vitest';
import {
  breakAt, deletePoint, ellipseContour, insertPoint, joinEnds, pathBounds, pathD, polygonContour, rectContour, toggleClosed,
  toggleSmooth, type UiPathContour,
} from './path';

describe('path', () => {
  it('writes straight and curved segments, and closes', () => {
    const tri = polygonContour(0, 0, 100, 100, 3);
    expect(pathD([tri])).toMatch(/^M50 0 L.* Z$/);
    expect(pathD([ellipseContour(50, 50, 50, 50)])).toContain('C');
  });

  it('inserting a point keeps the outline where it was', () => {
    const circle = ellipseContour(50, 50, 50, 50);
    const before = pathBounds([circle])!;
    const { contours, point } = insertPoint([circle], 0, 0, 0.5);
    expect(contours[0].points).toHaveLength(5);
    expect(point).toEqual({ contour: 0, point: 1 });
    const after = pathBounds(contours)!;
    expect(after.w).toBeCloseTo(before.w, 1);
    expect(after.h).toBeCloseTo(before.h, 1);
  });

  it('breaks a closed outline open at a point, and closes it again', () => {
    const box = [rectContour(0, 0, 10, 10)];
    const open = breakAt(box, { contour: 0, point: 2 });
    expect(open[0].closed).toBe(false);
    expect(open[0].points).toHaveLength(5);
    expect(open[0].points[0]).toMatchObject({ x: 10, y: 10 });
    expect(toggleClosed(open, 0)[0].closed).toBe(true);
  });

  it('splits an open line in two at a middle point, and joins two lines end to end', () => {
    const line: UiPathContour = { closed: false, points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }] };
    const parts = breakAt([line], { contour: 0, point: 1 });
    expect(parts).toHaveLength(2);
    const joined = joinEnds(parts, { contour: 0, point: 1 }, { contour: 1, point: 0 });
    expect(joined).toHaveLength(1);
    expect(joined[0].points.map((p) => p.x)).toEqual([0, 5, 10]);
  });

  it('makes a corner smooth and back, and deleting points drops a contour that is too small', () => {
    const tri = [polygonContour(0, 0, 100, 100, 3)];
    const smooth = toggleSmooth(tri, { contour: 0, point: 0 });
    expect(smooth[0].points[0].in).toBeTruthy();
    expect(toggleSmooth(smooth, { contour: 0, point: 0 })[0].points[0].in).toBeNull();
    const line: UiPathContour[] = [{ closed: false, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }];
    expect(deletePoint(line, { contour: 0, point: 0 })).toHaveLength(0);
  });
});
