import { isPlatformBrowser } from '@angular/common';
import { Directionality } from '@angular/cdk/bidi';
import { Component, DestroyRef, ElementRef, Injectable, PLATFORM_ID, TemplateRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { UiBlobToast } from './blob-toast';
import { UiSnackbarService } from './snackbar';
import { injectUiStrings } from '@zouriel/ui';

export type UiToastTone = 'info' | 'success' | 'warning' | 'danger';

/** Where toasts stack. `-start` / `-end` (0.46.0) follow the text direction (the end is the right in LTR, the left
 *  under `dir="rtl"`); `-left` / `-right` stay put. */
export type UiToastPosition =
  | 'top-end' | 'top-start' | 'top-center' | 'bottom-end' | 'bottom-start' | 'bottom-center'
  | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

/** How a toast is drawn: `card`, the bordered card with a tone edge, or `blob` (0.88.0), a dark pill
 *  that grows a card beneath it as one shape. */
export type UiToastVariant = 'card' | 'blob';

/** When blob toasts open their card: `auto`, a lone blob toast opens by itself and several stay pills
 *  that open under the pointer, focus or a tap; `always`, each opens by itself; `hover`, never by itself. */
export type UiBlobExpand = 'auto' | 'always' | 'hover';

export interface UiToastOptions {
  /** The text. Optional since 0.88.0: a blob toast with only a title stays a pill. */
  message?: string;
  title?: string;
  tone?: UiToastTone;
  /** Auto-dismiss after ms. Pass 0 to keep until dismissed. Default 4000 (0 while `loading`). */
  duration?: number;
  /** One button in the toast, e.g. Undo. Running it dismisses the toast. */
  action?: UiToastAction;
  /** Default `card`. */
  variant?: UiToastVariant;
  /** Work in progress: a spinner in place of the tone's icon, and on a blob toast a muted title. */
  loading?: boolean;
  /** Blob toasts only: your own content in the card, between the message and the action. The
   *  template's implicit context is the toast. */
  content?: TemplateRef<unknown>;
}

/** What `update` can change: any option, with `undefined` clearing the title, action or content. */
export type UiToastPatch = Partial<UiToastOptions>;

/** One state of a `promise` toast: its title alone, or any options. */
export type UiToastState = string | UiToastPatch;

export interface UiToastPromiseStates<T> {
  loading: UiToastState;
  success: UiToastState | ((value: T) => UiToastState);
  error: UiToastState | ((error: unknown) => UiToastState);
}

export interface UiToastAction {
  label: string;
  run: () => void;
}

export interface UiToast {
  id: number;
  message: string;
  title?: string;
  tone: UiToastTone;
  duration: number;
  action?: UiToastAction;
  variant: UiToastVariant;
  loading: boolean;
  content?: TemplateRef<unknown>;
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
    const loading = opts.loading ?? false;
    const toast: UiToast = {
      id,
      message: opts.message ?? '',
      title: opts.title,
      tone: opts.tone ?? 'info',
      duration: opts.duration ?? (loading ? 0 : 4000),
      action: opts.action,
      variant: opts.variant ?? 'card',
      loading,
      content: opts.content,
    };
    this.toasts.update((list) => [...list, toast]);
    if (toast.duration > 0) this.arm(id, toast.duration);
    return id;
  }

  /** A blob toast (0.88.0): a pill with `title`, growing a card for the message, content and action. */
  blob(title: string, opts: Omit<UiToastOptions, 'title' | 'variant'> = {}): number {
    return this.show({ ...opts, title, variant: 'blob' });
  }

  /**
   * Changes a showing toast in place (0.88.0): its tone, text, action, or `loading`. The countdown
   * starts again with the new duration: `patch.duration`, else 4000 when the toast stops loading,
   * else what it had. A blob toast closes to its pill, changes there, and opens again.
   */
  update(id: number, patch: UiToastPatch): void {
    const old = this.toasts().find((t) => t.id === id);
    if (!old) return;
    const loading = patch.loading ?? old.loading;
    const next: UiToast = {
      ...old,
      ...patch,
      id,
      message: 'message' in patch ? patch.message ?? '' : old.message,
      tone: patch.tone ?? old.tone,
      variant: patch.variant ?? old.variant,
      loading,
      duration: patch.duration ?? (old.loading && !loading ? 4000 : old.duration),
    };
    this.toasts.update((list) => list.map((t) => (t.id === id ? next : t)));
    const timer = this.timers.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    this.timers.delete(id);
    if (next.duration > 0) this.arm(id, next.duration);
  }

  /**
   * A blob toast that follows a promise (0.88.0): a loading pill, which becomes the success toast
   * when the promise resolves or the error toast when it rejects. Each state is a title or any
   * options; success and error can be functions of the result. Returns the same promise.
   */
  promise<T>(promise: Promise<T>, states: UiToastPromiseStates<T>): Promise<T> {
    const opts = (s: UiToastState): UiToastPatch => (typeof s === 'string' ? { title: s } : s);
    const id = this.show({ variant: 'blob', ...opts(states.loading), loading: true });
    const settle = (tone: UiToastTone, state: UiToastState) =>
      this.update(id, { tone, message: '', action: undefined, content: undefined, ...opts(state), loading: false });
    promise.then(
      (value) => settle('success', typeof states.success === 'function' ? states.success(value) : states.success),
      (error: unknown) => settle('danger', typeof states.error === 'function' ? states.error(error) : states.error),
    );
    return promise;
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
  imports: [UiBlobToast],
  template: `
    <div #box class="host" [attr.data-position]="position()" [class.lifted]="lift() > 0" [style.--ui-toast-lift.px]="lift()"
         aria-live="polite" aria-atomic="false">
      @for (t of toasts.toasts(); track t.id) {
        @if (t.variant === 'blob') {
          <ui-blob-toast
            [toast]="t" [side]="side()" [expanded]="blobsOpen()"
            animate.enter="ui-scale-enter" animate.leave="ui-scale-leave"
            (act)="toasts.act(t.id)" (dismiss)="toasts.dismiss(t.id)"
            (mouseenter)="toasts.pause(t.id)" (mouseleave)="toasts.resume(t.id)"
            (focusin)="toasts.pause(t.id)" (focusout)="toasts.resume(t.id)" />
        } @else {
        <div
          class="toast"
          [attr.data-tone]="t.tone"
          [attr.role]="t.tone === 'danger' || t.tone === 'warning' ? 'alert' : 'status'"
          [animate.enter]="motion().enter"
          [animate.leave]="motion().leave"
          (mouseenter)="toasts.pause(t.id)" (mouseleave)="toasts.resume(t.id)"
          (focusin)="toasts.pause(t.id)" (focusout)="toasts.resume(t.id)">
          <span class="icon" aria-hidden="true">
            @if (t.loading) { <span class="spin"></span> } @else {
            @switch (t.tone) {
            @case ('success') { <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM8 12.5l2.7 2.7L16 9.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
            @case ('warning') { <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M10.3 4.2L2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0zM12 9.5v4M12 17h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
            @case ('danger') { <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.5 9.5l5 5M14.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
            @default { <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
          }
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
    .host[data-position="top-end"]      { top: 0; inset-inline-end: 0; }
    .host[data-position="top-start"]    { top: 0; inset-inline-start: 0; }
    .host[data-position="bottom-end"]   { bottom: 0; inset-inline-end: 0; }
    .host[data-position="bottom-start"] { bottom: 0; inset-inline-start: 0; }
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
      border: 1px solid var(--ui-color-border); border-inline-start-width: 3px;
      border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2);
      font-family: var(--ui-toast-font, var(--ui-font-default)); font-size: var(--ui-font-size-sm); line-height: 1.35;
    }
    .toast { --ui-color-icon: currentColor; }
    .toast[data-tone="info"]    { border-inline-start-color: var(--ui-color-info); }
    .toast[data-tone="success"] { border-inline-start-color: var(--ui-color-success); }
    .toast[data-tone="warning"] { border-inline-start-color: var(--ui-color-warning); }
    .toast[data-tone="danger"]  { border-inline-start-color: var(--ui-color-danger); }
    /* Icon box is one line tall so the glyph centres on the first line of text. */
    .icon { flex: none; display: inline-flex; align-items: center; height: 1.35em; color: var(--ui-color-info); }
    .toast[data-tone="success"] .icon { color: var(--ui-color-success); }
    .toast[data-tone="warning"] .icon { color: var(--ui-color-warning); }
    .toast[data-tone="danger"]  .icon { color: var(--ui-color-danger); }
    .spin {
      box-sizing: border-box; width: 14px; height: 14px; border-radius: 50%; color: var(--ui-color-text-muted);
      border: 2px solid var(--ui-color-border-strong); border-top-color: currentColor;
      animation: toast-spin 0.8s linear infinite;
    }
    @keyframes toast-spin { to { transform: rotate(360deg); } }
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
      color: var(--ui-color-text-muted); font: inherit; font-size: calc(16px * var(--ui-font-scale)); line-height: 1; cursor: pointer;
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
  /** Default `bottom-end` (0.46.0; the bottom right in LTR as before, the bottom left in RTL). */
  position = input<UiToastPosition>('bottom-end');

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

  /** When blob toasts open their card (0.88.0). Default `auto`: one opens by itself; with more than one
   *  showing they stay pills and open under the pointer, focus or a tap. */
  blobExpand = input<UiBlobExpand>('auto');
  protected readonly blobsOpen = computed(() => {
    const mode = this.blobExpand();
    return mode === 'always' || (mode === 'auto' && this.toasts.toasts().filter((t) => t.variant === 'blob').length <= 1);
  });

  private readonly dir = inject(Directionality);
  /** The physical side blob toasts keep to: their pill sits on it, or in the middle for a centred stack. */
  protected readonly side = computed<'left' | 'center' | 'right'>(() => {
    const pos = this.position();
    if (pos.endsWith('center')) return 'center';
    if (pos.endsWith('left') || pos.endsWith('right')) return pos.endsWith('left') ? 'left' : 'right';
    return pos.endsWith('-start') === (this.dir.valueSignal() === 'rtl') ? 'right' : 'left';
  });

  /** Shared animation classes (styles/animations.css) that move toward and away from the toast's own edge. */
  protected readonly motion = computed(() => {
    const pos = this.position();
    if (pos.endsWith('left')) return { enter: 'ui-slide-right-enter', leave: 'ui-slide-right-leave' };
    if (pos.endsWith('-start')) return { enter: 'ui-slide-from-start-enter', leave: 'ui-slide-from-start-leave' };
    if (pos.endsWith('-end')) return { enter: 'ui-slide-from-end-enter', leave: 'ui-slide-from-end-leave' };
    if (pos === 'top-center') return { enter: 'ui-slide-down-enter', leave: 'ui-slide-down-leave' };
    if (pos === 'bottom-center') return { enter: 'ui-slide-up-enter', leave: 'ui-slide-up-leave' };
    return { enter: 'ui-slide-left-enter', leave: 'ui-slide-left-leave' };
  });
}
