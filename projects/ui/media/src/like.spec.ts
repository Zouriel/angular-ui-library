import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiHeartBurst, UiLikeButton, UiLikeCount, uiCompactCount } from './like';
import { UI_DOUBLE_TAP_MS, UiSelectable } from './selection';

@Component({
  imports: [UiSelectable],
  template: `<ui-selectable label="Beach" [selecting]="selecting()" [doubleTapEnabled]="dbl()"
    (tap)="log.push('tap')" (doubleTap)="log.push('double ' + $event.x + ',' + $event.y)"><img src="a.png" alt="" /></ui-selectable>`,
})
class DoubleHost {
  selecting = signal(false);
  dbl = signal(true);
  log: string[] = [];
}

@Component({
  imports: [UiLikeCount, UiLikeButton, UiHeartBurst],
  template: `<div style="position: relative; width: 200px; height: 200px">
      <ui-heart-burst />
      <ui-like-count [count]="count()" [liked]="liked()" />
    </div>
    <ui-like-button [count]="count()" [liked]="liked()" (likedChange)="changes.push($event)" />`,
})
class LikeHost {
  count = signal(0);
  liked = signal(false);
  changes: boolean[] = [];
  burst = viewChild.required(UiHeartBurst);
}

function click(el: HTMLElement, x = 10, y = 10): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
}

describe('ui-selectable double tap', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function make() {
    const f = TestBed.createComponent(DoubleHost);
    f.detectChanges();
    return { f, tile: f.nativeElement.querySelector('ui-selectable') as HTMLElement };
  }

  it('two taps close together are one double tap, and the single tap never fires', () => {
    const { f, tile } = make();
    click(tile, 10, 10);
    vi.advanceTimersByTime(100);
    click(tile, 14, 12);
    vi.advanceTimersByTime(UI_DOUBLE_TAP_MS * 2);
    expect(f.componentInstance.log).toEqual(['double 14,12']);
  });

  it('a single tap still fires once the double-tap window has passed', () => {
    const { f, tile } = make();
    click(tile);
    expect(f.componentInstance.log).toEqual([]);
    vi.advanceTimersByTime(UI_DOUBLE_TAP_MS + 1);
    expect(f.componentInstance.log).toEqual(['tap']);
  });

  it('taps far apart are two single taps', () => {
    const { f, tile } = make();
    click(tile, 10, 10);
    click(tile, 120, 120);
    vi.advanceTimersByTime(UI_DOUBLE_TAP_MS + 1);
    expect(f.componentInstance.log).toEqual(['tap', 'tap']);
  });

  it('does not wait while selecting, or when double tap is off', () => {
    const { f, tile } = make();
    f.componentInstance.selecting.set(true);
    f.detectChanges();
    click(tile);
    expect(f.componentInstance.log).toEqual(['tap']);
    f.componentInstance.selecting.set(false);
    f.componentInstance.dbl.set(false);
    f.detectChanges();
    click(tile);
    click(tile);
    expect(f.componentInstance.log).toEqual(['tap', 'tap', 'tap']);
  });
});

describe('like pieces', () => {
  function make() {
    const f = TestBed.createComponent(LikeHost);
    f.detectChanges();
    return f;
  }

  it('abbreviates large counts', () => {
    expect([0, 7, 999, 1000, 1234, 15400, 999_499, 1_250_000].map(uiCompactCount))
      .toEqual(['0', '7', '999', '1k', '1.2k', '15k', '999k', '1.2m']);
  });

  it('the count badge is hidden at 0, shows the number, and fills the heart when liked', () => {
    const f = make();
    const badge = f.nativeElement.querySelector('ui-like-count') as HTMLElement;
    expect(badge.hasAttribute('hidden')).toBe(true);
    expect(badge.querySelector('.pill')).toBeNull();

    f.componentInstance.count.set(1234);
    f.detectChanges();
    expect(badge.hasAttribute('hidden')).toBe(false);
    expect(badge.textContent?.trim()).toBe('1.2k');
    expect(badge.getAttribute('aria-label')).toBe('1234 likes');
    expect(badge.querySelector('.pill')!.classList.contains('liked')).toBe(false);

    f.componentInstance.liked.set(true);
    f.detectChanges();
    expect(badge.querySelector('.pill')!.classList.contains('liked')).toBe(true);
    expect(badge.getAttribute('aria-label')).toBe('Liked, 1234 likes');
  });

  it('the like button announces its state and emits the opposite', () => {
    const f = make();
    const button = f.nativeElement.querySelector('ui-like-button button') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    f.componentInstance.liked.set(true);
    f.componentInstance.count.set(1);
    f.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent?.trim()).toBe('1');
    button.click();
    expect(f.componentInstance.changes).toEqual([true, false]);
  });

  it('a burst plays where asked, never takes a pointer, and clears itself', () => {
    vi.useFakeTimers();
    try {
      const f = make();
      f.componentInstance.burst().play(40, 60);
      f.detectChanges();
      const host = f.nativeElement.querySelector('ui-heart-burst') as HTMLElement;
      const burst = host.querySelector('.burst') as HTMLElement;
      expect(burst.style.left).toBe('40px');
      expect(burst.style.top).toBe('60px');
      const styles = (UiHeartBurst as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('');
      expect(styles).toMatch(/\[_nghost-%COMP%\]\s*\{[^}]*pointer-events:\s*none/);
      vi.advanceTimersByTime(1100);
      f.detectChanges();
      expect(host.querySelector('.burst')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
