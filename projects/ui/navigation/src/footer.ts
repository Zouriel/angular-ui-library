import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, computed, effect, inject, input, PLATFORM_ID, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon';
import { injectUiLinkNavigator, uiFollowLink } from '@zouriel/ui';

export interface UiFooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface UiFooterColumn {
  title: string;
  links: UiFooterLink[];
}

export interface UiFooterContact {
  label: string;
  value: string;
  href?: string;
}

let footerSeq = 0;

/**
 * `ui-footer` — site footer (`contentinfo` landmark) with brand/aside slots, responsive link columns
 * (accordion closed by default under 600px), emergency/key contacts as LTR `tel:` links, and legal row.
 * Reads only semantic tokens so it takes its look from the surrounding theme or `ui-theme-provider`.
 */
@Component({
  selector: 'ui-footer',
  imports: [HugeiconsIconComponent],
  template: `
    <footer class="ui-footer" [attr.aria-label]="label() || null">
      <div class="inner" [attr.data-size]="size()">
        <div class="top">
          <div class="brand"><ng-content select="[footer-brand]" /></div>
          <div class="aside"><ng-content select="[footer-aside]" /></div>
        </div>

        @if (columns().length) {
          <div class="columns" [class.accordion]="compact()">
            @for (col of columns(); track col.title; let i = $index) {
              <nav class="col" [attr.aria-label]="col.title">
                @if (compact()) {
                  <button
                    type="button"
                    class="col-toggle"
                    [attr.aria-expanded]="isOpen(i)"
                    [attr.aria-controls]="panelId(i)"
                    (click)="toggle(i)">
                    <span>{{ col.title }}</span>
                    <hugeicons-icon class="chev" [class.open]="isOpen(i)" aria-hidden="true"
                      [icon]="arrowIcon" [size]="16" [strokeWidth]="1.8" />
                  </button>
                  <ul role="list" [id]="panelId(i)" [hidden]="!isOpen(i)">
                    @for (link of col.links; track link.href + link.label) {
                      <li>
                        <a
                          class="link"
                          [href]="link.href"
                          [attr.target]="link.external ? '_blank' : null"
                          [attr.rel]="link.external ? 'noopener noreferrer' : null"
                          (click)="follow($event, link)">{{ link.label }}</a>
                      </li>
                    }
                  </ul>
                } @else {
                  <h3 class="col-title">{{ col.title }}</h3>
                  <ul role="list">
                    @for (link of col.links; track link.href + link.label) {
                      <li>
                        <a
                          class="link"
                          [href]="link.href"
                          [attr.target]="link.external ? '_blank' : null"
                          [attr.rel]="link.external ? 'noopener noreferrer' : null"
                          (click)="follow($event, link)">{{ link.label }}</a>
                      </li>
                    }
                  </ul>
                }
              </nav>
            }
          </div>
        }

        @if (contacts().length) {
          <div class="contacts">
            @if (contactsTitle()) {
              <h3 class="contacts-title">{{ contactsTitle() }}</h3>
            }
            <ul role="list" class="contacts-list">
              @for (c of contacts(); track c.label + c.value) {
                <li class="contact-item">
                  <span class="contact-label">{{ c.label }}</span>
                  <a class="contact-link" dir="ltr" [href]="c.href || telHref(c.value)">{{ c.value }}</a>
                </li>
              }
            </ul>
          </div>
        }

        <div class="bottom">
          @if (legal()) {
            <p class="legal-text">{{ legal() }}</p>
          }
          <div class="legal-aside"><ng-content select="[footer-legal]" /></div>
        </div>
      </div>
    </footer>
  `,
  styles: `
    :host { display: block; }
    .ui-footer {
      background: var(--ui-color-bg);
      color: var(--ui-color-text);
      border-top: 1px solid var(--ui-color-border);
      font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-sm);
      line-height: var(--ui-line-height-body);
    }
    .inner {
      margin-inline: auto;
      padding: var(--ui-space-8) var(--ui-space-4);
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-6);
    }
    .inner[data-size="sm"] { max-width: 640px; }
    .inner[data-size="md"] { max-width: 860px; }
    .inner[data-size="lg"] { max-width: 1100px; }
    .inner[data-size="xl"] { max-width: 1320px; }
    .inner[data-size="full"] { max-width: none; }

    .top {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--ui-space-6);
    }
    .brand:empty, .aside:empty, .legal-aside:empty { display: none; }
    .top:has(.brand:empty):has(.aside:empty) { display: none; }
    .brand { flex: 1 1 240px; min-width: 0; }
    .aside { flex: 1 1 260px; max-width: 420px; min-width: 0; }

    .columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--ui-space-6);
    }
    .columns.accordion {
      display: flex;
      flex-direction: column;
      gap: 0;
      border-top: 1px solid var(--ui-color-border);
    }
    .columns.accordion .col {
      border-bottom: 1px solid var(--ui-color-border);
    }

    .col-title {
      margin: 0 0 var(--ui-space-3);
      font-family: var(--ui-font-display);
      font-size: var(--ui-font-size-sm);
      font-weight: var(--ui-font-weight-control);
      color: var(--ui-color-text);
    }
    .col-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-2);
      width: 100%;
      min-height: var(--ui-size-touch);
      padding: var(--ui-space-3) 0;
      background: none;
      border: none;
      color: var(--ui-color-text);
      font-family: var(--ui-font-display);
      font-size: var(--ui-font-size-sm);
      font-weight: var(--ui-font-weight-control);
      text-align: start;
      cursor: pointer;
    }
    .col-toggle:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: var(--ui-radius-xs); }
    .chev { flex: none; color: var(--ui-color-text-muted); transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .chev.open { transform: rotate(180deg); }

    ul[role="list"] {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-2);
    }
    .columns.accordion ul[role="list"]:not([hidden]) {
      padding-bottom: var(--ui-space-4);
    }
    .link {
      display: inline-flex;
      align-items: center;
      color: var(--ui-color-text-secondary);
      text-decoration: none;
      border-radius: var(--ui-radius-xs);
      transition: color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .link:hover { color: var(--ui-color-text); text-decoration: underline; }
    .link:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }

    .contacts {
      padding-top: var(--ui-space-4);
      border-top: 1px solid var(--ui-color-border);
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-3);
    }
    .contacts-title {
      margin: 0;
      font-family: var(--ui-font-display);
      font-size: var(--ui-font-size-sm);
      font-weight: var(--ui-font-weight-control);
      color: var(--ui-color-text);
    }
    .contacts-list {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: var(--ui-space-4) var(--ui-space-6);
    }
    .contact-item {
      display: inline-flex;
      align-items: baseline;
      gap: var(--ui-space-2);
    }
    .contact-label { color: var(--ui-color-text-muted); }
    .contact-link {
      color: var(--ui-color-text);
      font-weight: var(--ui-font-weight-control);
      text-decoration: none;
      unicode-bidi: isolate;
      border-radius: var(--ui-radius-xs);
    }
    .contact-link:hover { text-decoration: underline; }
    .contact-link:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }

    .bottom {
      padding-top: var(--ui-space-4);
      border-top: 1px solid var(--ui-color-border);
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-space-3);
    }
    .bottom:has(.legal-aside:empty):not(:has(.legal-text)) { display: none; }
    .legal-text { margin: 0; color: var(--ui-color-text-muted); }
    .legal-aside { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-4); }

    @media (pointer: coarse) {
      .link, .contact-link { min-height: var(--ui-size-touch); }
    }
    @media (prefers-reduced-motion: reduce) {
      .chev, .link { transition: none; }
    }
  `,
})
export class UiFooter {
  columns = input<UiFooterColumn[]>([]);
  contacts = input<UiFooterContact[]>([]);
  contactsTitle = input<string>('');
  legal = input<string>('');
  label = input<string>('');
  size = input<'sm' | 'md' | 'lg' | 'xl' | 'full'>('xl');

  protected readonly arrowIcon = ArrowDown01Icon;
  protected readonly compact = signal(false);
  private readonly openCols = signal<ReadonlySet<number>>(new Set());
  private readonly idPrefix = `ui-footer-${footerSeq++}`;
  private readonly navigator = injectUiLinkNavigator();
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    if (!isPlatformBrowser(this.platformId) || typeof window.matchMedia !== 'function') return;
    effect((onCleanup) => {
      const mql = window.matchMedia('(max-width: 599px)');
      const apply = () => this.compact.set(mql.matches);
      apply();
      mql.addEventListener('change', apply);
      onCleanup(() => mql.removeEventListener('change', apply));
    });
  }

  protected isOpen(index: number): boolean {
    return this.openCols().has(index);
  }

  protected toggle(index: number): void {
    this.openCols.update((set) => {
      const next = new Set(set);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  protected panelId(index: number): string {
    return `${this.idPrefix}-col-${index}`;
  }

  protected telHref(value: string): string {
    return `tel:${value.replace(/\s+/g, '')}`;
  }

  protected follow(event: MouseEvent, link: UiFooterLink): void {
    uiFollowLink(this.navigator, link.href, event, link.external ? '_blank' : undefined);
  }
}
