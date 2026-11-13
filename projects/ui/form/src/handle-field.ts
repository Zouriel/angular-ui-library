import { Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import AlertCircleIcon from '@hugeicons/core-free-icons/AlertCircleIcon';
import { injectUiConfig } from '@zouriel/ui';
import { UiSpinner } from '@zouriel/ui/spinner';

/** What a handle check found (or where it is). */
export interface UiHandleCheck {
  state: 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
  /** Replaces the built-in line ("@x is free", "@x is taken"). */
  message?: string;
  /** A free handle to offer instead ("Use @x"). */
  suggestion?: string;
}

/** Lower case, only a-z 0-9 . _ kept, at most `max` long. */
export function uiCleanHandle(raw: string, max = Infinity): string {
  return raw.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, max);
}

let nextId = 0;

/**
 * `ui-handle-field` — a field for an @handle (a link name) that checks as you type whether it is
 * free. Letters are made lower case and anything but a-z, 0-9, dot and underscore is dropped as you
 * type or paste. After a pause (`debounceMs`) it calls `check`; a reply for an older value never
 * replaces a newer one. The line under the field says where things are and is read out politely.
 */
@Component({
  selector: 'ui-handle-field',
  imports: [HugeiconsIconComponent, UiSpinner],
  template: `
    <div class="field">
      <label class="lbl" [for]="inputId">{{ label() }}</label>
      <div class="frame" [class.no-radius]="!radius" [attr.data-state]="status().state" (pointerdown)="focusField($event)">
        <span class="prefix" aria-hidden="true">{{ prefix() }}</span>
        <input #field class="input" type="text" [id]="inputId" [value]="value()" [attr.maxlength]="maxLength()"
          autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false" inputmode="url" enterkeyhint="done"
          [attr.aria-invalid]="bad() || null" [attr.aria-describedby]="statusId" (input)="onInput(field)" />
      </div>
      <div class="status" [id]="statusId" aria-live="polite" [attr.data-state]="status().state">
        @switch (status().state) {
          @case ('checking') { <span class="mark" aria-hidden="true"><ui-spinner size="sm" /></span> }
          @case ('available') { <hugeicons-icon class="mark ok" aria-hidden="true" [icon]="icons.tick" [size]="16" [strokeWidth]="2" /> }
          @case ('taken') { <hugeicons-icon class="mark no" aria-hidden="true" [icon]="icons.cross" [size]="16" [strokeWidth]="2" /> }
          @case ('invalid') { <hugeicons-icon class="mark no" aria-hidden="true" [icon]="icons.alert" [size]="16" [strokeWidth]="2" /> }
        }
        <span class="msg">{{ line() }}</span>
      </div>
      @if (offer(); as s) {
        <button type="button" class="use" [class.no-radius]="!radius" (click)="use(s)">Use {{ prefix() }}{{ s }}</button>
      }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .field { display: flex; flex-direction: column; align-items: stretch; gap: var(--ui-space-1); font-family: var(--ui-font-default); line-height: 1.35; }
    .lbl { font-size: var(--ui-font-size-sm); font-weight: 600; color: var(--ui-color-text); }
    .frame {
      display: flex; align-items: center; min-width: 0; box-sizing: border-box; min-height: var(--ui-size-touch); cursor: text;
      padding: 0 var(--ui-space-3); background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard);
    }
    .frame.no-radius { border-radius: 0; }
    .frame:focus-within { border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .frame[data-state="taken"], .frame[data-state="invalid"] { border-color: var(--ui-color-danger); }
    .prefix { flex: none; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-md); user-select: none; }
    .input {
      flex: 1 1 auto; min-width: 0; height: calc(var(--ui-size-touch) - 2px); padding: 0; border: none; outline: none; background: transparent;
      color: inherit; font-family: var(--ui-field-font, var(--ui-font-default)); font-size: var(--ui-font-size-md);
    }
    .status { display: flex; align-items: center; gap: var(--ui-space-1); min-height: 20px; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .status:empty { display: none; }
    .mark { flex: none; display: inline-flex; }
    .ok { --ui-color-icon: var(--ui-color-success); color: var(--ui-color-success); }
    .no { --ui-color-icon: var(--ui-color-danger); color: var(--ui-color-danger); }
    .status[data-state="available"] .msg { color: var(--ui-color-success); }
    .status[data-state="taken"] .msg, .status[data-state="invalid"] .msg { color: var(--ui-color-danger); }
    .msg { min-width: 0; overflow-wrap: anywhere; }
    .use {
      align-self: flex-start; max-width: 100%; min-height: var(--ui-size-sm); padding: 0 var(--ui-space-3); box-sizing: border-box;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; position: relative;
      border: 1px solid var(--ui-color-primary); border-radius: var(--ui-radius-pill); cursor: pointer;
      background: color-mix(in srgb, var(--ui-color-primary) 14%, transparent); color: var(--ui-color-text);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm);
    }
    .use.no-radius { border-radius: var(--ui-radius); }
    .use:hover { background: color-mix(in srgb, var(--ui-color-primary) 24%, transparent); }
    .use:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) { .use { min-height: var(--ui-size-touch); } }
  `,
})
export class UiHandleField {
  protected readonly radius = injectUiConfig().radius;
  protected readonly icons = { tick: Tick02Icon, cross: Cancel01Icon, alert: AlertCircleIcon };
  protected readonly inputId = `ui-handle-${nextId++}`;
  protected readonly statusId = `${this.inputId}-status`;

