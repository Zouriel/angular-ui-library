import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiAvatarTag } from '@zouriel/ui/avatar-tag';
import { UiIconButton } from '@zouriel/ui/button';
import { UiPosterAction, UiPosterCorner, UiPosterDetails, UiPosterGrid, uiPosterFallback, type UiPoster } from './poster-grid';
import { UiPosterView } from './poster-view';
import { UiScrim } from './scrim';

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
  imports: [UiPosterGrid, UiPosterDetails],
  template: `
    <ui-poster-grid [posters]="posters" [handleClicks]="true" (select)="picked.push($event)">
      <ng-template uiPosterDetails let-p let-i="index"><b class="t">{{ p.label }}</b><span class="n">#{{ i }}</span></ng-template>
    </ui-poster-grid>
  `,
})
class DetailsHost {
  posters: UiPoster[] = [
    { src: 'a.png', label: 'Aisha and Ali', href: '/dashboard/1', mark: { tone: 'primary', label: 'New' } },
    { src: null, label: 'Eid party' },
  ];
  picked: number[] = [];
}

@Component({
  imports: [UiPosterGrid, UiPosterDetails, UiPosterCorner, UiAvatarTag],
  template: `
    <ui-poster-grid [posters]="posters" (select)="picked.push($event)">
      <ng-template uiPosterDetails let-p><b class="t">{{ p.label }}</b></ng-template>
      <ng-template uiPosterCorner let-p let-i="index">
        <ui-avatar-tag size="xs" [name]="venues[i]" />
      </ng-template>
    </ui-poster-grid>
  `,
})
class CornerHost {
  posters: UiPoster[] = [
    { src: 'a.png', label: 'Aisha and Ali' },
    { src: null, label: 'Eid party', mark: { tone: 'primary', label: 'New' } },
  ];
  venues = ['Coco Palm Dhuni Kolhu Maldives Resort and Spa, the long name', 'Bandos'];
  picked: number[] = [];
}

