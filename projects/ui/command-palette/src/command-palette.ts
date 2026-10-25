import { CdkTrapFocus } from '@angular/cdk/a11y';
import { createBlockScrollStrategy } from '@angular/cdk/overlay';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component, computed, DestroyRef, effect, ElementRef, inject, Injector, input, model, output, PLATFORM_ID, signal, viewChild,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { IconSvgObject } from '@hugeicons/angular';
import { UI_ANIM, UI_CONFIG, uiLeaveHidden, injectUiStrings } from '@zouriel/ui';

export interface UiCommand {
  label: string;
  /** Unique; also the `track` key of the list. */
  value: string;
  /** Shown at the end of the row and matched by the filter. */
  group?: string;
  /** A HugeIcons icon (drawn in currentColor), or a short string such as a letter. */
  icon?: string | IconSvgObject;
  /** Display only, e.g. "Ctrl+S". The palette does not bind it. */
  shortcut?: string;
  /** Extra words the filter matches but the row does not show. */
  keywords?: string;
}

let paletteSeq = 0;

/**
 * `ui-command-palette` — ⌘K-style command launcher. Bind `[(open)]`, pass `commands`, listen to
 * `(run)`. Typing filters by case-insensitive substring over label, group and keywords;
 * ArrowUp/Down move the highlight, Enter runs it, Escape or a backdrop click closes. Focus is
 * trapped while open and returns to where it was on close. While open it sits on its own layer at
 * the end of `<body>` (so a transformed or clipped ancestor can't trap it) and page scroll is
 * blocked with the CDK's block scroll strategy (needs `@angular/cdk/overlay-prebuilt.css`, like the
 * other overlays). It binds no global shortcut: open it from your own keydown handler.
 */
