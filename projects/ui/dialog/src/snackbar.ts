import { Component, Injectable, inject, input, output, signal } from '@angular/core';

export interface UiSnackbarAction {
  label: string;
  run: () => void;
}

export interface UiSnackbarOptions {
  message: string;
  /** Optional bold first line, for a notice that needs a heading. */
  title?: string;
  /** One action, usually Undo. Running it dismisses the snackbar. */
  action?: UiSnackbarAction;
  /** Auto-dismiss after ms; 0 keeps it until dismissed. Default 4000, or 10000 with an action. */
  duration?: number;
}

export interface UiSnack {
  id: number;
  message: string;
  title?: string;
  action?: UiSnackbarAction;
  duration: number;
}

let snackSeq = 0;

/**
 * `ui-snackbar` — the notice itself: a compact inverted bar with a message and an optional
 * link-style action ("Deleted “Name” · Undo"). It has no position or timer of its own; use
 * `UiSnackbarService` + `<ui-snackbar-host>` in an app, or place it yourself inside an editor.
 */
@Component({
  selector: 'ui-snackbar',
  template: `
    <div class="content">
      @if (title()) { <strong class="title">{{ title() }}</strong> }
      <span class="msg">{{ message() }}</span>
    </div>
    @if (actionLabel()) {
      <button type="button" class="act" (click)="action.emit()">{{ actionLabel() }}</button>
    }
  `,
  styles: `
    :host {
      display: flex; align-items: center; gap: var(--ui-space-3); box-sizing: border-box;
      max-width: min(560px, calc(100vw - 2 * var(--ui-space-4)));
      padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-radius);
      background: var(--ui-color-text); color: var(--ui-color-bg); box-shadow: var(--ui-shadow-2);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35;
    }
    .content { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
    .title { font-weight: 600; }
    .act {
      position: relative; flex: none; padding: 0; border: none; background: none; cursor: pointer;
      color: inherit; font: 600 var(--ui-font-size-sm) var(--ui-font-default);
      text-decoration: underline; text-underline-offset: 2px; border-radius: var(--ui-radius-xs);
    }
    .act:hover { text-decoration-thickness: 2px; }
    .act:focus-visible { outline: 2px solid var(--ui-color-bg); outline-offset: 2px; }
    /* Touch-only hit-slop: a full touch target without making the bar taller. */
    @media (pointer: coarse) {
      .act::before { content: ''; position: absolute; left: 50%; top: 50%; width: max(100%, var(--ui-size-touch)); height: var(--ui-size-touch); transform: translate(-50%, -50%); }
    }
  `,
})
export class UiSnackbar {
  message = input.required<string>();
  title = input<string>();
  /** Shows the action button when set. */
  actionLabel = input<string>();
  action = output<void>();
}

/**
 * `UiSnackbarService` — one short notice at a time about something the person just did, shown by
 * `<ui-snackbar-host>`. A new notice replaces the current one. Use toasts for messages that should
 * stack or carry a tone.
 */
@Injectable({ providedIn: 'root' })
export class UiSnackbarService {
  readonly current = signal<UiSnack | null>(null);

  private handle: ReturnType<typeof setTimeout> | null = null;
  private remaining = 0;
  private startedAt = 0;

  show(opts: UiSnackbarOptions | string): number {
    const o = typeof opts === 'string' ? { message: opts } : opts;
    const snack: UiSnack = { id: ++snackSeq, message: o.message, title: o.title, action: o.action, duration: o.duration ?? (o.action ? 10000 : 4000) };
    this.clearTimer();
    this.current.set(snack);
    if (snack.duration > 0) this.arm(snack.duration);
    return snack.id;
  }

  /** Dismisses the current snackbar, or only the one with this id when given. */
  dismiss(id?: number): void {
    if (id !== undefined && this.current()?.id !== id) return;
    this.clearTimer();
    this.current.set(null);
  }

  /** Runs the current snackbar's action, then dismisses it. */
  act(): void {
    const s = this.current();
    this.dismiss();
    s?.action?.run();
  }

  /** Holds it open while the pointer or focus is on it (reading it, reaching for Undo). */
  pause(): void {
    if (this.handle === null) return;
    clearTimeout(this.handle);
    this.handle = null;
    this.remaining = Math.max(0, this.remaining - (Date.now() - this.startedAt));
  }

  /** Restarts the countdown with whatever time was left, at least one more second. */
  resume(): void {
    const s = this.current();
    if (!s || s.duration <= 0 || this.handle !== null) return;
    this.arm(Math.max(this.remaining, 1000));
  }

  private arm(ms: number): void {
    this.remaining = ms;
    this.startedAt = Date.now();
    this.handle = setTimeout(() => { this.handle = null; this.current.set(null); }, ms);
  }

  private clearTimer(): void {
    if (this.handle !== null) clearTimeout(this.handle);
    this.handle = null;
  }
}

/**
 * `ui-snackbar-host` — renders `UiSnackbarService`'s notice centred at the bottom of the screen.
 * Place it once near the app root. `offset` lifts it above a bottom bar or dock.
 */
@Component({
  selector: 'ui-snackbar-host',
  imports: [UiSnackbar],
  template: `
    <div class="host" [style.--ui-snackbar-offset.px]="offset()">
      @if (snacks.current(); as s) {
        <ui-snackbar
          [message]="s.message" [title]="s.title" [actionLabel]="s.action?.label" (action)="snacks.act()"
          animate.enter="ui-slide-up-enter" animate.leave="ui-slide-up-leave"
          (mouseenter)="snacks.pause()" (mouseleave)="snacks.resume()"
          (focusin)="snacks.pause()" (focusout)="snacks.resume()" />
      }
    </div>
    <!-- Always present, so screen readers hear each notice as its text is swapped in. -->
    <div class="sr" role="status" aria-live="polite">{{ announcement() }}</div>
  `,
  styles: `
    .host {
      position: fixed; left: 50%; transform: translateX(-50%); z-index: var(--ui-z-toast);
      bottom: calc(var(--ui-space-4) + var(--ui-snackbar-offset, 0px) + env(safe-area-inset-bottom));
      display: flex; justify-content: center; pointer-events: none;
    }
    ui-snackbar { pointer-events: auto; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `,
})
export class UiSnackbarHost {
  protected readonly snacks = inject(UiSnackbarService);
  /** Extra space below the snackbar in px, e.g. the height of a bottom navigation bar. */
  offset = input(0);

  protected announcement(): string {
    const s = this.snacks.current();
    if (!s) return '';
    return [s.title, s.message].filter(Boolean).join('. ');
  }
}
