import { DOCUMENT } from '@angular/common';
import { ApplicationRef, Component, ElementRef, EnvironmentInjector, Injectable, computed, createComponent, inject, input, model, output } from '@angular/core';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import { injectUiStrings } from '@zouriel/ui';
import { UiButton } from '@zouriel/ui/button';
import { UiDrawer } from './drawer';

/** One row of an action sheet (0.61.0). */
export interface UiActionSheetAction<T = unknown> {
  label: string;
  /** What `UiActionSheet.open()` resolves with when this row is chosen. */
  value: T;
  /** A 20px leading icon (hugeicons data, e.g. `import { Delete02Icon } from '@hugeicons/core-free-icons/Delete02Icon'`). */
  icon?: IconSvgObject;
  /** Destructive: drawn in the danger colour, icon too, and placed after the other rows. */
  danger?: boolean;
  /** Dimmed, can't be chosen, skipped by the arrow keys. */
  disabled?: boolean;
}

export interface UiActionSheetOptions<T = unknown> {
  title?: string;
  /** Muted text under the title. */
  message?: string;
  actions: UiActionSheetAction<T>[];
  /** A Cancel button at the end; `''` for the built-in `cancel` string; omitted: none. */
  cancelLabel?: string;
}

/** `actions` in the order shown: the non-danger rows, then the danger ones, each keeping its order. */
export function uiActionSheetOrder<T>(actions: UiActionSheetAction<T>[]): UiActionSheetAction<T>[] {
  return [...actions.filter((a) => !a.danger), ...actions.filter((a) => a.danger)];
}

/**
 * `ui-action-sheet` (0.61.0): a short list of actions in a bottom `ui-drawer` with a drag handle,
 * sized to its content (up to 90% of the room, then the rows scroll). An optional title (a guest's
 * name) and muted message sit above full-width rows (48px tall, a 20px icon and the label, 12px
 * apart). Danger rows are red, icon too, and always come after the others. Choosing a row emits
 * `(select)` with its value and closes it; the backdrop, a swipe down, Escape and Cancel just close it.
 * Focus starts on the first action and the arrow keys (Home, End) move between rows.
 * Usually opened through the `UiActionSheet` service.
 */
@Component({
  selector: 'ui-action-sheet',
  imports: [UiDrawer, UiButton, HugeiconsIconComponent],
  template: `
    <ui-drawer [(open)]="open" side="bottom" [handle]="true" fit="content" [ariaLabel]="title()">
      @if (title() || message()) {
        <div drawer-header class="head">
          @if (title()) { <div class="title" role="heading" aria-level="2">{{ title() }}</div> }
          @if (message()) { <div class="msg">{{ message() }}</div> }
        </div>
      }
      <div class="rows" role="group" (keydown)="onKey($event)">
        @for (a of rows(); track $index) {
          <button type="button" class="row" [class.danger]="a.danger" [disabled]="a.disabled"
                  [attr.cdkFocusInitial]="$index === firstEnabled() ? '' : null" (click)="choose(a)">
            @if (a.icon) { <hugeicons-icon class="ic" [icon]="a.icon" [size]="20" [strokeWidth]="1.8" aria-hidden="true" /> }
            <span class="label">{{ a.label }}</span>
          </button>
        }
      </div>
      @if (cancelText(); as c) {
        <div drawer-footer><ui-button variant="outline" [block]="true" (click)="open.set(false)">{{ c }}</ui-button></div>
      }
    </ui-drawer>
  `,
  styles: `
    .head { display: flex; flex-direction: column; gap: var(--ui-space-1); font-family: var(--ui-font-default); line-height: 1.35; }
    .title { font-weight: 600; font-size: var(--ui-font-size-md); letter-spacing: var(--ui-tracking-tight); color: var(--ui-color-text); overflow-wrap: anywhere; }
    .msg { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    /* Rows run edge to edge: undo the drawer body's side padding, keep space-2 above and below. */
    .rows { display: flex; flex-direction: column; margin: calc(var(--ui-space-2) - var(--ui-space-3)) calc(-1 * var(--ui-space-4)); }
    .row {
      display: flex; align-items: center; gap: var(--ui-space-3); width: 100%; min-height: 48px; box-sizing: border-box;
      padding: var(--ui-space-3) var(--ui-space-4); border: 2px solid transparent; background: transparent;
      color: var(--ui-color-text); font: inherit; font-family: var(--ui-font-default); font-size: var(--ui-font-size-md);
      line-height: 1.35; text-align: start; cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .row .ic { flex: none; color: var(--ui-color-icon, currentColor); }
    .row .label { min-width: 0; overflow-wrap: anywhere; }
    .row:hover:not(:disabled), .row:focus-visible { background: var(--ui-color-surface-hover); }
    .row:focus-visible { outline: none; border-color: var(--ui-color-border-focus); }
    .row.danger { color: var(--ui-color-danger); }
    .row.danger .ic { color: var(--ui-color-danger); }
    .row.danger:hover:not(:disabled), .row.danger:focus-visible { background: color-mix(in srgb, var(--ui-color-danger) 12%, transparent); }
    .row:disabled { opacity: 0.5; cursor: default; }
  `,
})
export class UiActionSheetPanel<T = unknown> {
  protected readonly strings = injectUiStrings();
  private readonly host = inject(ElementRef<HTMLElement>);
  open = model(false);
  title = input<string>();
  message = input<string>();
  actions = input<UiActionSheetAction<T>[]>([]);
  /** A Cancel button at the end; `''` for the built-in string; undefined: none. */
  cancelLabel = input<string>();
  /** A row was chosen (the sheet then closes). */
  readonly select = output<T>();