@Component({
  selector: 'ui-command-palette',
  imports: [CdkTrapFocus, HugeiconsIconComponent],
  template: `
    @if (open()) {
      <div #layer class="ui-layer">
      <div class="cp-backdrop" (click)="open.set(false)" animate.enter="ui-backdrop-enter" (animate.leave)="backdropLeave($event)"></div>
      <div class="cp-wrap" (keydown)="onKey($event)">
        <div class="cp" [class.glass]="glass()" [class.no-radius]="!radius()" role="dialog" aria-modal="true" [attr.aria-label]="strings.commandPalette" cdkTrapFocus [cdkTrapFocusAutoCapture]="true"
             animate.enter="ui-scale-enter" animate.leave="ui-scale-leave">
          <input #input class="cp-input" [value]="query()" [attr.placeholder]="placeholderText()"
                 (input)="onInput($event)" role="combobox" aria-expanded="true" [attr.aria-controls]="listId"
                 aria-autocomplete="list" [attr.aria-activedescendant]="filtered().length ? optionId(active()) : null" />
          <ul #list class="cp-list" [id]="listId" role="listbox">
            @for (c of filtered(); track c.value; let i = $index) {
              <li [id]="optionId(i)" role="option" class="cp-item" [class.active]="i === active()" [attr.aria-selected]="i === active()"
                  (mousedown)="$event.preventDefault(); pick(c)" (mouseenter)="active.set(i)">
                @if (c.icon) {
                  <span class="ci" aria-hidden="true">
                    @if (isSvg(c.icon)) { <hugeicons-icon [icon]="c.icon" [size]="16" [strokeWidth]="1.8" /> } @else { {{ c.icon }} }
                  </span>
                }
                <span class="cl">{{ c.label }}</span>
                @if (c.group) { <span class="cg">{{ c.group }}</span> }
                @if (c.shortcut) { <kbd class="ck">{{ c.shortcut }}</kbd> }
              </li>
            } @empty {
              <li class="cp-empty">No results</li>
            }
          </ul>
        </div>
      </div>
      </div>
    }
  `,
  styles: `
    .ui-layer { display: contents; }
    .cp-backdrop { position: fixed; inset: 0; z-index: var(--ui-z-overlay); background: var(--ui-color-overlay); }
    .cp-wrap { position: fixed; inset: 0; z-index: var(--ui-z-overlay); display: flex; justify-content: center; align-items: flex-start; padding-top: 12vh; pointer-events: none; }
    .cp { pointer-events: auto; width: min(560px, 92vw); background: var(--ui-color-surface-raised);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg); box-shadow: var(--ui-shadow-3); overflow: hidden; font-family: var(--ui-font-default);
      color: var(--ui-color-text); line-height: 1.35; }
    .cp.no-radius { border-radius: 0; }
    .cp.glass { background: var(--ui-glass-panel-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .cp-input { display: block; width: 100%; box-sizing: border-box; height: 46px; padding: 0 var(--ui-space-4); border: none;
      border-bottom: 1px solid var(--ui-color-border); background: transparent; color: var(--ui-color-text);
      font: inherit; font-size: var(--ui-font-size-md); outline: none;
      transition: border-color var(--ui-motion-fast) var(--ui-ease-standard); }
    /* The field is the dialog's only control; its underline carries the focus cue. */
    .cp-input:focus-visible { border-bottom-color: var(--ui-color-border-focus); }
    /* Rows share one set of columns (icon, label, group, shortcut) through subgrid, so a group
       lines up down the list whether or not its row has a shortcut. An unused column is 0 wide:
       the gaps are margins on the cells, not column gaps. */
    .cp-list { margin: 0; padding: var(--ui-space-1); list-style: none; max-height: 320px; overflow: auto; overscroll-behavior: contain;
      display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-content: start; }
    .cp-item { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; align-items: center; padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-radius-xs); cursor: pointer; color: var(--ui-color-text); font-size: var(--ui-font-size-sm); }
    .cp-item.active { background: var(--ui-color-elevated-hover); }
    .ci { grid-column: 1; width: 16px; margin-right: var(--ui-space-2); display: inline-flex; align-items: center; justify-content: center; color: var(--ui-color-text-muted); }
    .cl { grid-column: 2; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cg { grid-column: 3; margin-left: var(--ui-space-2); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    /* Matches ui-kbd. */
    .ck { grid-column: 4; justify-self: end; margin-left: var(--ui-space-2); display: inline-flex; align-items: center; min-width: 1.4em; height: 1.5em; padding: 0 0.4em; box-sizing: border-box;
      font-family: var(--ui-font-mono); font-size: 11px; line-height: 1; color: var(--ui-color-text-muted);
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-bottom-width: 2px; border-radius: var(--ui-radius-xs); }
    .cp-empty { grid-column: 1 / -1; padding: var(--ui-space-4); text-align: center; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
})
export class UiCommandPalette {
  protected readonly strings = injectUiStrings();
  /** Fades the backdrop out and keeps it at 0 until the panel's longer leave ends (no flash back). */
  protected readonly backdropLeave = uiLeaveHidden(UI_ANIM.backdrop.leave);

  private config = inject(UI_CONFIG);
  open = model(false);
  commands = input<UiCommand[]>([]);
  /** Default: the built-in `commandPlaceholder` (Type a command or search…), which follows the app's language. */
  placeholder = input<string | undefined>(undefined);
  protected readonly placeholderText = computed(() => this.placeholder() ?? this.strings.commandPlaceholder);
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
  run = output<UiCommand>();

  protected readonly listId = `ui-cp-list-${paletteSeq++}`;
  protected optionId(i: number): string { return `${this.listId}-option-${i}`; }
  protected isSvg(icon: string | IconSvgObject): icon is IconSvgObject { return Array.isArray(icon); }

  protected readonly query = signal('');
  protected readonly active = signal(0);
  private input = viewChild<ElementRef<HTMLInputElement>>('input');
  private list = viewChild<ElementRef<HTMLElement>>('list');
  private layer = viewChild<ElementRef<HTMLElement>>('layer');
  private readonly doc = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly scrollBlock = createBlockScrollStrategy(inject(Injector));
  /** The layer last moved to <body>; kept after close so destroy can still find it. */
  private moved: HTMLElement | null = null;
  private blocking = false;

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.commands();
    return this.commands().filter((c) => `${c.label} ${c.group ?? ''} ${c.keywords ?? ''}`.toLowerCase().includes(q));
  });

  constructor() {
    // Moves the open layer to the end of <body>, as ui-modal does. Angular still removes it when the
    // palette closes (after the leave animations), but not when the owner is destroyed while open.
    effect(() => {
      const el = this.layer()?.nativeElement;
      if (!this.browser || !el || el.parentNode === this.doc.body) return;
      this.doc.body.appendChild(el);
      this.moved = el;
    });
    effect(() => {
      const open = this.open();
      if (!this.browser || open === this.blocking) return;
      if (open) this.scrollBlock.enable();
      else this.scrollBlock.disable();
      this.blocking = open;
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.moved?.parentNode === this.doc.body) this.moved.remove();
      this.moved = null;
      if (this.blocking) this.scrollBlock.disable();
      this.blocking = false;
    });
    effect(() => {
      if (this.open()) {
        this.query.set('');
        this.active.set(0);
        queueMicrotask(() => this.input()?.nativeElement.focus());
      }
    });
  }

  protected onInput(e: Event): void { this.query.set((e.target as HTMLInputElement).value); this.active.set(0); }
  protected onKey(e: KeyboardEvent): void {
    const items = this.filtered();
    if (e.key === 'ArrowDown') { e.preventDefault(); this.active.update((i) => Math.max(0, Math.min(items.length - 1, i + 1))); this.revealActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.update((i) => Math.max(0, i - 1)); this.revealActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = items[this.active()]; if (c) this.runCommand(c); }
    else if (e.key === 'Escape') { e.preventDefault(); this.open.set(false); }
  }
  /** Keeps the keyboard-highlighted option inside the scrolled list. */
  private revealActive(): void {
    queueMicrotask(() => this.list()?.nativeElement.querySelector<HTMLElement>('#' + this.optionId(this.active()))?.scrollIntoView({ block: 'nearest' }));
  }
  protected pick(c: UiCommand): void { this.runCommand(c); }
  private runCommand(c: UiCommand): void { this.run.emit(c); this.open.set(false); }
}
