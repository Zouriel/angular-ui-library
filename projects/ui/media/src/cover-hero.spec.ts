import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiButton } from '@zouriel/ui/button';
import type { UiMenuItem } from '@zouriel/ui/overlay';
import { UiCoverHero } from './cover-hero';

@Component({
  imports: [UiCoverHero, UiButton],
  template: `
    <ui-cover-hero [src]="src()" [coverMenu]="menu()" coverActionLabel="Change cover image"
                   [fadeBottom]="fade()" [scrimTop]="top()" [scrimStart]="start()" [minHeight]="min()"
                   (coverMenuSelect)="picked.push($event.value)">
      <ui-button hero-top-start variant="ghost" id="back">Back</ui-button>
      <ui-button hero-top-end variant="ghost" id="opts">Options</ui-button>
      <h2 id="title">Eid party</h2>
      <ui-button hero-actions id="share">Share</ui-button>
    </ui-cover-hero>
  `,
})
class Host {
  src = signal<string | null>('cover.jpg');
  menu = signal<UiMenuItem[]>([]);
  fade = signal(true); top = signal(true); start = signal(true); min = signal<number | null>(null);
  picked: string[] = [];
}

const MENU: UiMenuItem[] = [{ label: 'Change cover image', value: 'change' }, { label: 'Remove cover image', value: 'remove' }];
const panelOpen = () => document.querySelector('ui-context-menu-panel') !== null;

describe('UiCoverHero (0.89.0)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')); });

  function mk() {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const hero = () => (f.nativeElement as HTMLElement).querySelector<HTMLElement>('ui-cover-hero')!;
    return { f, hero };
  }

  it('projects each slot into its own place and sets the on-media scope', () => {
    const { hero } = mk();
    expect(hero().hasAttribute('data-on-media')).toBe(true);
    const slots = hero().querySelectorAll('.top-slot');
    expect(slots[0].querySelector('#back')).not.toBeNull();
    expect(slots[1].querySelector('#opts')).not.toBeNull();
    expect(hero().querySelector('.body #title')).not.toBeNull();
    expect(hero().querySelector('.actions #share')).not.toBeNull();
  });

  it('draws the picture with the three scrims, and removes on-media scope and scrims without one', () => {
    const { f, hero } = mk();
    expect(hero().querySelector('img')?.getAttribute('src')).toBe('cover.jpg');
    expect(hero().hasAttribute('data-on-media')).toBe(true);
    for (const c of ['fade-bottom', 'scrim-top', 'scrim-start']) expect(hero().classList.contains(c)).toBe(true);
    f.componentInstance.start.set(false); f.componentInstance.top.set(false); f.componentInstance.fade.set(false);
    f.detectChanges();
    for (const c of ['fade-bottom', 'scrim-top', 'scrim-start']) expect(hero().classList.contains(c)).toBe(false);
    f.componentInstance.src.set(null);
    f.detectChanges();
    expect(hero().querySelector('img')).toBeNull();
    expect(hero().classList.contains('no-image')).toBe(true);
    expect(hero().hasAttribute('data-on-media')).toBe(false);
    expect(hero().classList.contains('fade-bottom')).toBe(false);
  });

  it('a picture that fails to load falls back to the plain surface; a new src tries again', () => {
    const { f, hero } = mk();
    hero().querySelector('img')!.dispatchEvent(new Event('error'));
    f.detectChanges();
    expect(hero().classList.contains('no-image')).toBe(true);
    expect(hero().hasAttribute('data-on-media')).toBe(false);
    f.componentInstance.src.set('other.jpg');
    f.detectChanges();
    expect(hero().querySelector('img')).not.toBeNull();
    expect(hero().hasAttribute('data-on-media')).toBe(true);
  });

  it('minHeight becomes a custom property', () => {
    const { f, hero } = mk();
    expect(hero().style.getPropertyValue('--ui-cover-min-height')).toBe('');
    f.componentInstance.min.set(400);
    f.detectChanges();
    expect(hero().style.getPropertyValue('--ui-cover-min-height')).toBe('400px');
  });

  it('without a menu the cover is not a button and nothing opens', () => {
    const { hero } = mk();
    expect(hero().querySelector('button.cover')).toBeNull();
    hero().querySelector('.cover')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(panelOpen()).toBe(false);
  });

  it('with a menu, a tap, a right-click and a long press on the cover open it and the choice is emitted', () => {
    const { f, hero } = mk();
    f.componentInstance.menu.set(MENU);
    f.detectChanges();
    const cover = hero().querySelector<HTMLButtonElement>('button.cover')!;
    expect(cover.getAttribute('aria-label')).toBe('Change cover image');
    cover.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: 5, clientY: 5 }));
    expect(panelOpen()).toBe(true);
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
    cover.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
    expect(panelOpen()).toBe(true);
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
    cover.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, isPrimary: true, pointerType: 'touch', clientX: 5, clientY: 5 }));
    vi.advanceTimersByTime(520);
    f.detectChanges();
    expect(panelOpen()).toBe(true);
    document.querySelectorAll<HTMLButtonElement>('ui-context-menu-panel .mi')[1].click();
    expect(f.componentInstance.picked).toEqual(['remove']);
  });

  it('light ink for nested ui-button ghost, ui-text and the editable text comes from the on-media scope, and projected body controls remain clickable', () => {
    const css = (c: { ɵcmp: { styles: string[] } }) => c.ɵcmp.styles.join('\n');
    expect(css(UiButton as never)).toContain('[data-on-media]');
    expect(css(UiCoverHero as never)).toContain('--ui-media-on-scrim');
    expect(css(UiCoverHero as never)).toContain('ui-editable-text');
    expect(css(UiCoverHero as never)).toMatch(/\[dir=["']?rtl["']?\]/);
  });
});
