import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, ElementRef, Injectable, PLATFORM_ID, computed, inject, input, signal, viewChild } from '@angular/core';
import { UiSnackbarService } from './snackbar';
import { injectUiStrings } from '@zouriel/ui';

export type UiToastTone = 'info' | 'success' | 'warning' | 'danger';

export type UiToastPosition = 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

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

/**
 * `ui-toast-host` — fixed renderer for queued toasts, in a corner or centred on the top or bottom
 * edge. Toasts slide in from the edge they sit against and slide back out that way. A bottom stack
 * moves up above a snackbar (`ui-snackbar-host`) that would otherwise cover it, as on a phone.
 *
 * Font (0.44.2): set `--ui-toast-font` on it (e.g. `style="--ui-toast-font: Faruma, 'Noto Sans Thaana'"`)
 * to draw the title, message and action in an app font, as `--ui-field-font` does for the text
 * fields; it defaults to the theme's `--ui-font-default`.
 */
@Component({
  selector: 'ui-toast-host',
  template: `
    <div #box class="host" [attr.data-position]="position()" [class.lifted]="lift() > 0" [style.--ui-toast-lift.px]="lift()"
         aria-live="polite" aria-atomic="false">
      @for (t of toasts.toasts(); track t.id) {
        <div
          class="toast"
          [attr.data-tone]="t.tone"
          [attr.role]="t.tone === 'danger' || t.tone === 'warning' ? 'alert' : 'status'"
          [animate.enter]="motion().enter"
          [animate.leave]="motion().leave"
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
          <button class="x" type="button" [attr.aria-label]="strings.dismiss" (click)="toasts.dismiss(t.id)"><svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
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
    .host[data-position$="center"] { left: 50%; transform: translateX(-50%); }
    .host[data-position="top-center"]    { top: 0; }
    .host[data-position="bottom-center"] { bottom: 0; }
    /* Above a snackbar in the same spot: the stack's lowest toast sits a gap above the bar. */
    .host[data-position^="bottom"] { transition: bottom var(--ui-motion-base) var(--ui-ease-standard); }
    .host[data-position^="bottom"].lifted { bottom: calc(var(--ui-toast-lift, 0px) - var(--ui-space-2) - env(safe-area-inset-bottom)); }
    .toast {
      pointer-events: auto;
      display: flex; align-items: flex-start; gap: var(--ui-space-2);
      padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-left-width: 3px;
      border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2);
      font-family: var(--ui-toast-font, var(--ui-font-default)); font-size: var(--ui-font-size-sm); line-height: 1.35;
    }
    .toast { --ui-color-icon: currentColor; }
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
      background: transparent; color: var(--ui-color-text); font: 600 var(--ui-font-size-sm) var(--ui-toast-font, var(--ui-font-default)); cursor: pointer;
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
  protected readonly strings = injectUiStrings();
  protected readonly toasts = inject(UiToastService);
  position = input<UiToastPosition>('bottom-right');

  private readonly snacks = inject(UiSnackbarService);
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly viewportWidth = signal(0);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const resize = () => this.viewportWidth.set(window.innerWidth);
    resize();
    window.addEventListener('resize', resize);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('resize', resize));
  }

  /** How far up a bottom stack moves to clear a snackbar it overlaps (px from the screen bottom), else 0. */
  protected readonly lift = computed(() => {
    const bar = this.snacks.area();
    this.viewportWidth();
    const box = this.box()?.nativeElement;
    if (!bar || !box || !this.position().startsWith('bottom')) return 0;
    // The stack's horizontal extent depends only on its position and the viewport width.
    const r = box.getBoundingClientRect();
    return bar.left < r.right && bar.right > r.left ? bar.fromBottom : 0;
  });

  /** Shared animation classes (styles/animations.css) that move toward and away from the toast's own edge. */
  protected readonly motion = computed(() => {
    const pos = this.position();
    if (pos.endsWith('left')) return { enter: 'ui-slide-right-enter', leave: 'ui-slide-right-leave' };
    if (pos === 'top-center') return { enter: 'ui-slide-down-enter', leave: 'ui-slide-down-leave' };
    if (pos === 'bottom-center') return { enter: 'ui-slide-up-enter', leave: 'ui-slide-up-leave' };
    return { enter: 'ui-slide-left-enter', leave: 'ui-slide-left-leave' };
  });
}
