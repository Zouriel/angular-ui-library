import { CdkConnectedOverlay, CdkOverlayOrigin, type ConnectedPosition } from '@angular/cdk/overlay';
import { DOCUMENT } from '@angular/common';
import { Component, computed, ElementRef, inject, input, model, signal, viewChildren } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon';
import { injectUiStrings, UiDirectionService, uiLogicalKey, UiStringsService, type UiStrings } from '@zouriel/ui';

export interface UiLanguage {
  code: string;
  label: string;
  dir: 'ltr' | 'rtl';
  strings?: Partial<UiStrings>;
}

const MENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
];

/**
 * `ui-language-switch` — switches the page's language, direction (`UiDirectionService.set`), and
 * built-in strings (`UiStringsService.set` when `strings` is given). Each option is rendered in its
 * own language and script with its own `lang` attribute, never as a flag.
 */
@Component({
  selector: 'ui-language-switch',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay, HugeiconsIconComponent],
  template: `
    @switch (appearance()) {
      @case ('segmented') {
        <div class="seg" role="radiogroup" [attr.aria-label]="labelText()">
          @for (lang of languages(); track lang.code; let i = $index) {
            <button
              #segBtn
              type="button"
              role="radio"
              class="seg-opt"
              [class.on]="lang.code === current()"
              [attr.lang]="lang.code"
              [attr.aria-checked]="lang.code === current()"
              [attr.tabindex]="lang.code === current() || (!hasCurrent() && i === 0) ? 0 : -1"
              (click)="select(lang)"
              (keydown)="onSegKey($event, i)">{{ lang.label }}</button>
          }
        </div>
      }
      @case ('menu') {
        <button
          #menuTrigger
          type="button"
          class="menu-trigger"
          cdkOverlayOrigin
          #origin="cdkOverlayOrigin"
          aria-haspopup="menu"
          [attr.aria-expanded]="menuOpen()"
          [attr.aria-label]="labelText()"
          (click)="menuOpen.update(v => !v)">
          <span [attr.lang]="currentLang()?.code ?? null">{{ currentLang()?.label ?? current() }}</span>
          <hugeicons-icon class="chev" [class.open]="menuOpen()" aria-hidden="true"
            [icon]="arrowIcon" [size]="14" [strokeWidth]="1.8" />
        </button>

        <ng-template
          cdkConnectedOverlay
          [cdkConnectedOverlayOrigin]="origin"
          [cdkConnectedOverlayOpen]="menuOpen()"
          [cdkConnectedOverlayPositions]="positions"
          [cdkConnectedOverlayPush]="true"
          [cdkConnectedOverlayViewportMargin]="8"
          (overlayOutsideClick)="menuOpen.set(false)"
          (attach)="focusMenuSelected()"
          (detach)="menuOpen.set(false)">
          <div class="menu-panel" role="menu" [attr.aria-label]="labelText()" (keydown)="onMenuKey($event)">
            @for (lang of languages(); track lang.code) {
              <button
                #menuOpt
                type="button"
                role="menuitemradio"
                class="menu-opt"
                [class.on]="lang.code === current()"
                [attr.lang]="lang.code"
                [attr.aria-checked]="lang.code === current()"
                (click)="chooseMenu(lang)">{{ lang.label }}</button>
            }
          </div>
        </ng-template>
      }
      @default {
        <div class="links" role="group" [attr.aria-label]="labelText()">
          @for (lang of languages(); track lang.code; let last = $last) {
            <button
              type="button"
              class="link-opt"
              [class.on]="lang.code === current()"
              [attr.lang]="lang.code"
              [attr.aria-pressed]="lang.code === current()"
              (click)="select(lang)">{{ lang.label }}</button>
            @if (!last) {
              <span class="sep" aria-hidden="true">·</span>
            }
          }
        </div>
      }
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; max-width: 100%; font-family: var(--ui-font-default); }

    .links { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-1); }
    .link-opt {
      display: inline-flex; align-items: center; min-height: var(--ui-size-sm); padding: 0 var(--ui-space-2);
      background: none; border: none; border-radius: var(--ui-radius-xs);
      color: var(--ui-color-text-muted); font: inherit; font-size: var(--ui-font-size-sm); font-weight: 500;
      cursor: pointer; transition: color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .link-opt:hover { color: var(--ui-color-text); text-decoration: underline; }
    .link-opt.on { color: var(--ui-color-text); font-weight: var(--ui-font-weight-control); }
    .link-opt:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .sep { color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); user-select: none; }

    .seg {
      display: inline-flex; padding: 2px; gap: 2px; border-radius: var(--ui-radius);
      background: var(--ui-color-surface-subtle); border: 1px solid var(--ui-color-border);
      max-width: 100%; overflow-x: auto;
    }
    .seg-opt {
      flex: 1 0 auto; min-width: 30px; height: calc(var(--ui-size-sm) - 4px); padding: 0 var(--ui-space-3);
      border: 0; border-radius: calc(var(--ui-radius) - 2px);
      background: transparent; color: var(--ui-color-text-muted);
      font: 500 var(--ui-font-size-sm) var(--ui-font-default); cursor: pointer; white-space: nowrap;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .seg-opt:hover:not(.on) { color: var(--ui-color-text); background: var(--ui-color-surface-hover); }
    .seg-opt.on { background: var(--ui-color-surface-raised); color: var(--ui-color-text); box-shadow: var(--ui-shadow-1); }
    .seg-opt:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }

    .menu-trigger {
      display: inline-flex; align-items: center; gap: var(--ui-space-2);
      height: var(--ui-size-sm); padding: 0 var(--ui-space-3);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-control-border, var(--ui-color-border));
      border-radius: var(--ui-button-radius, var(--ui-radius));
      font: inherit; font-size: var(--ui-font-size-sm); font-weight: var(--ui-font-weight-control);
      cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), border-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .menu-trigger:hover { background: var(--ui-color-surface-hover); }
    .menu-trigger:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .chev { color: var(--ui-color-text-muted); transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .chev.open { transform: rotate(180deg); }

    .menu-panel {
      display: flex; flex-direction: column; min-width: 140px; padding: var(--ui-space-1);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2); font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm);
    }
    .menu-opt {
      display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2);
      padding: var(--ui-space-2) var(--ui-space-3); background: transparent; border: none;
      border-radius: var(--ui-radius-xs); color: inherit; font: inherit; text-align: start; cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .menu-opt:hover, .menu-opt:focus-visible { background: var(--ui-color-elevated-hover); outline: none; }
    .menu-opt:focus-visible { box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    .menu-opt.on { font-weight: var(--ui-font-weight-control); background: var(--ui-color-selected); }

    @media (pointer: coarse) {
      .link-opt, .menu-trigger, .menu-opt { min-height: var(--ui-size-touch); }
    }
    @media (prefers-reduced-motion: reduce) {
      .link-opt, .seg-opt, .menu-trigger, .chev, .menu-opt { transition: none; }
    }
  `,
})
export class UiLanguageSwitch {
  protected readonly strings = injectUiStrings();
  private readonly doc = inject(DOCUMENT);
  private readonly direction = inject(UiDirectionService);
  private readonly stringsService = inject(UiStringsService);

