import { DOCUMENT } from '@angular/common';
import { Component, NgZone, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';

export interface UiAnchorItem {
  id: string;
  label: string;
}

/**
 * `ui-anchor-nav` — scrollspy navigation: highlights the section in view and scrolls to it on click.
 * The sections are looked up by id once, just after init; sections added later are not watched.
 */
@Component({
  selector: 'ui-anchor-nav',
  template: `
    <nav class="an" [attr.aria-label]="strings.onThisPage">
      <ul>
        @for (item of items(); track item.id) {
          <li>
            <button type="button" class="link" [class.active]="item.id === active()" (click)="scrollTo(item.id)">{{ item.label }}</button>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    :host { display: block; }
    ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; border-inline-start: 1px solid var(--ui-color-border); }
    .link { display: block; width: 100%; text-align: start; padding: var(--ui-space-1) var(--ui-space-3);
      background: none; border: none; border-inline-start: 2px solid transparent; margin-inline-start: -1px; cursor: pointer;
      font: inherit; font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35; color: var(--ui-color-text-muted);
      transition: color var(--ui-motion-fast) var(--ui-ease-standard); }
    .link:hover { color: var(--ui-color-text); }
    @media (pointer: coarse) { .link { min-height: var(--ui-size-touch); } }
    .link.active { color: var(--ui-color-primary); border-inline-start-color: var(--ui-color-primary); }
    .link:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `,
})
export class UiAnchorNav implements OnInit, OnDestroy {
  protected readonly strings = injectUiStrings();
  private doc = inject(DOCUMENT);
  private zone = inject(NgZone);
  items = input<UiAnchorItem[]>([]);
  /**
   * Height in px of a fixed header above the content: a section only counts as in view below it.
   * Read once at init. It does not change where a click scrolls to; give the sections a matching
   * `scroll-margin-top` for that.
   */
  offset = input(80);
  protected readonly active = signal<string>('');
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') return; // server-side render
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) this.zone.run(() => this.active.set(entry.target.id));
      }
    }, { rootMargin: `-${this.offset()}px 0px -65% 0px` });
    queueMicrotask(() => {
      for (const item of this.items()) {
        const el = this.doc.getElementById(item.id);
        if (el) this.observer!.observe(el);
      }
    });
  }
  ngOnDestroy(): void { this.observer?.disconnect(); }

  protected scrollTo(id: string): void {
    this.doc.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.active.set(id);
  }
}