  /** The handle, without the prefix. Two-way: `[(value)]`. */
  value = model('');
  label = input('Your link name');
  /** Drawn inside the field before the text; not part of the value. */
  prefix = input('@');
  /** Asks the server whether a handle is free. */
  check = input.required<(handle: string) => Promise<UiHandleCheck>>();
  debounceMs = input(400);
  minLength = input(3);
  maxLength = input(30);
  /** Offered as "Use @x" while the field is empty. */
  suggestion = input<string | undefined>(undefined);
  /** Shown under the field while nothing is being checked ("invites.blog/@yourname"). */
  hint = input<string | undefined>(undefined);

  /** Every change of the status line. */
  readonly statusChange = output<UiHandleCheck>();

  protected readonly status = signal<UiHandleCheck>({ state: 'idle' });
  protected readonly bad = computed(() => this.status().state === 'taken' || this.status().state === 'invalid');

  protected readonly line = computed(() => {
    const s = this.status();
    const handle = this.prefix() + this.value();
    switch (s.state) {
      case 'idle': return this.hint() ?? '';
      case 'checking': return s.message ?? 'Checking…';
      case 'available': return s.message ?? `${handle} is free`;
      case 'taken': return s.message ?? `${handle} is taken`;
      case 'invalid': return s.message ?? '';
    }
  });

  /** The result's suggestion, or the input's while the field is empty. */
  protected readonly offer = computed(() => {
    const s = this.status().suggestion;
    if (s && s !== this.value()) return s;
    return this.value() ? null : (this.suggestion() ?? null);
  });

  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  constructor() {
    effect(() => {
      const v = this.value();
      untracked(() => this.schedule(v));
    });
    inject(DestroyRef).onDestroy(() => this.clearTimer());
  }

  protected onInput(field: HTMLInputElement): void {
    const raw = field.value;
    const clean = uiCleanHandle(raw, this.maxLength());
    if (clean !== raw) {
      // Keep the caret after the same kept characters it followed.
      const caret = uiCleanHandle(raw.slice(0, field.selectionStart ?? raw.length), this.maxLength()).length;
      field.value = clean;
      field.setSelectionRange?.(caret, caret);
    }
    this.value.set(clean);
  }

  protected use(handle: string): void {
    this.value.set(uiCleanHandle(handle, this.maxLength()));
  }

  protected focusField(e: PointerEvent): void {
    const frame = e.currentTarget as HTMLElement;
    const field = frame.querySelector('input');
    if (field && e.target !== field) {
      e.preventDefault();
      field.focus();
    }
  }

  private schedule(v: string): void {
    this.clearTimer();
    const mine = ++this.seq;
    if (!v) return this.set({ state: 'idle' });
    if (v.length < this.minLength()) return this.set({ state: 'invalid', message: `At least ${this.minLength()} letters or numbers` });
    this.set({ state: 'checking' });
    this.timer = setTimeout(() => {
      this.timer = null;
      let reply: Promise<UiHandleCheck>;
      try {
        reply = Promise.resolve(this.check()(v));
      } catch (err) {
        reply = Promise.reject(err);
      }
      reply.then(
        (r) => mine === this.seq && this.set(r ?? { state: 'idle' }),
        () => mine === this.seq && this.set({ state: 'invalid', message: "Couldn't check. Try again." }),
      );
    }, this.debounceMs());
  }

  private set(s: UiHandleCheck): void {
    this.status.set(s);
    this.statusChange.emit(s);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