  languages = input.required<UiLanguage[]>();
  value = model<string>('');
  appearance = input<'link' | 'segmented' | 'menu'>('link');
  label = input<string | undefined>(undefined);

  protected readonly arrowIcon = ArrowDown01Icon;
  protected readonly positions = MENU_POSITIONS;
  protected readonly menuOpen = signal(false);
  protected readonly labelText = computed(() => this.label() ?? this.strings.language);

  private readonly segBtns = viewChildren<ElementRef<HTMLButtonElement>>('segBtn');
  private readonly menuOpts = viewChildren<ElementRef<HTMLButtonElement>>('menuOpt');
  private readonly menuTrigger = viewChildren<ElementRef<HTMLButtonElement>>('menuTrigger');

  protected readonly current = computed(() => {
    const v = this.value();
    if (v) return v;
    return this.doc.documentElement.getAttribute('lang') || this.languages()[0]?.code || '';
  });

  protected readonly hasCurrent = computed(() => this.languages().some((l) => l.code === this.current()));
  protected readonly currentLang = computed(() => this.languages().find((l) => l.code === this.current()));

  protected select(lang: UiLanguage): void {
    this.value.set(lang.code);
    this.direction.set(lang.dir, lang.code);
    if (lang.strings) this.stringsService.set(lang.strings);
  }

  protected chooseMenu(lang: UiLanguage): void {
    this.select(lang);
    this.menuOpen.set(false);
    this.menuTrigger()[0]?.nativeElement.focus();
  }

  protected onSegKey(e: KeyboardEvent, index: number): void {
    const langs = this.languages();
    const key = uiLogicalKey(e);
    const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
    if (!step || !langs.length) return;
    e.preventDefault();
    const next = (index + step + langs.length) % langs.length;
    this.select(langs[next]);
    this.segBtns()[next]?.nativeElement.focus();
  }

  protected focusMenuSelected(): void {
    const opts = this.menuOpts();
    const idx = Math.max(0, this.languages().findIndex((l) => l.code === this.current()));
    setTimeout(() => opts[idx]?.nativeElement.focus());
  }

  protected onMenuKey(e: KeyboardEvent): void {
    const opts = this.menuOpts();
    if (!opts.length) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.menuOpen.set(false);
      this.menuTrigger()[0]?.nativeElement.focus();
      return;
    }
    const idx = opts.findIndex((o) => o.nativeElement === this.doc.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      opts[(idx + 1) % opts.length]?.nativeElement.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      opts[(idx - 1 + opts.length) % opts.length]?.nativeElement.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      opts[0]?.nativeElement.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      opts[opts.length - 1]?.nativeElement.focus();
    }
  }
}
