import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
// The source, not the built main entry (which '@zouriel/ui' resolves to in specs).
import { uiBadgeCount } from '../../src/lib/badge';
import { UiButton } from './button';
import { UiIconButton } from './icon-button';

/* 0.44.0: [badge] on ui-button and ui-icon-button, and uiBadgeCount. */

@Component({
  imports: [UiButton, UiIconButton],
  template: `
    <ui-button class="text" [badge]="badge()" [badgeLabel]="badgeLabel()">Chat</ui-button>
    <ui-button class="named" ariaLabel="Chat with the nurse" [badge]="badge()" [badgeLabel]="badgeLabel()" [badgeTone]="tone()">Chat</ui-button>
    <ui-icon-button class="icon" label="Chat" [badge]="badge()" [badgeLabel]="badgeLabel()" [badgeTone]="tone()">C</ui-icon-button>
  `,
})
class Host {
  badge = signal<string | null>('2');
  badgeLabel = signal<string | null>('2 unread');
  tone = signal<'danger' | 'primary'>('danger');
}

function setup() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const btn = (c: string) => root.querySelector(`.${c} button`) as HTMLButtonElement;
  return { f, h: f.componentInstance, btn, tick: () => f.detectChanges() };
}

/** The accessible name as a screen reader computes it here: aria-label, else the text without aria-hidden parts. */
function name(b: HTMLElement): string {
  const label = b.getAttribute('aria-label');
  if (label) return label;
  const clone = b.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return clone.textContent!.replace(/\s+/g, ' ').replace(/\s,/g, ',').trim();
}

describe('uiBadgeCount (0.44.0)', () => {
  it('is null for none, the number up to max, then max+', () => {
    expect(uiBadgeCount(0)).toBeNull();
    expect(uiBadgeCount(-3)).toBeNull();
    expect(uiBadgeCount(1)).toBe('1');
    expect(uiBadgeCount(9)).toBe('9');
    expect(uiBadgeCount(10)).toBe('9+');
    expect(uiBadgeCount(120, 99)).toBe('99+');
  });
});

describe('button badge (0.44.0)', () => {
  it('shows a hidden bubble at the corner and puts the badge in the name', () => {
    const { btn } = setup();
    for (const c of ['text', 'named', 'icon']) {
      const badge = btn(c).querySelector('.ui-badge') as HTMLElement;
      expect(badge.textContent!.trim()).toBe('2');
      expect(badge.getAttribute('aria-hidden')).toBe('true');
      expect(badge.getAttribute('data-tone')).toBe('danger');
    }
    expect(name(btn('text'))).toBe('Chat, 2 unread');
    expect(name(btn('named'))).toBe('Chat with the nurse, 2 unread');
    expect(name(btn('icon'))).toBe('Chat, 2 unread');
  });

  it('without a badgeLabel the name uses the badge text; the primary tone; null removes it', () => {
    const { h, btn, tick } = setup();
    h.badgeLabel.set(null);
    h.badge.set('9+');
    h.tone.set('primary');
    tick();
    expect(name(btn('text'))).toBe('Chat, 9+');
    expect(name(btn('icon'))).toBe('Chat, 9+');
    expect(btn('icon').querySelector('.ui-badge')!.getAttribute('data-tone')).toBe('primary');
    h.badge.set(null);
    tick();
    for (const c of ['text', 'named', 'icon']) expect(btn(c).querySelector('.ui-badge')).toBeNull();
    expect(name(btn('text'))).toBe('Chat');
    expect(btn('named').getAttribute('aria-label')).toBe('Chat with the nurse');
    expect(btn('icon').getAttribute('aria-label')).toBe('Chat');
  });

  it('sits at the top-end corner, outside the box, unclipped', () => {
    const { btn } = setup();
    const s = getComputedStyle(btn('icon').querySelector('.ui-badge')!);
    expect(s.position).toBe('absolute');
    expect(s.top).toBe('-6px');
    expect(s.getPropertyValue('inset-inline-end')).toBe('-6px');
    expect(getComputedStyle(btn('text')).overflow).toBe('visible');
    expect(getComputedStyle(btn('text')).position).toBe('relative');
  });
});
