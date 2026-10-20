import { describe, expect, it, vi } from 'vitest';
import { UI_ANIM, uiLeaveHidden } from './animations';

/**
 * A closing dialog's backdrop shares a layer with a panel whose leave animation runs longer. The
 * class form of animate.leave dropped the backdrop's leave class when its own fade ended, and the
 * still-rendered backdrop flashed back to the full overlay until the layer went (measured: opacity
 * 0.0002 at 159 ms, 1 at 209 ms, layer removed at 260 ms). uiLeaveHidden keeps it at 0.
 */
describe('uiLeaveHidden', () => {
  function backdrop(animation: { name: string; duration: string }) {
    const el = document.createElement('div');
    document.body.appendChild(el);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () => ({ animationName: animation.name, animationDuration: animation.duration, animationDelay: '0s' }) as CSSStyleDeclaration,
    );
    return el;
  }

  /** The opacity the backdrop shows: its fade (1 down to 0) while the leave class runs, else its inline or resting value. */
  function opacity(el: HTMLElement, progress: number): number {
    if (el.style.opacity) return Number(el.style.opacity);
    return el.classList.contains(UI_ANIM.backdrop.leave) ? 1 - progress : 1;
  }

  it('never lets the opacity rise again during a close, however long the layer lingers', () => {
    const el = backdrop({ name: 'ui-backdrop-out', duration: '0.12s' });
    const complete = vi.fn();
    uiLeaveHidden(UI_ANIM.backdrop.leave)({ target: el, animationComplete: complete });
    const seen = [opacity(el, 0), opacity(el, 0.5)];
    el.dispatchEvent(new Event('animationend'));
    // The panel's longer leave is still running: sample a few more frames.
    for (let i = 0; i < 5; i++) seen.push(opacity(el, 1));
    expect(complete).toHaveBeenCalledTimes(1);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThanOrEqual(seen[i - 1]);
    expect(seen.at(-1)).toBe(0);
    expect(el.classList.contains(UI_ANIM.backdrop.leave)).toBe(true); // still out of the way of clicks
    vi.restoreAllMocks();
  });

  it('ignores animationend bubbling from children, and has a timeout safety net', () => {
    vi.useFakeTimers();
    const el = backdrop({ name: 'ui-backdrop-out', duration: '120ms' });
    const child = el.appendChild(document.createElement('span'));
    const complete = vi.fn();
    uiLeaveHidden(UI_ANIM.backdrop.leave)({ target: el, animationComplete: complete });
    child.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(complete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(el.style.opacity).toBe('0');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('hides at once when no animation runs (animations off, reduced to none)', () => {
    const el = backdrop({ name: 'none', duration: '0s' });
    const complete = vi.fn();
    uiLeaveHidden(UI_ANIM.backdrop.leave)({ target: el, animationComplete: complete });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(el.style.opacity).toBe('0');
    vi.restoreAllMocks();
  });
});
