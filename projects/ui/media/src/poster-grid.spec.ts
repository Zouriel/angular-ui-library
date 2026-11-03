import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiPosterGrid, uiPosterFallback, type UiPoster } from './poster-grid';
import { UiPosterView, UiScrim } from './poster-view';

@Component({
  imports: [UiPosterGrid],
  template: `<ui-poster-grid [posters]="posters()" focus="top" (select)="picked.set($event)" />`,
})
class GridHost {
  posters = signal<UiPoster[]>([
    { src: 'a.png', label: 'Aisha and Ali' },
    { src: null, label: 'Eid party', colors: ['#112233', '#445566'], mark: { tone: 'warning', label: 'Not finished' } },
    { label: 'Birthday', mark: { tone: 'primary', label: 'New' } },
  ]);
  picked = signal(-1);
}

@Component({
  imports: [UiPosterView],
  template: `
    <button id="opener" (click)="open.set(true)">open</button>
    <ui-poster-view [(open)]="open" [src]="src()" label="Aisha and Ali" (closed)="closed = closed + 1">
      <p class="when">Sat 12 Dec</p>
      <button id="act">Open invitation</button>
    </ui-poster-view>
  `,
})
class ViewHost {
  open = signal(false);
  src = signal<string | null>('a.png');
  closed = 0;
}

describe('ui-poster-grid', () => {
  it('draws pictures only: no text in any tile, the name is the accessible label', async () => {
    const fx = TestBed.createComponent(GridHost);
    fx.autoDetectChanges();
    await fx.whenStable();
    const tiles = (fx.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.tile');
    expect(tiles.length).toBe(3);
    for (const t of Array.from(tiles)) expect(t.textContent!.trim()).toBe('');
    expect(tiles[0].getAttribute('aria-label')).toBe('Aisha and Ali');
    expect(tiles[0].querySelector('img')!.getAttribute('alt')).toBe('');
    expect(tiles[0].querySelector('img')!.style.objectPosition).toMatch(/^50% 0(px)?$/);
    // The dot says it without words, and screen readers hear it with the name.
    expect(tiles[1].getAttribute('aria-label')).toBe('Eid party, Not finished');
    expect(tiles[1].querySelector('.dot--warning')).not.toBeNull();
    expect(tiles[2].querySelector('.dot--primary')).not.toBeNull();
    expect(tiles[0].querySelector('.dot')).toBeNull();
  });

  it('shows the gradient when there is no picture or it fails to load', async () => {
    const fx = TestBed.createComponent(GridHost);
    fx.autoDetectChanges();
    await fx.whenStable();
    const el = fx.nativeElement as HTMLElement;
    const tiles = el.querySelectorAll<HTMLButtonElement>('.tile');
    expect(tiles[1].querySelector('img')).toBeNull();
    expect(tiles[1].querySelector<HTMLElement>('.fallback')!.style.background).toContain('linear-gradient');
    tiles[0].querySelector('img')!.dispatchEvent(new Event('error'));
    await fx.whenStable();
    expect(tiles[0].querySelector('img')).toBeNull();
    expect(tiles[0].querySelector('.fallback')).not.toBeNull();
  });

  it('emits the index of the tile that was activated', async () => {
    const fx = TestBed.createComponent(GridHost);
    fx.autoDetectChanges();
    await fx.whenStable();
    (fx.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.tile')[2].click();
    expect(fx.componentInstance.picked()).toBe(2);
  });

  it('steps 2, 3, 4, 5 columns by its own width', () => {
    const css = ((UiPosterGrid as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles).join('\n');
    expect(css).toMatch(/\[_nghost-[^\]]*\]\s*\{[^}]*container-type:\s*inline-size/);
    expect(css).toMatch(/grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    for (const [w, n] of [[544, 3], [992, 4], [1280, 5]]) {
      expect(css).toMatch(new RegExp(`@container \\(min-width: ?${w}px\\)\\s*\\{[^}]*repeat\\(${n}, minmax\\(0, 1fr\\)\\)`));
    }
  });

  it('rings the dot in the on-scrim colour so it shows on dark posters', () => {
    const css = ((UiPosterGrid as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles).join('\n');
    expect(css).toMatch(/\.dot(\[[^\]]*\])?\s*\{[^}]*box-shadow:\s*0 0 0 2px var\(--ui-media-on-scrim\)/);
  });

  it('builds the fallback from one colour, several, or the theme', () => {
    expect(uiPosterFallback(['#111', '#222'])).toBe('linear-gradient(160deg, #111, #222)');
    expect(uiPosterFallback(['#111'])).toContain('#111');
    expect(uiPosterFallback(null)).toContain('var(--ui-color-primary)');
  });
});

describe('ui-poster-view', () => {
  it('opens as a focus-trapped dialog with the projected details on a scrim, and Escape returns focus', async () => {
    const fx = TestBed.createComponent(ViewHost);
    fx.autoDetectChanges();
    await fx.whenStable();
    const el = fx.nativeElement as HTMLElement;
    document.body.appendChild(el);
    const opener = el.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    opener.click();
    await fx.whenStable();
    await new Promise((r) => setTimeout(r));
    const dlg = el.querySelector<HTMLElement>('[role=dialog]')!;
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.getAttribute('aria-label')).toBe('Aisha and Ali');
    expect(dlg.previousElementSibling?.classList.contains('cdk-focus-trap-anchor')).toBe(true);
    expect(document.activeElement).toBe(dlg);
    expect(dlg.querySelector('img.picture')!.getAttribute('alt')).toBe('Aisha and Ali');
    // The details sit inside the scrim, laid over the bottom of the picture.
    expect(dlg.querySelector('ui-scrim .when')!.textContent).toBe('Sat 12 Dec');
    expect(dlg.querySelector('ui-scrim #act')).not.toBeNull();
    dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fx.whenStable();
    expect(el.querySelector('[role=dialog]')).toBeNull();
    expect(fx.componentInstance.open()).toBe(false);
    expect(fx.componentInstance.closed).toBe(1);
    expect(document.activeElement).toBe(opener);
    el.remove();
  });

  it('closes from its close button and falls back to the gradient without a picture', async () => {
    const fx = TestBed.createComponent(ViewHost);
    fx.componentInstance.src.set(null);
    fx.componentInstance.open.set(true);
    fx.autoDetectChanges();
    await fx.whenStable();
    const el = fx.nativeElement as HTMLElement;
    expect(el.querySelector('.picture')).toBeNull();
    expect(el.querySelector<HTMLElement>('.fallback')!.style.background).toContain('linear-gradient');
    el.querySelector<HTMLButtonElement>('.x')!.click();
    await fx.whenStable();
    expect(el.querySelector('[role=dialog]')).toBeNull();
  });

  it('fades the scrim to at least 60% before the content and 88% at the bottom', () => {
    const css = ((UiScrim as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles).join('\n');
    expect(css).toMatch(/transparent 0/);
    expect(css).toMatch(/var\(--ui-media-scrim\) 60%, transparent\) var\(--ui-space-12\)/);
    expect(css).toMatch(/var\(--ui-media-scrim\) 88%, transparent\) 100%/);
    expect(css).toMatch(/padding:\s*var\(--ui-space-12\)/);
    expect(css).toMatch(/color:\s*var\(--ui-media-on-scrim\)/);
  });
});