@Component({
  imports: [UiPosterGrid, UiPosterDetails, UiPosterCorner, UiPosterAction, UiIconButton],
  template: `
    <ui-poster-grid [posters]="posters" [handleClicks]="true" (select)="picked.push($event)">
      <ng-template uiPosterDetails let-p><b class="t">{{ p.label }}</b></ng-template>
      <ng-template uiPosterCorner let-p><i class="c">{{ p.label }}</i></ng-template>
      <ng-template uiPosterAction let-p let-i="index">
        <ui-icon-button class="view" [label]="'View ' + p.label" variant="ghost" size="sm" (click)="viewed.push(i)">v</ui-icon-button>
      </ng-template>
    </ui-poster-grid>
  `,
})
class ActionHost {
  posters: UiPoster[] = [
    { src: 'a.png', label: 'Aisha and Ali', href: '/dashboard/1', mark: { tone: 'primary', label: 'New' } },
    { src: null, label: 'Eid party' },
  ];
  picked: number[] = [];
  viewed: number[] = [];
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

describe('ui-poster-grid with details', () => {
  it('draws each poster\'s details on its own tile, over a compact scrim at the bottom', async () => {
    const fx = TestBed.createComponent(DetailsHost);
    fx.autoDetectChanges();
    await fx.whenStable();
    const el = fx.nativeElement as HTMLElement;
    const tiles = el.querySelectorAll<HTMLElement>('.tile');
    expect(tiles.length).toBe(2);
    expect(tiles[0].querySelector('ui-scrim.details.compact .t')!.textContent).toBe('Aisha and Ali');
    expect(tiles[1].querySelector('ui-scrim .n')!.textContent).toBe('#1');
    // The words name the tile now, with the dot's meaning read after them; no label hides them.
    expect(tiles[0].getAttribute('aria-label')).toBeNull();
    expect(tiles[0].querySelector('ui-scrim .sr')!.textContent).toBe('New');
  });

  it('makes a poster with an href a link, and leaves a plain click to select', async () => {
    const fx = TestBed.createComponent(DetailsHost);
    fx.autoDetectChanges();
    await fx.whenStable();
    const el = fx.nativeElement as HTMLElement;
    const link = el.querySelector<HTMLAnchorElement>('a.tile')!;
    expect(link.getAttribute('href')).toBe('/dashboard/1');
    expect(el.querySelectorAll('button.tile').length).toBe(1);
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(fx.componentInstance.picked).toEqual([0]);
    // A new-tab click is the browser's.
    const ctrl = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    link.dispatchEvent(ctrl);
    expect(ctrl.defaultPrevented).toBe(false);
    expect(fx.componentInstance.picked).toEqual([0]);
  });

  it('fades a compact scrim to 60% within space8, before its words', () => {
    const css = ((UiScrim as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles).join('\n');
    expect(css).toMatch(/\.compact[^{]*\{[^}]*--ui-scrim-lead:\s*var\(--ui-space-8\)/);
    expect(css).toMatch(/padding:\s*var\(--ui-scrim-lead\)/);
  });
});

describe('ui-poster-grid with a corner', () => {
  const css = () => ((UiPosterGrid as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles).join('\n');

  it('draws each poster\'s corner inside its own tile, over the picture, with the poster and index', async () => {
    const fx = TestBed.createComponent(CornerHost);
    fx.autoDetectChanges();
    await fx.whenStable();
    const tiles = (fx.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.tile');
    expect(tiles[0].querySelector('.corner ui-avatar-tag')!.getAttribute('aria-label')).toBe(fx.componentInstance.venues[0]);
    expect(tiles[1].querySelector('.corner ui-avatar-tag')!.getAttribute('aria-label')).toBe('Bandos');
    // After the picture (and the details scrim), so it paints above them; not inside the scrim.
    const corner = tiles[0].querySelector('.corner')!;
    expect(tiles[0].querySelector('img')!.compareDocumentPosition(corner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(corner.closest('ui-scrim')).toBeNull();
    // A tile with a mark keeps the corner clear of the dot on the other side.
    expect(tiles[0].querySelector('.corner')!.classList.contains('corner--mark')).toBe(false);
    expect(tiles[1].querySelector('.corner')!.classList.contains('corner--mark')).toBe(true);
  });

  it('has no corner without the template', async () => {
    const fx = TestBed.createComponent(DetailsHost);
    fx.autoDetectChanges();
    await fx.whenStable();
    expect((fx.nativeElement as HTMLElement).querySelector('.corner')).toBeNull();
    const plain = TestBed.createComponent(GridHost);
    plain.autoDetectChanges();
    await plain.whenStable();
    expect((plain.nativeElement as HTMLElement).querySelector('.corner')).toBeNull();
  });

  it('pins it to the top-start corner with an inset, never wider than the picture, and passes taps through', () => {
    const rule = css().match(/\.corner(\[[^\]]*\])?\s*\{([^}]*)\}/)![2];
    expect(rule).toMatch(/position:\s*absolute/);
    expect(rule).toMatch(/top:\s*var\(--ui-space-2\)/);
    expect(rule).toMatch(/inset-inline-start:\s*var\(--ui-space-2\)/);
    expect(rule).not.toMatch(/(^|[^-])left:/);
    expect(rule).toMatch(/max-width:\s*calc\(100% - 2 \* var\(--ui-space-2\)\)/);
    expect(rule).toMatch(/min-width:\s*0/);
    expect(rule).toMatch(/pointer-events:\s*none/);
    expect(css()).toMatch(/\.corner--mark(\[[^\]]*\])?\s*\{[^}]*max-width:\s*calc\(100% - 3 \* var\(--ui-space-2\) - 10px\)/);
  });

  it('still selects the tile when the corner is tapped', async () => {
    const fx = TestBed.createComponent(CornerHost);
    fx.autoDetectChanges();
    await fx.whenStable();
    const tag = (fx.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.tile')[1].querySelector<HTMLElement>('ui-avatar-tag')!;
    tag.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(fx.componentInstance.picked).toEqual([1]);
  });
});

describe('ui-poster-grid with an action', () => {
  const css = () => ((UiPosterGrid as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles).join('\n');
  const make = async () => {
    const fx = TestBed.createComponent(ActionHost);
    fx.autoDetectChanges();
    await fx.whenStable();
    return { fx, el: fx.nativeElement as HTMLElement };
  };

  it('draws each poster\'s action in its li, beside the tile and never inside its link or button', async () => {
    const { el } = await make();
    const items = el.querySelectorAll<HTMLElement>('li');
    expect(items.length).toBe(2);
    items.forEach((li, i) => {
      const btn = li.querySelector<HTMLButtonElement>('.top-end .action ui-icon-button button')!;
      expect(btn).not.toBeNull();
      expect(btn.getAttribute('aria-label')).toBe('View ' + ['Aisha and Ali', 'Eid party'][i]);
      expect(btn.closest('.tile')).toBeNull();
      expect(btn.closest('a')).toBeNull();
      expect(li.querySelector('.tile')!.contains(btn)).toBe(false);
      // A sibling of the tile, after it, so it paints above the picture.
      const top = li.querySelector('.top-end')!;
      expect(top.parentElement).toBe(li);
      expect(li.querySelector('.tile')!.compareDocumentPosition(top) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('activating the action never selects or opens the tile; the tile elsewhere still does', async () => {
    const { fx, el } = await make();
    const btns = el.querySelectorAll<HTMLButtonElement>('.action button');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    btns[0].dispatchEvent(click);
    btns[1].click();
    expect(fx.componentInstance.viewed).toEqual([0, 1]);
    expect(fx.componentInstance.picked).toEqual([]);
    expect(click.defaultPrevented).toBe(false);
    // The tile itself (and the dot's corner, which takes no taps) still select.
    el.querySelectorAll<HTMLElement>('.tile')[1].click();
    el.querySelector<HTMLElement>('a.tile .t')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(fx.componentInstance.picked).toEqual([1, 0]);
    expect(fx.componentInstance.viewed).toEqual([0, 1]);
  });

  it('moves a mark\'s dot out of the tile and beside the action, before it, so they never overlap', async () => {
    const { el } = await make();
    const [first, second] = Array.from(el.querySelectorAll<HTMLElement>('li'));
    expect(first.querySelector('.tile .dot')).toBeNull();
    const top = first.querySelector('.top-end')!;
    expect(top.children[0].classList.contains('dot--primary')).toBe(true);
    expect(top.children[1].classList.contains('action')).toBe(true);
    expect(second.querySelector('.dot')).toBeNull();
    // Screen readers still hear the mark with the tile.
    expect(first.querySelector('.tile ui-scrim .sr')!.textContent).toBe('New');
    // The corner keeps clear of the action (and of the dot beside it).
    expect(first.querySelector('.corner')!.classList.contains('corner--action-mark')).toBe(true);
    expect(second.querySelector('.corner')!.classList.contains('corner--action')).toBe(true);
    expect(first.querySelector('.corner')!.classList.contains('corner--mark')).toBe(false);
  });

  it('pins the action to the top-end corner of the li, laid out in a row with the dot, on a scrim backdrop', () => {
    expect(css()).toMatch(/li(\[[^\]]*\])?\s*\{[^}]*position:\s*relative/);
    const top = css().match(/\.top-end(\[[^\]]*\])?\s*\{([^}]*)\}/)![2];
    expect(top).toMatch(/position:\s*absolute/);
    expect(top).toMatch(/top:\s*var\(--ui-space-2\)/);
    expect(top).toMatch(/inset-inline-end:\s*var\(--ui-space-2\)/);
    expect(top).toMatch(/display:\s*flex/);
    expect(top).toMatch(/gap:\s*var\(--ui-space-2\)/);
    expect(top).toMatch(/pointer-events:\s*none/);
    // The dot inside the row is laid out, not absolutely placed over the action; the override is more
    // specific than .dot even with the emulated-encapsulation attributes.
    expect(css()).toMatch(/\.top-end(\[[^\]]*\])?\s+\.dot(\[[^\]]*\])?\s*\{[^}]*position:\s*static/);
    const act = css().match(/\.top-end(\[[^\]]*\])?\s+\.action(\[[^\]]*\])?\s*\{([^}]*)\}/)![3];
    expect(act).toMatch(/pointer-events:\s*auto/);
    expect(act).toMatch(/background:\s*color-mix\(in srgb, var\(--ui-media-scrim\)/);
    expect(act).toMatch(/--ui-color-icon:\s*var\(--ui-media-on-scrim\)/);
  });

  it('has no action corner without the template, and the dot stays in the tile', async () => {
    const fx = TestBed.createComponent(GridHost);
    fx.autoDetectChanges();
    await fx.whenStable();
    const el = fx.nativeElement as HTMLElement;
    expect(el.querySelector('.top-end')).toBeNull();
    expect(el.querySelectorAll('.tile .dot').length).toBe(2);
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
    expect(css).toMatch(/var\(--ui-media-scrim\) 60%, transparent\) var\(--ui-scrim-lead\)/);
    expect(css).toMatch(/--ui-scrim-lead:\s*var\(--ui-space-12\)/);
    expect(css).toMatch(/var\(--ui-media-scrim\) 88%, transparent\) 100%/);
    
    expect(css).toMatch(/color:\s*var\(--ui-media-on-scrim\)/);
  });
});
