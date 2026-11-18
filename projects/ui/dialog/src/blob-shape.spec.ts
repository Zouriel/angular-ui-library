import { describe, expect, it } from 'vitest';
import { UiBlobSpring, uiBlobPath, uiBlobPieces, type UiBlobGeometry } from './blob-shape';

const base: UiBlobGeometry = { width: 340, pillWidth: 160, pillHeight: 38, bodyHeight: 100, align: 'center', progress: 1, radius: 20, fillet: 14 };

describe('blob toast shape', () => {
  it('is the pill alone when closed, or when there is no card to grow', () => {
    for (const g of [{ ...base, progress: 0 }, { ...base, bodyHeight: 0 }]) {
      expect(uiBlobPieces(g)).toEqual([{ kind: 'rrect', left: 90, top: 0, right: 250, bottom: 38, radius: 19 }]);
    }
  });

  it('open and centred: the pill as a tab on the full card, with a concave join on each shoulder', () => {
    const pieces = uiBlobPieces(base);
    expect(pieces[0]).toEqual({ kind: 'rrect', left: 90, top: 0, right: 250, bottom: 38, radius: 19 });
    expect(pieces[1]).toEqual({ kind: 'rrect', left: 0, top: 38, right: 340, bottom: 138, radius: 20 });
    // The neck squares off the pill's lower half down to the card.
    expect(pieces.filter((p) => p.kind === 'rect')).toEqual([
      { kind: 'rect', left: 90, top: 19, right: 170, bottom: 38 },
      { kind: 'rect', left: 170, top: 19, right: 250, bottom: 38 },
    ]);
    expect(pieces.filter((p) => p.kind === 'fillet')).toEqual([
      { kind: 'fillet', x: 90, y: 38, r: 14, side: -1 },
      { kind: 'fillet', x: 250, y: 38, r: 14, side: 1 },
    ]);
  });

  it('pill on a side: that side runs straight into the card, and only the other shoulder has a join', () => {
    const left = uiBlobPieces({ ...base, align: 'left' });
    expect(left.filter((p) => p.kind === 'fillet')).toEqual([{ kind: 'fillet', x: 160, y: 38, r: 14, side: 1 }]);
    // The flush half of the neck also covers the card's rounded corner under the tab.
    expect(left).toContainEqual({ kind: 'rect', left: 0, top: 19, right: 80, bottom: 58 });
    const right = uiBlobPieces({ ...base, align: 'right' });
    expect(right.filter((p) => p.kind === 'fillet')).toEqual([{ kind: 'fillet', x: 180, y: 38, r: 14, side: -1 }]);
    expect(right).toContainEqual({ kind: 'rect', left: 260, top: 19, right: 340, bottom: 58 });
  });

  it('grows out of the pill: the card starts inside the pill and never leaves the box sideways', () => {
    for (let p = 0.02; p <= 1.3; p += 0.02) {
      for (const align of ['left', 'center', 'right'] as const) {
        const [pill, card, ...rest] = uiBlobPieces({ ...base, align, progress: p });
        if (card.kind !== 'rrect' || pill.kind !== 'rrect') throw new Error('pill and card come first');
        expect(card.left).toBeGreaterThanOrEqual(0);
        expect(card.right).toBeLessThanOrEqual(340);
        expect(card.top).toBeGreaterThanOrEqual(19);
        expect(card.top).toBeLessThanOrEqual(38);
        expect(card.radius).toBeLessThanOrEqual((card.bottom - card.top) / 2 + 1e-9);
        for (const f of rest) if (f.kind === 'fillet') expect(f.r).toBeLessThanOrEqual(14);
        expect(uiBlobPath({ ...base, align, progress: p })).not.toMatch(/NaN|Infinity/);
      }
    }
    const early = uiBlobPieces({ ...base, progress: 0.001 })[1];
    expect(early).toMatchObject({ kind: 'rrect' });
    if (early.kind === 'rrect') {
      expect(early.left).toBeGreaterThan(90 + 18);
      expect(early.right).toBeLessThan(250 - 18);
    }
  });

  it('past fully open (a spring overshooting) only the bottom edge moves', () => {
    const at = uiBlobPieces(base)[1];
    const over = uiBlobPieces({ ...base, progress: 1.1 })[1];
    expect(over).toEqual({ ...at, bottom: 148 });
  });

  it('a pill wider than the box is held to the box', () => {
    expect(uiBlobPieces({ ...base, pillWidth: 500, progress: 0 })[0]).toMatchObject({ left: 0, right: 340 });
  });

  it('draws every piece clockwise as closed SVG subpaths', () => {
    const d = uiBlobPath(base);
    expect(d.match(/M/g)!.length).toBe(6);
    expect(d.match(/Z/g)!.length).toBe(6);
    expect(d.startsWith('M109 0H231A19 19 0 0 1 250 19')).toBe(true);
    expect(d).toContain('M90 24V38H76A14 14 0 0 0 90 24Z');
    expect(d).toContain('M264 38H250V24A14 14 0 0 0 264 38Z');
  });
});

describe('blob toast spring', () => {
  function settle(s: UiBlobSpring) {
    let peak = s.value, low = s.value, frames = 0;
    while (!s.resting && frames < 600) { s.step(1 / 60); peak = Math.max(peak, s.value); low = Math.min(low, s.value); frames++; }
    return { peak, low, frames };
  }

  it('opens with a small overshoot and comes to rest on the target', () => {
    const s = new UiBlobSpring();
    s.target = 1;
    const { peak, frames } = settle(s);
    expect(s.value).toBe(1);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.12);
    expect(frames).toBeLessThan(90);
  });

  it('closes without going below the pill', () => {
    const s = new UiBlobSpring();
    s.value = 1;
    s.target = 0;
    const { low } = settle(s);
    expect(low).toBe(0);
    expect(s.value).toBe(0);
    expect(s.resting).toBe(true);
  });
});
