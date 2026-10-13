import { Component, Injectable, inject, input, signal } from '@angular/core';

export type UiToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface UiToastOptions {
  message: string;
  title?: string;
  tone?: UiToastTone;
  /** Auto-dismiss after ms. Pass 0 to keep until dismissed. Default 4000. */
  duration?: number;
  /** One button in the toast, e.g. Undo. Running it dismisses the toast. */
  action?: UiToastAction;
}

export interface UiToastAction {
  label: string;
  run: () => void;
}

export interface UiToast extends Required<Omit<UiToastOptions, 'title' | 'action'>> {
  id: number;
  title?: string;
  action?: UiToastAction;
}

let toastSeq = 0;

/**
 * `UiToastService` — enqueue transient notifications. Render once with
 * `<ui-toast-host />` near the app root.
 */
@Injectable({ providedIn: 'root' })
export class UiToastService {
  readonly toasts = signal<UiToast[]>([]);

  show(opts: UiToastOptions): number {
    const id = ++toastSeq;
    const toast: UiToast = {
      id,
      message: opts.message,
      title: opts.title,
      tone: opts.tone ?? 'info',
      duration: opts.duration ?? 4000,
      action: opts.action,
    };
    this.toasts.update((list) => [...list, toast]);
    if (toast.duration > 0) this.arm(id, toast.duration);
    return id;
  }

  /** Remaining time and live timer per auto-dismissing toast, so hover/focus can hold it open. */
  private readonly timers = new Map<number, { remaining: number; startedAt: number; handle: ReturnType<typeof setTimeout> | null }>();

  private arm(id: number, ms: number): void {
    const handle = setTimeout(() => this.dismiss(id), ms);
    this.timers.set(id, { remaining: ms, startedAt: Date.now(), handle });
  }

  /** Holds a toast open while the pointer or focus is on it (reading it, reaching for Undo). */
  pause(id: number): void {
    const t = this.timers.get(id);
    if (!t || t.handle === null) return;
    clearTimeout(t.handle);
    t.handle = null;
    t.remaining = Math.max(0, t.remaining - (Date.now() - t.startedAt));
  }

  /** Restarts the countdown with whatever time was left when it was paused. */
  resume(id: number): void {
    const t = this.timers.get(id);
    if (!t || t.handle !== null) return;
    this.arm(id, Math.max(t.remaining, 1000));
  }

  info(message: string, title?: string) { return this.show({ message, title, tone: 'info' }); }
  success(message: string, title?: string) { return this.show({ message, title, tone: 'success' }); }
  warning(message: string, title?: string) { return this.show({ message, title, tone: 'warning' }); }
  danger(message: string, title?: string) { return this.show({ message, title, tone: 'danger' }); }

  /** Runs a toast's action, then dismisses it. */
  act(id: number): void {
    const toast = this.toasts().find((t) => t.id === id);
    this.dismiss(id);
    toast?.action?.run();
  }

