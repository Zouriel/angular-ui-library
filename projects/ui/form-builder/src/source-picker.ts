import { CdkConnectedOverlay, CdkOverlayOrigin, type ConnectedPosition } from '@angular/cdk/overlay';
import { Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { isChoice, sourceHasMore, toChoice, type UiFbChoice, type UiFbOptionSourceDef, type UiFbSourceItem } from './option-sources';

let seq = 0;

type Status = 'idle' | 'loading' | 'more' | 'error' | 'needs' | 'short';

/**
 * `ui-fb-source-picker` — a searchable dropdown over an option source: type to
 * search, scroll to load the next page, pick one (or several, as chips).
 * Answers are `{ value, label }`. Used by the renderer for sourced fields and
 * by the builder wherever a sourced value is picked (rules, previews).
 */
@Component({
  selector: 'ui-fb-source-picker',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin],
  host: { class: 'ui-fb-sp-host' },
  template: `
    <div class="sp" cdkOverlayOrigin #origin="cdkOverlayOrigin" [class.open]="open()" [class.invalid]="invalid()" [class.disabled]="disabled()"
      [class.multi]="multiple()" (click)="focusInput()">
      @if (multiple()) {
        @for (c of chosenList(); track c.value) {
          <span class="chip">
            <span class="chip-t">{{ c.label }}</span>
            <button type="button" class="chip-x" [attr.aria-label]="'Remove ' + c.label" [disabled]="disabled()" (click)="remove(c, $event)">
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
            </button>
          </span>
        }
      }
      <input #inp class="in" type="text" role="combobox" autocomplete="off" spellcheck="false" aria-autocomplete="list"
        [id]="inputId() || null" [attr.aria-label]="ariaLabel() || null" [attr.aria-expanded]="open()" [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="open() && active() >= 0 ? optId(active()) : null" [attr.aria-invalid]="invalid() || null"
        [placeholder]="showPlaceholder() ? placeholder() : ''" [value]="inputText()" [disabled]="disabled()"
        (input)="onInput($event)" (focus)="onFocus()" (blur)="onBlur()" (keydown)="onKey($event)" />
      @if (!multiple() && single() && !disabled()) {
        <button type="button" class="clear" aria-label="Clear" (click)="clear($event)">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      }
      <span class="chev" aria-hidden="true">
        @if (status() === 'loading' && open()) { <span class="spin"></span> }
        @else { <svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg> }
      </span>
    </div>

    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayWidth]="width()" [cdkConnectedOverlayPush]="true"
      [cdkConnectedOverlayViewportMargin]="8" (overlayOutsideClick)="outside($event)" (detach)="close()">
      <!-- mousedown is cancelled so picking an option never takes focus from the input. -->
      <div class="panel" (mousedown)="$event.preventDefault()">
        @if (items().length) {
          <ul class="list" role="listbox" [id]="listId" [attr.aria-multiselectable]="multiple() || null" [attr.aria-label]="source().label"
            #list (scroll)="onScroll()">
            @for (it of items(); track it.value; let i = $index) {
              <li role="option" class="opt" [id]="optId(i)" [class.active]="i === active()" [class.chosen]="isChosen(it)"
                [attr.aria-selected]="isChosen(it)" (click)="choose(it)" (mousemove)="active.set(i)">
                @if (multiple()) {
                  <span class="box" [class.on]="isChosen(it)" aria-hidden="true">
                    @if (isChosen(it)) { <svg viewBox="0 0 24 24" width="12" height="12"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg> }
                  </span>
                }
                <span class="txt"><span class="lbl">{{ it.label }}</span>@if (it.description) { <span class="desc">{{ it.description }}</span> }</span>
                @if (!multiple() && isChosen(it)) {
                  <svg class="tick" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                }
              </li>
            }
          </ul>
        } @else {
          <ul class="list" role="listbox" [id]="listId" [attr.aria-label]="source().label"></ul>
        }
        @if (message(); as m) {
          <div class="status" [class.bad]="status() === 'error'">
            <span role="status">{{ m }}</span>
            @if (status() === 'error') { <button type="button" class="retry" (click)="retry()">Try again</button> }
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .sp { position: relative; display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-1); box-sizing: border-box; min-height: var(--ui-size-md);
      padding: 2px calc(var(--ui-space-3) + 34px) 2px var(--ui-space-3); border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); line-height: 1.35;
      cursor: text; transition: border-color var(--ui-motion-fast) var(--ui-ease-standard), box-shadow var(--ui-motion-fast) var(--ui-ease-standard); }
    .sp.multi { padding-left: var(--ui-space-1); }
    .sp:hover:not(.disabled) { border-color: var(--ui-color-border-strong); }
    .sp:focus-within { border-color: var(--ui-color-border-focus); box-shadow: var(--ui-focus-ring); }
    .sp.invalid { border-color: var(--ui-color-danger); }
    .sp.disabled { opacity: .5; cursor: not-allowed; }
    .in { flex: 1 1 80px; min-width: 60px; height: calc(var(--ui-size-md) - 6px); padding: 0; border: 0; outline: none; background: transparent;
      color: inherit; font: inherit; }
    .sp.multi .in { padding-left: var(--ui-space-1); }
    .in::placeholder { color: var(--ui-color-text-muted); }
    .in:disabled { cursor: not-allowed; }
    .chip { display: inline-flex; align-items: center; gap: 2px; max-width: 100%; min-width: 0; height: 22px; padding: 0 2px 0 var(--ui-space-2); box-sizing: border-box;
      border: 1px solid color-mix(in srgb, var(--ui-color-primary) 45%, transparent); border-radius: var(--ui-radius-xs); background: var(--ui-color-selected);
      font-size: var(--ui-font-size-sm); }
    .chip-t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip-x, .clear { display: inline-grid; place-items: center; flex: none; padding: 0; border: 0; border-radius: var(--ui-radius-xs); background: transparent;
      color: var(--ui-color-text-muted); font: inherit; cursor: pointer; }
    .chip-x { width: 18px; height: 18px; }
    .clear { position: absolute; right: calc(var(--ui-space-3) + 14px); top: 50%; width: 20px; height: 20px; transform: translateY(-50%); }
    .chip-x:hover, .clear:hover { color: var(--ui-color-text); background: var(--ui-color-surface-hover); }
    .chip-x:focus-visible, .clear:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .chev { position: absolute; right: var(--ui-space-3); top: 50%; transform: translateY(-50%); display: inline-grid; place-items: center; width: 14px; height: 14px;
      color: var(--ui-color-text-muted); pointer-events: none; }
    .sp.open .chev svg { transform: rotate(180deg); }
    .spin { width: 12px; height: 12px; border: 2px solid var(--ui-color-border); border-top-color: var(--ui-color-primary); border-radius: 50%; animation: sp-spin 700ms linear infinite; }
    @keyframes sp-spin { to { transform: rotate(360deg); } }

    .panel { box-sizing: border-box; width: 100%; padding: var(--ui-space-1); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface-raised); box-shadow: var(--ui-shadow-2); color: var(--ui-color-text); font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-md); line-height: 1.35; }
    .list { list-style: none; margin: 0; padding: 0; max-height: 264px; overflow: auto; overscroll-behavior: contain; }
    .list:empty { display: none; }
    .opt { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-radius-xs); cursor: pointer; }
    .opt.active { background: var(--ui-color-elevated-hover); }
    .opt.chosen { background: var(--ui-color-selected); }
    .opt.chosen.active { background: color-mix(in srgb, var(--ui-color-selected) 100%, var(--ui-color-elevated-hover)); }
    .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .desc { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tick { flex: none; color: var(--ui-color-primary); }
    .box { display: inline-grid; place-items: center; flex: none; width: 16px; height: 16px; box-sizing: border-box; border: 1.5px solid var(--ui-control-border);
      border-radius: 4px; color: var(--ui-color-primary-contrast); }
    .box.on { background: var(--ui-color-primary); border-color: var(--ui-color-primary); }
    .status { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .status.bad { color: var(--ui-color-danger); }
    .retry { margin-left: auto; height: var(--ui-size-sm); padding: 0 var(--ui-space-2); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-xs);
      background: var(--ui-color-surface); color: var(--ui-color-text); font: inherit; cursor: pointer; }
    .retry:hover { background: var(--ui-color-surface-hover); }
    .retry:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) {
      .opt { min-height: var(--ui-size-touch); }
      .chip-x { width: 24px; height: 24px; }
      .clear { width: 32px; height: 32px; }
    }
    @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 1.4s; } }
  `,
})
export class UiFbSourcePicker {
  private readonly destroyRef = inject(DestroyRef);