  protected readonly rows = computed(() => uiActionSheetOrder(this.actions()));
  protected readonly firstEnabled = computed(() => this.rows().findIndex((a) => !a.disabled));
  protected readonly cancelText = computed(() => {
    const c = this.cancelLabel();
    return c === undefined ? null : c || this.strings.cancel;
  });

  protected choose(a: UiActionSheetAction<T>): void {
    this.select.emit(a.value);
    this.open.set(false);
  }

  protected onKey(e: KeyboardEvent): void {
    const list = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('.row:not(:disabled)')];
    if (!list.length) return;
    const cur = list.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = (cur + 1) % list.length;
    else if (e.key === 'ArrowUp') next = cur < 0 ? list.length - 1 : (cur - 1 + list.length) % list.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = list.length - 1;
    if (next === null) return;
    e.preventDefault();
    list[next].focus();
  }
}

/**
 * `UiActionSheet` (0.61.0): opens a `ui-action-sheet` from code and resolves with the chosen
 * action's value, or `undefined` when it is closed another way (backdrop, swipe down, Escape, Cancel).
 *
 *   const action = await this.sheet.open({ title: guest.name, cancelLabel: '', actions: [
 *     { label: 'Edit', value: 'edit', icon: Edit02Icon },
 *     { label: 'Remove', value: 'remove', icon: Delete02Icon, danger: true },
 *   ] });
 */
@Injectable({ providedIn: 'root' })
export class UiActionSheet {
  private readonly app = inject(ApplicationRef);
  private readonly env = inject(EnvironmentInjector);
  private readonly doc = inject(DOCUMENT);

  open<T>(options: UiActionSheetOptions<T>): Promise<T | undefined> {
    const ref = createComponent(UiActionSheetPanel<T>, { environmentInjector: this.env });
    ref.setInput('title', options.title);
    ref.setInput('message', options.message);
    ref.setInput('actions', options.actions);
    ref.setInput('cancelLabel', options.cancelLabel);
    this.app.attachView(ref.hostView);
    this.doc.body.appendChild(ref.location.nativeElement);
    ref.instance.open.set(true);
    return new Promise<T | undefined>((resolve) => {
      let result: T | undefined;
      const sel = ref.instance.select.subscribe((v) => (result = v));
      const sub = ref.instance.open.subscribe((open) => {
        if (open) return;
        sel.unsubscribe();
        sub.unsubscribe();
        resolve(result);
        // Leave the drawer's leave animation time to run before taking the host down.
        setTimeout(() => {
          this.app.detachView(ref.hostView);
          ref.destroy();
        }, 400);
      });
    });
  }
}