  dismiss(id: number): void {
    const t = this.timers.get(id);
    if (t?.handle) clearTimeout(t.handle);
    this.timers.delete(id);
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}

/** `ui-toast-host` — fixed-corner renderer for queued toasts. */
@Component({
  selector: 'ui-toast-host',
  template: `
    <div class="host" [attr.data-position]="position()" aria-live="polite" aria-atomic="false">
      @for (t of toasts.toasts(); track t.id) {
        <div
          class="toast"
          [attr.data-tone]="t.tone"
          [attr.role]="t.tone === 'danger' || t.tone === 'warning' ? 'alert' : 'status'"
          animate.enter="ui-slide-left-enter"
          animate.leave="ui-fade-leave"
          (mouseenter)="toasts.pause(t.id)" (mouseleave)="toasts.resume(t.id)"
          (focusin)="toasts.pause(t.id)" (focusout)="toasts.resume(t.id)">
          <span class="icon" aria-hidden="true">
            @switch (t.tone) {
            @case ('success') { <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM8 12.5l2.7 2.7L16 9.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
            @case ('warning') { <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M10.3 4.2L2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0zM12 9.5v4M12 17h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
            @case ('danger') { <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.5 9.5l5 5M14.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
            @default { <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
          }
          </span>
          <div class="content">
            @if (t.title) { <strong class="title">{{ t.title }}</strong> }
            <span class="msg">{{ t.message }}</span>
          </div>
          @if (t.action) {
            <button class="act" type="button" (click)="toasts.act(t.id)">{{ t.action.label }}</button>
          }
          <button class="x" type="button" aria-label="Dismiss" (click)="toasts.dismiss(t.id)"><svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        </div>
      }
    </div>
  `,
  styles: `
    .host {
      position: fixed; z-index: var(--ui-z-toast);
      display: flex; flex-direction: column; gap: var(--ui-space-2);
      box-sizing: border-box; width: min(380px, 100vw);
      padding: var(--ui-space-4); pointer-events: none;
    }
    .host[data-position^="top"]    { padding-top: calc(var(--ui-space-4) + env(safe-area-inset-top)); }
    .host[data-position^="bottom"] { padding-bottom: calc(var(--ui-space-4) + env(safe-area-inset-bottom)); }
    .host[data-position="top-right"]    { top: 0; right: 0; }
    .host[data-position="top-left"]     { top: 0; left: 0; }
    .host[data-position="bottom-right"] { bottom: 0; right: 0; }
    .host[data-position="bottom-left"]  { bottom: 0; left: 0; }
    .toast {
      pointer-events: auto;
      display: flex; align-items: flex-start; gap: var(--ui-space-2);
      padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-left-width: 3px;
      border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35;
    }
    .toast[data-tone="info"]    { border-left-color: var(--ui-color-info); }
    .toast[data-tone="success"] { border-left-color: var(--ui-color-success); }
    .toast[data-tone="warning"] { border-left-color: var(--ui-color-warning); }
    .toast[data-tone="danger"]  { border-left-color: var(--ui-color-danger); }
    /* Icon box is one line tall so the glyph centres on the first line of text. */
    .icon { flex: none; display: inline-flex; align-items: center; height: 1.35em; color: var(--ui-color-info); }
    .toast[data-tone="success"] .icon { color: var(--ui-color-success); }
    .toast[data-tone="warning"] .icon { color: var(--ui-color-warning); }
    .toast[data-tone="danger"]  .icon { color: var(--ui-color-danger); }
    .content { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
    .title { font-weight: 600; }
    .msg { color: var(--ui-color-text-muted); }
    .act {
      align-self: center; flex: none; box-sizing: border-box; height: var(--ui-size-sm); padding: 0 var(--ui-space-2);
      border: 1px solid var(--ui-color-border-strong); border-radius: var(--ui-radius-xs);
      background: transparent; color: var(--ui-color-text); font: 600 var(--ui-font-size-sm) var(--ui-font-default); cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .act:hover { background: var(--ui-color-elevated-hover); }
    .act:active { transform: scale(var(--ui-scale-press)); }
    .act:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .x {
      position: relative; flex: none;
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--ui-size-sm); height: var(--ui-size-sm); padding: 0; margin: calc(var(--ui-space-1) * -1);
      border: none; background: transparent; border-radius: var(--ui-radius-xs);
      color: var(--ui-color-text-muted); font: inherit; font-size: 16px; line-height: 1; cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard),
                  transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .x:hover { background: var(--ui-color-elevated-hover); color: var(--ui-color-text); }
    .x:active { transform: scale(var(--ui-scale-press)); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    /* Touch-only hit-slop: the visible box stays compact on desktop. */
    @media (pointer: coarse) { .x::before { content: ''; position: absolute; inset: calc((var(--ui-size-sm) - var(--ui-size-touch)) / 2); } }
  `,
})
export class UiToastHost {
  protected readonly toasts = inject(UiToastService);
  position = input<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('bottom-right');
}
