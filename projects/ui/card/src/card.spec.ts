import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiCard, type UiCardAlign, type UiCardGap } from './card';

@Component({
  imports: [UiCard],
  template: `
    <ui-card
      [interactive]="interactive()"
      [pressable]="pressable()"
      [disabled]="disabled()"
      [ariaLabel]="ariaLabel()"
      [gap]="gap()"
      [align]="align()"
      (activate)="activations.set(activations() + 1)"
    >
      <span class="body-text">Body</span>
      <button type="button" class="inner-btn">Inner</button>
    </ui-card>
  `,
})
class Host {
  interactive = signal(false);
  pressable = signal(false);
  disabled = signal(false);
  ariaLabel = signal<string | null>(null);
  gap = signal<UiCardGap | null>(null);
  align = signal<UiCardAlign | null>(null);
  activations = signal(0);
}

const css = () => ((UiCard as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');

describe('UiCard', () => {
  it('leaves a static card non-interactive with default block body', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.ui-card') as HTMLElement;
    const bd = card.querySelector('.bd') as HTMLElement;
    expect(card.getAttribute('role')).toBeNull();
    expect(card.getAttribute('tabindex')).toBeNull();
    expect(card.getAttribute('aria-label')).toBeNull();
    expect(bd.classList.contains('bd-flex')).toBe(false);
    card.click();
    expect(fixture.componentInstance.activations()).toBe(0);
  });

  it('keeps an interactive card visual only, so it can sit inside a link or button', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.interactive.set(true);
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.ui-card') as HTMLElement;
    expect(card.classList.contains('interactive')).toBe(true);
    expect(card.getAttribute('role')).toBeNull();
    expect(card.getAttribute('tabindex')).toBeNull();
    card.click();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(fixture.componentInstance.activations()).toBe(0);
  });

  it('adds button semantics, ariaLabel, and click/Enter/Space activation when pressable', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.pressable.set(true);
    fixture.componentInstance.ariaLabel.set('Aisha, 12 photos');
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.ui-card') as HTMLElement;

    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.getAttribute('aria-label')).toBe('Aisha, 12 photos');

    card.click();
    expect(fixture.componentInstance.activations()).toBe(1);

    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    card.dispatchEvent(enter);
    expect(fixture.componentInstance.activations()).toBe(2);

    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    card.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.activations()).toBe(3);

    // Nested native buttons should not also fire card activate.
    (card.querySelector('.inner-btn') as HTMLButtonElement).click();
    expect(fixture.componentInstance.activations()).toBe(3);
  });

  it('disables focus, semantics and activation when disabled is true', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.pressable.set(true);
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.ui-card') as HTMLElement;

    expect(card.getAttribute('tabindex')).toBeNull();
    expect(card.getAttribute('aria-disabled')).toBe('true');
    expect(card.classList.contains('disabled')).toBe(true);

    card.click();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    expect(fixture.componentInstance.activations()).toBe(0);
  });

  it('enables flex column body with gap and align tokens', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.gap.set(2);
    fixture.componentInstance.align.set('center');
    fixture.detectChanges();
    const bd = (fixture.nativeElement as HTMLElement).querySelector('.bd') as HTMLElement;

    expect(bd.classList.contains('bd-flex')).toBe(true);
    expect(bd.getAttribute('data-gap')).toBe('2');
    expect(bd.getAttribute('data-align')).toBe('center');
    expect(css()).toMatch(/\.bd\[data-gap=["']?2["']?\][^{]*\{[^}]*var\(--ui-space-2\)/);
    expect(css()).toMatch(/\.bd\[data-align=["']?center["']?\][^{]*\{[^}]*align-items:\s*center/);
    expect(css()).toMatch(/\.bd\[data-align=["']?center["']?\][^{]*\{[^}]*text-align:\s*center/);
  });
});
