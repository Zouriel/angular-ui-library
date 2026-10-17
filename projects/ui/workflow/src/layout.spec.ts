import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WF_NODE_H, WF_NODE_W, autoLayout, edgePath, lifecycleEdges } from './layout';
import type { UiWfLifecycle } from './schema';

interface LayoutCase {
  name: string;
  keepManual?: boolean;
  lifecycle: { states: { id: string; category?: string }[]; transitions: { id: string; from: string[] | '*'; to: string }[]; layout?: Record<string, [number, number]> };
  expect: { positions: Record<string, [number, number]>; width: number; height: number; edges: { id: string; back: boolean }[] };
}

const cases = JSON.parse(readFileSync(join(process.cwd(), 'projects/ui/workflow/src/fixtures/layout.json'), 'utf8')) as LayoutCase[];

/** The fixtures list only what matters for layout; fill in the rest of a valid lifecycle. */
function lifecycleOf(c: LayoutCase): UiWfLifecycle {
  return {
    field: 'status',
    mode: 'enforce',
    states: c.lifecycle.states.map((s) => ({ key: s.id, label: s.id, category: 'active', ...s }) as UiWfLifecycle['states'][number]),
    transitions: c.lifecycle.transitions.map((t) => ({ key: t.id, label: t.id, who: [], ...t })),
    layout: c.lifecycle.layout,
  };
}

/** Shared with the Flutter library (`test/workflow/fixtures/layout.json`): both must lay out alike. */
describe('autoLayout (shared fixtures)', () => {
  for (const c of cases as LayoutCase[]) {
    it(c.name, () => {
      const l = autoLayout(lifecycleOf(c), c.keepManual ?? true);
      expect(Object.fromEntries(Object.entries(l.positions).map(([k, p]) => [k, [p.x, p.y]]))).toEqual(c.expect.positions);
      expect([l.width, l.height]).toEqual([c.expect.width, c.expect.height]);
      expect(l.edges.map((e) => ({ id: e.id, back: e.back }))).toEqual(c.expect.edges);
    });
  }
});

describe('autoLayout', () => {
  const fork = lifecycleOf(cases[1]);

  it('ignores manual positions when asked to tidy', () => {
    const lc = { ...fork, layout: { review: [5, 5] as [number, number] } };
    expect(autoLayout(lc, true).positions['review']).toEqual({ x: 5, y: 5 });
    expect(autoLayout(lc, false).positions['review']).toEqual({ x: WF_NODE_W + 96, y: 48 });
  });

  it('is deterministic and never overlaps cards', () => {
    const a = autoLayout(fork);
    expect(autoLayout(fork)).toEqual(a);
    const boxes = Object.values(a.positions);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const overlap = Math.abs(boxes[i].x - boxes[j].x) < WF_NODE_W && Math.abs(boxes[i].y - boxes[j].y) < WF_NODE_H;
        expect(overlap).toBe(false);
      }
  });

  it('handles an empty lifecycle', () => {
    expect(autoLayout({ field: 'status', mode: 'enforce', states: [], transitions: [] })).toEqual({ positions: {}, edges: [], width: WF_NODE_W, height: WF_NODE_H });
  });
});

describe('lifecycleEdges', () => {
  it('draws one arrow per source state, skipping "any state", self-loops and unknown states', () => {
    const lc = lifecycleOf({
      name: '', expect: { positions: {}, width: 0, height: 0, edges: [] },
      lifecycle: {
        states: [{ id: 'a' }, { id: 'b' }],
        transitions: [{ id: 't', from: ['a', 'b'], to: 'b' }, { id: 'any', from: '*', to: 'a' }, { id: 'ghost', from: ['a'], to: 'zzz' }],
      },
    });
    expect(lifecycleEdges(lc)).toEqual([{ id: 't:a', from: 'a', to: 'b' }]);
  });
});

describe('edgePath', () => {
  it('a straight forward arrow runs from the right side to the left side', () => {
    const p = edgePath({ x: 0, y: 0 }, { x: 268, y: 0 }, false);
    expect(p.d).toBe(`M ${WF_NODE_W} ${WF_NODE_H / 2} H 268`);
    expect(p.label).toEqual({ x: (WF_NODE_W + 268) / 2, y: WF_NODE_H / 2 - 8 });
  });

  it('a forward arrow to another row bends twice, with its label in the middle', () => {
    const p = edgePath({ x: 0, y: 0 }, { x: 268, y: 96 }, false);
    expect(p.d.startsWith(`M ${WF_NODE_W} ${WF_NODE_H / 2} H`)).toBe(true);
    expect(p.d.endsWith(`H 268`)).toBe(true);
    expect(p.label.y).toBe(WF_NODE_H / 2 + 48);
  });

  it('a back arrow loops below both cards, lower for later lanes', () => {
    const a = edgePath({ x: 268, y: 0 }, { x: 0, y: 0 }, true);
    const b = edgePath({ x: 268, y: 0 }, { x: 0, y: 0 }, true, 1);
    expect(a.label.y).toBe(WF_NODE_H + 28);
    expect(b.label.y).toBeGreaterThan(a.label.y);
  });
});