  readonly source = input.required<UiFbOptionSourceDef>();
  /** The source's settings, already resolved (answers from other questions filled in). */
  readonly params = input<Record<string, unknown>>({});
  readonly multiple = input(false);
  /** `{ value, label }`, a list of them when `multiple`, or null. Bare values are accepted too. */
  readonly value = input<unknown>(null);
  readonly placeholder = input('Search…');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly inputId = input('');
  readonly ariaLabel = input('');
  readonly valueChange = output<UiFbChoice | UiFbChoice[] | null>();

  protected readonly listId = `ui-fb-sp-${++seq}`;
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];
  private readonly inp = viewChild.required<ElementRef<HTMLInputElement>>('inp');
  private readonly origin = viewChild.required(CdkOverlayOrigin);
  private readonly listEl = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly open = signal(false);
  protected readonly query = signal('');
  /** Typing in a single picker replaces the shown label until it closes. */
  private readonly typing = signal(false);
  protected readonly items = signal<UiFbSourceItem[]>([]);
  protected readonly active = signal(-1);
  protected readonly status = signal<Status>('idle');
  protected readonly width = signal(0);
  private page = 0;
  private hasMore = false;
  private loadedKey: string | null = null;
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly single = computed(() => (this.multiple() ? null : toChoice(Array.isArray(this.value()) ? (this.value() as unknown[])[0] : this.value())));
  protected readonly chosenList = computed<UiFbChoice[]>(() => {
    const v = this.value();
    return (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]).map(toChoice).filter((c): c is UiFbChoice => !!c);
  });
  private readonly chosenKeys = computed(() => new Set((this.multiple() ? this.chosenList() : this.single() ? [this.single()!] : []).map((c) => String(c.value))));
  protected readonly inputText = computed(() => (this.multiple() || this.typing() ? this.query() : this.single()?.label ?? ''));
  protected readonly showPlaceholder = computed(() => !this.multiple() || !this.chosenList().length);
  private readonly pageSize = computed(() => this.source().pageSize ?? 20);
  private readonly missingParam = computed(() => this.source().params?.find((p) => p.required && isBlank(this.params()[p.key])));
  /** Searches depend on the query and the resolved params; a change starts over from page 1. */
  private readonly key = computed(() => JSON.stringify([this.source().type, this.params(), this.query().trim()]));

  protected readonly message = computed(() => {
    const st = this.status();
    const missing = this.missingParam();
    if (st === 'needs' && missing) return `Choose ${missing.label.toLowerCase()} first.`;
    if (st === 'short') return `Type at least ${this.source().minQueryLength} characters to search.`;
    if (st === 'error') return 'Couldn’t load the list.';
    if (st === 'loading') return 'Searching…';
    if (st === 'more') return 'Loading more…';
    if (!this.items().length && this.loadedKey !== null) return this.query().trim() ? `No matches for “${this.query().trim()}”.` : 'Nothing to choose from.';
    return '';
  });

  constructor() {
    // New params (a parent answer changed) make the loaded pages stale.
    effect(() => {
      this.params();
      untracked(() => {
        this.loadedKey = null;
        if (this.open()) this.search(true);
      });
    });
    this.destroyRef.onDestroy(() => {
      this.controller?.abort();
      if (this.timer) clearTimeout(this.timer);
    });
  }

  protected optId(i: number): string {
    return `${this.listId}-${i}`;
  }

  protected isChosen(it: UiFbSourceItem): boolean {
    return this.chosenKeys().has(String(it.value));
  }

  protected focusInput(): void {
    if (!this.disabled()) this.inp().nativeElement.focus();
  }

  protected onFocus(): void {
    this.openPanel();
  }

  protected onBlur(): void {
    this.close();
  }

  protected outside(e: MouseEvent): void {
    if (!this.origin().elementRef.nativeElement.contains(e.target as Node)) this.close();
  }

  private openPanel(): void {
    if (this.disabled()) return;
    this.width.set(this.origin().elementRef.nativeElement.getBoundingClientRect().width);
    this.open.set(true);
    if (this.loadedKey !== this.key()) this.search(true);
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.typing.set(false);
    this.active.set(-1);
    if (this.query()) {
      this.query.set('');
      this.loadedKey = null;
    }
  }

  protected onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.typing.set(true);
    if (!this.open()) this.openPanel();
    this.active.set(-1);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search(true), this.source().debounceMs ?? 250);
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.items().length;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        if (!this.open()) { this.openPanel(); return; }
        if (!n) return;
        const d = e.key === 'ArrowDown' ? 1 : -1;
        const next = this.active() < 0 ? (d > 0 ? 0 : n - 1) : (this.active() + d + n) % n;
        this.setActive(next);
        return;
      }
      case 'Home':
      case 'End':
        if (this.open() && n && !this.query()) { e.preventDefault(); this.setActive(e.key === 'Home' ? 0 : n - 1); }
        return;
      case 'Enter':
        // Never let Enter submit the surrounding form while the list is open.
        if (this.open()) {
          e.preventDefault();
          const it = this.items()[this.active()];
          if (it) this.choose(it);
        }
        return;
      case 'Escape':
        if (this.open()) { e.preventDefault(); e.stopPropagation(); this.close(); }
        return;
      case 'Tab':
        this.close();
        return;
      case 'Backspace':
        if (this.multiple() && !this.query() && this.chosenList().length) {
          const list = this.chosenList();
          this.valueChange.emit(list.slice(0, -1));
        }
        return;
    }
  }

  private setActive(i: number): void {
    this.active.set(i);
    queueMicrotask(() => document.getElementById(this.optId(i))?.scrollIntoView?.({ block: 'nearest' }));
    // Reaching the end with the keyboard loads the next page too.
    if (i >= this.items().length - 2) this.loadMore();
  }

  protected choose(it: UiFbSourceItem): void {
    const choice: UiFbChoice = { value: it.value, label: it.label };
    if (this.multiple()) {
      const list = this.chosenList();
      const has = list.some((c) => String(c.value) === String(it.value));
      this.valueChange.emit(has ? list.filter((c) => String(c.value) !== String(it.value)) : [...list, choice]);
      return;
    }
    this.valueChange.emit(choice);
    this.close();
  }

  protected remove(c: UiFbChoice, e: Event): void {
    e.stopPropagation();
    this.valueChange.emit(this.chosenList().filter((x) => String(x.value) !== String(c.value)));
  }

  protected clear(e: Event): void {
    e.stopPropagation();
    this.valueChange.emit(null);
    this.query.set('');
    this.focusInput();
  }

  protected onScroll(): void {
    const el = this.listEl()?.nativeElement;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 48) this.loadMore();
  }

  protected retry(): void {
    this.search(this.page <= 1);
  }

  private loadMore(): void {
    if (this.hasMore && this.status() !== 'loading' && this.status() !== 'more') this.search(false);
  }

  /** Loads page 1 (`reset`) or the next page, cancelling whatever is still in flight. */
  private async search(reset: boolean): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const def = this.source();
    const key = this.key();
    const q = this.query().trim();
    if (this.missingParam()) { this.reset('needs', key); return; }
    if (q.length < (def.minQueryLength ?? 0)) { this.reset('short', key); return; }
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const page = reset ? 1 : this.page + 1;
    this.status.set(reset ? 'loading' : 'more');
    if (reset) this.active.set(-1);
    try {
      const res = await def.search({ query: q, page, pageSize: this.pageSize(), params: this.params(), signal: controller.signal });
      if (controller.signal.aborted) return;
      const items = reset ? res.items : [...this.items(), ...res.items];
      this.items.set(items);
      this.page = page;
      this.hasMore = sourceHasMore(res, items.length, this.pageSize());
      this.loadedKey = key;
      this.status.set('idle');
      if (reset && items.length && this.typing()) this.active.set(0);
    } catch {
      if (controller.signal.aborted) return;
      this.status.set('error');
    }
  }

  private reset(status: Status, key: string): void {
    this.controller?.abort();
    this.items.set([]);
    this.page = 0;
    this.hasMore = false;
    this.loadedKey = key;
    this.status.set(status);
  }
}

function isBlank(v: unknown): boolean {
  return v == null || v === '' || (Array.isArray(v) && !v.length) || (isChoice(v) && (v.value == null || v.value === ''));
}
