import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuidancePage } from './guidance.page';

describe('Guidance page', () => {
  const realRect = HTMLElement.prototype.getBoundingClientRect;
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = realRect;
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
  });

  async function settle(f: { detectChanges(): void; whenStable(): Promise<unknown> }) {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 60));
      f.detectChanges();
    }
    await f.whenStable();
  }

  it('runs the demo tour over the tab bar to the end', async () => {
    // jsdom draws nothing: give the demo tabs a box so the tour finds them.
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.classList.contains('tab')) return new DOMRect(20 + 80 * [...this.parentElement!.children].indexOf(this), 600, 70, 52);
      return realRect.call(this);
    };
    HTMLElement.prototype.scrollIntoView = vi.fn();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(GuidancePage);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    await settle(f);
    const el = f.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('doc-section')].length).toBe(7);
    const start = [...el.querySelectorAll('ui-button button')].find((b) => b.textContent!.includes('Start the tour')) as HTMLButtonElement;
    start.click();
    await settle(f);
    const count = () => document.querySelector('.ui-tour-pane .count')?.textContent?.trim();
    expect(count()).toBe('1 of 4');
    for (let i = 0; i < 4; i++) {
      (document.querySelector('.ui-tour-pane .next') as HTMLButtonElement).click();
      await settle(f);
    }
    expect(document.querySelector('ui-tour-panel')).toBeNull();
    expect(el.textContent).toContain('Last tour: finished');
  }, 30_000); // real timers: about 3 s of waiting for the tour to settle at each step

  it('ticks checklist steps on tap and dismisses the offer', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(GuidancePage);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('ui-checklist .count')!.textContent!.trim()).toBe('1 of 5');
    (el.querySelectorAll('ui-checklist .item')[1] as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('ui-checklist .count')!.textContent!.trim()).toBe('2 of 5');
    (el.querySelector('ui-offer-card .x') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.textContent).toContain('Show the offer again');
  });
});
