import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import AiChat02Icon from '@hugeicons/core-free-icons/AiChat02Icon';
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import InformationCircleIcon from '@hugeicons/core-free-icons/InformationCircleIcon';
import SparklesIcon from '@hugeicons/core-free-icons/SparklesIcon';

export type UiChatLauncher = 'hover' | 'floating' | 'draggable';
export type UiChatPosition = 'start' | 'end';
export interface UiChatHeadPosition {
  x: number;
  y: number;
}

let nextWidgetId = 0;

/**
 * `ui-chat-widget` — a corner-docked or draggable chat launcher and panel with header,
 * optional notice bar, auto-scrolling message log, quick-actions slot, and footer slot.
 */
@Component({
  selector: 'ui-chat-widget',
  imports: [HugeiconsIconComponent],
  host: {
    '[class.open]': 'open()',
    '[class.at-start]': "position() === 'start'",
    '[class.drag-mode]': "launcher() === 'draggable'",
    '(document:keydown.escape)': 'escape()',
  },
  template: `
    @if (open()) {
      <section
        #panel
        class="panel"
        role="dialog"
        aria-modal="false"
        [attr.aria-labelledby]="titleId"
        tabindex="-1"
        [style.left.px]="launcher() === 'draggable' && headOnLeft() ? head().x + 76 : null"
        [style.right.px]="launcher() === 'draggable' && !headOnLeft() ? winWidth() - head().x + 12 : null"
        [style.top.px]="launcher() === 'draggable' ? panelTop() : null"
        [class.opens-down]="launcher() === 'draggable' && opensDown()"
      >
        <header>
          <div class="avatar">
            <ng-content select="[chat-avatar]" />
            <hugeicons-icon class="avatar-fallback" aria-hidden="true" [icon]="sparkIcon" [size]="26" />
          </div>
          <div class="who">
            <h2 [id]="titleId">{{ title() }}</h2>
            @if (subtitle()) {
              <p>{{ subtitle() }}</p>
            }
          </div>
          <ng-content select="[chat-header-actions]" />
          <button class="icon" type="button" [attr.aria-label]="closeLabel()" (click)="setOpen(false)">
            <hugeicons-icon aria-hidden="true" [icon]="downIcon" [size]="20" />
          </button>
        </header>
        @if (notice()) {
          <div class="notice">
            <hugeicons-icon aria-hidden="true" [icon]="infoIcon" [size]="15" />
            <span>{{ notice() }}</span>
          </div>
        }
        <div #log class="log" role="log" aria-live="polite"><ng-content /></div>
        <div class="quick"><ng-content select="[chat-quick-actions]" /></div>
        <footer><ng-content select="[chat-footer]" /></footer>
      </section>
    }
    @if (teaser() && launcher() === 'floating' && !open() && !teaserGone()) {
      <div class="teaser" role="status">
        <span>{{ teaser() }}</span>
        <button type="button" aria-label="Dismiss" (click)="dismissTeaser()">
          <hugeicons-icon aria-hidden="true" [icon]="cancelIcon" [size]="16" />
        </button>
      </div>
    }
    @if (!hidden()) {
      <button
        #launch
        type="button"
        class="launcher"
        [class.pill]="launcher() === 'hover'"
        [class.dragging]="dragging()"
        [attr.aria-label]="launcherLabel()"
        [attr.aria-expanded]="open()"
        [style.left.px]="launcher() === 'draggable' ? head().x : null"
        [style.top.px]="launcher() === 'draggable' ? head().y : null"
        (click)="launchClick($event)"
        (pointerdown)="down($event)"
        (pointermove)="move($event)"
        (pointerup)="up($event)"
        (pointercancel)="up($event)"
        (keydown)="launcherKey($event)"
      >
        <hugeicons-icon
          aria-hidden="true"
          [icon]="open() ? downIcon : launcher() === 'hover' ? sparkIcon : chatIcon"
          [size]="open() || launcher() === 'hover' ? 30 : 32"
        />
        @if (launcher() === 'hover') {
          <span class="pill-copy">
            <b>{{ label() }}</b>
            <small>{{ hint() }}</small>
          </span>
        }
        @if (unread() > 0 && !open()) {
          <span class="badge" [attr.aria-label]="unread() + ' unread'">{{ unread() > 99 ? '99+' : unread() }}</span>
        }
      </button>
    }
    @if (dragging() && dismissible()) {
      <div class="drop" aria-hidden="true">
        <hugeicons-icon aria-hidden="true" [icon]="cancelIcon" [size]="22" />
      </div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      z-index: 60;
      inset-block-end: calc(var(--ui-space-6) + env(safe-area-inset-bottom));
      inset-inline-end: calc(var(--ui-space-6) + env(safe-area-inset-right));
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--ui-space-3);
      font-family: var(--ui-font-default);
      color: var(--ui-color-text);
    }
    :host(.at-start) {
      inset-inline-end: auto;
      inset-inline-start: calc(var(--ui-space-6) + env(safe-area-inset-left));
      align-items: flex-start;
    }
    .panel {
      width: 380px;
      height: min(600px, calc(100dvh - 112px));
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius-lg);
      box-shadow: var(--ui-shadow-3);
      animation: panel-in var(--ui-motion-base) var(--ui-ease-decelerate);
      transform-origin: bottom right;
      overscroll-behavior: contain;
    }
    :host(.at-start) .panel {
      transform-origin: bottom left;
    }
    .panel.opens-down {
      transform-origin: top right;
    }
    :host(.at-start) .panel.opens-down {
      transform-origin: top left;
    }
    header {
      display: flex;
      align-items: center;
      gap: var(--ui-space-3);
      padding: 14px var(--ui-space-3);
      border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border));
    }
    .avatar {
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--ui-color-primary);
      color: var(--ui-color-primary-contrast);
    }
    .avatar:has([chat-avatar]) .avatar-fallback {
      display: none;
    }
    .who {
      flex: 1;
      min-width: 0;
    }
    .who h2 {
      margin: 0;
      font-size: calc(16px * var(--ui-font-scale));
      line-height: 1.3;
    }
    .who p {
      margin: 2px 0 0;
      font-size: var(--ui-font-size-sm);
      color: var(--ui-color-text-muted);
    }
    .icon {
      flex: none;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: none;
      color: var(--ui-color-icon);
      cursor: pointer;
    }
    .icon:hover {
      background: var(--ui-color-surface-hover);
    }
    button:focus-visible,
    .panel:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
    }
    .notice {
      display: flex;
      gap: var(--ui-space-2);
      align-items: center;
      padding: var(--ui-space-2) var(--ui-space-4);
      font-size: 12.5px;
      line-height: 1.4;
      color: var(--ui-color-text-secondary);
      background: var(--ui-color-surface-subtle);
      border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border));
    }
    .notice hugeicons-icon {
      flex: none;
      color: var(--ui-color-info);
    }
    .log {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: var(--ui-space-4);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .quick:empty,
    footer:empty {
      display: none;
    }
    .quick {
      padding: 0 var(--ui-space-4) var(--ui-space-3);
    }
    .launcher {
      position: relative;
      flex: none;
      width: 64px;
      height: 64px;
      border: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--ui-color-primary);
      color: var(--ui-color-primary-contrast);
      box-shadow: var(--ui-shadow-2);
      cursor: pointer;
      touch-action: none;
      user-select: none;
    }
    .launcher:hover {
      box-shadow: var(--ui-shadow-3);
    }
    .badge {
      position: absolute;
      inset-block-start: -3px;
      inset-inline-end: -3px;
      min-width: 20px;
      height: 20px;
      padding: 0 4px;
      box-sizing: border-box;
      border-radius: var(--ui-radius-pill);
      display: grid;
      place-items: center;
      background: var(--ui-color-accent);
      color: var(--ui-color-accent-contrast);
      border: 2px solid var(--ui-color-surface);
      font-size: 11px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .teaser {
      max-width: 260px;
      display: flex;
      gap: var(--ui-space-2);
      align-items: flex-start;
      padding: var(--ui-space-3);
      background: var(--ui-color-surface-raised);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius-lg);
      border-end-end-radius: var(--ui-radius-xs);
      box-shadow: var(--ui-shadow-2);
      font-size: var(--ui-font-size-sm);
      line-height: 1.45;
    }
    :host(.at-start) .teaser {
      border-end-end-radius: var(--ui-radius-lg);
      border-end-start-radius: var(--ui-radius-xs);
    }
    .teaser button {
      flex: none;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 50%;
      background: none;
      color: var(--ui-color-icon);
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    .pill {
      width: auto;
      max-width: 64px;
      padding: 0 17px;
      border-radius: 32px;
      gap: 0;
      overflow: hidden;
      transition:
        max-width var(--ui-motion-base) var(--ui-ease-standard),
        box-shadow var(--ui-motion-base) var(--ui-ease-standard);
    }
    .pill-copy {
      max-width: 0;
      opacity: 0;
      white-space: nowrap;
      text-align: start;
      transition:
        max-width var(--ui-motion-base) var(--ui-ease-standard),
        opacity var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .pill-copy b,
    .pill-copy small {
      display: block;
    }
    .pill-copy b {
      font-size: var(--ui-font-size-md);
    }
    .pill-copy small {
      font-size: 12px;
      opacity: 0.85;
    }
    @media (hover: hover) and (pointer: fine) {
      .pill:hover,
      .pill:focus-visible {
        max-width: 340px;
        gap: var(--ui-space-3);
        padding-inline-end: 22px;
      }
      .pill:hover .pill-copy,
      .pill:focus-visible .pill-copy {
        max-width: 260px;
        opacity: 1;
      }
    }
    @media (hover: none) {
      .pill {
        max-width: 340px;
        gap: var(--ui-space-3);
        padding-inline-end: 22px;
      }
      .pill-copy {
        max-width: 260px;
        opacity: 1;
      }
    }
    :host(.drag-mode) {
      inset: 0;
      pointer-events: none;
    }
    :host(.drag-mode) .launcher {
      position: fixed;
      pointer-events: auto;
      cursor: grab;
      transition:
        left var(--ui-motion-base) var(--ui-ease-decelerate),
        top var(--ui-motion-base) var(--ui-ease-decelerate),
        transform var(--ui-motion-fast) var(--ui-ease-standard),
        box-shadow var(--ui-motion-fast) var(--ui-ease-standard);
    }
    :host(.drag-mode) .launcher.dragging {
      transition: none;
    }
    :host(.drag-mode) .panel {
      position: fixed;
      pointer-events: auto;
    }
    .dragging {
      cursor: grabbing;
      transform: scale(1.08);
      box-shadow: var(--ui-shadow-3);
    }
    .drop {
      position: fixed;
      inset-block-end: calc(28px + env(safe-area-inset-bottom));
      left: 50%;
      translate: -50% 0;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--ui-color-danger) 14%, var(--ui-color-surface));
      color: var(--ui-color-danger);
      border: 1px solid var(--ui-color-danger);
      pointer-events: none;
    }
    @keyframes panel-in {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    @media (max-width: 600px) {
      :host(.open) {
        inset: 0;
        display: block;
      }
      :host(.open) .panel {
        width: 100%;
        height: 100%;
        left: 0 !important;
        right: 0 !important;
        top: 0 !important;
        bottom: 0 !important;
        border: 0;
        border-radius: 0;
      }
      :host(.open) .launcher {
        display: none;
      }
      .panel header {
        padding-top: calc(14px + env(safe-area-inset-top));
      }
      .panel footer {
        padding-bottom: env(safe-area-inset-bottom);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel {
        animation: none;
      }
      .pill,
      .pill-copy,
      :host(.drag-mode) .launcher {
        transition: none;
      }
    }
  `,
})
export class UiChatWidget implements OnDestroy {
  readonly open = model(false);
  readonly position = input<UiChatPosition>('end');
  readonly unread = input(0);
  readonly title = input('Assistant');
  readonly subtitle = input('');
  readonly notice = input('');
  readonly launcherLabel = input('Open the assistant');
  readonly closeLabel = input('Close the assistant');
  readonly launcher = input<UiChatLauncher>('floating');
  readonly label = input('Ask the Assistant');
  readonly hint = input('Questions, or help with an application');
  readonly teaser = input('');
  /**
   * Draggable launcher only: show the X drop zone while dragging, and hide the bubble when it is dropped there
   * (`dismissed` fires). Turn it off where the assistant must stay reachable from the page itself.
   */
  readonly dismissible = input(true);

  readonly dismissed = output<void>();
  readonly teaserDismissed = output<void>();
  readonly positionChange = output<UiChatHeadPosition>();

  protected readonly titleId = `ui-chat-title-${++nextWidgetId}`;
  protected readonly chatIcon = AiChat02Icon;
  protected readonly sparkIcon = SparklesIcon;
  protected readonly downIcon = ArrowDown01Icon;
  protected readonly cancelIcon = Cancel01Icon;
  protected readonly infoIcon = InformationCircleIcon;

  protected readonly teaserGone = signal(false);
  protected readonly hidden = signal(false);
  protected readonly dragging = signal(false);

  private readonly headX = signal<number | null>(null);
  private readonly headY = signal<number | null>(null);
  protected readonly head = computed<UiChatHeadPosition>(() => {
    const x = this.headX() ?? (this.position() === 'start' ? 16 : Math.max(16, this.winWidth() - 80));
    const y = this.headY() ?? Math.max(16, this.winHeight() - 80);
    return { x, y };
  });
  protected readonly headOnLeft = computed(() => this.head().x + 32 < this.winWidth() / 2);

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly launch = viewChild<ElementRef<HTMLButtonElement>>('launch');
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  private observer?: MutationObserver;
  private wasOpen = false;
  private start?: { x: number; y: number; hx: number; hy: number; t: number };
  private moved = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (isOpen === this.wasOpen) return;
      this.wasOpen = isOpen;
      if (isOpen) {
        // Opened from elsewhere on the page after the bubble was dismissed: bring the bubble back to its corner,
        // so the panel opens beside a bubble instead of floating where the bubble was dropped.
        if (this.hidden()) {
          this.hidden.set(false);
          this.headX.set(null);
          this.headY.set(null);
        }
        queueMicrotask(() => {
          this.panel()?.nativeElement.focus();
          this.syncObserver();
          const el = this.log()?.nativeElement;
          if (el) el.scrollTop = el.scrollHeight;
        });
      } else {
        this.observer?.disconnect();
        queueMicrotask(() => this.launch()?.nativeElement.focus());
      }
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  protected winWidth(): number {
    return typeof window !== 'undefined' ? window.innerWidth : 1024;
  }

  protected winHeight(): number {
    return typeof window !== 'undefined' ? window.innerHeight : 768;
  }

  /** The bubble's centre is in the upper half of the window, so the panel hangs below it rather than above. */
  protected opensDown(): boolean {
    return this.head().y + 32 < this.winHeight() / 2;
  }

  /**
   * Top edge of the draggable panel: level with the bubble's top when opening down, level with its bottom when
   * opening up, then clamped so the whole panel (as tall as the CSS gives it) stays inside the window.
   */
  protected panelTop(): number {
    const height = Math.min(600, this.winHeight() - 112);
    const y = this.head().y;
    const wanted = this.opensDown() ? y : y + 64 - height;
    return Math.min(Math.max(16, wanted), Math.max(16, this.winHeight() - height - 16));
  }

  private syncObserver(): void {
    const el = this.log()?.nativeElement;
    if (!el || typeof MutationObserver === 'undefined') return;
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => this.autoscroll());
    this.observer.observe(el, { childList: true, subtree: true });
  }

  private autoscroll(): void {
    const el = this.log()?.nativeElement;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      queueMicrotask(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }

  protected setOpen(v: boolean): void {
    this.open.set(v);
  }

  protected escape(): void {
    if (this.open()) this.setOpen(false);
  }

  protected dismissTeaser(): void {
    this.teaserGone.set(true);
    this.teaserDismissed.emit();
  }

  protected launchClick(e: MouseEvent): void {
    if (this.moved) {
      e.preventDefault();
      this.moved = false;
      return;
    }
    this.setOpen(!this.open());
  }

  protected down(e: PointerEvent): void {
    if (this.launcher() !== 'draggable') return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
    const h = this.head();
    this.start = { x: e.clientX, y: e.clientY, hx: h.x, hy: h.y, t: performance.now() };
    this.moved = false;
  }

  protected move(e: PointerEvent): void {
    if (!this.start) return;
    const dx = e.clientX - this.start.x;
    const dy = e.clientY - this.start.y;
    if (Math.hypot(dx, dy) > 5) {
      this.dragging.set(true);
      this.moved = true;
    }
    const maxX = Math.max(16, this.winWidth() - 80);
    const maxY = Math.max(16, this.winHeight() - 80);
    this.headX.set(Math.max(8, Math.min(maxX + 8, this.start.hx + dx)));
    this.headY.set(Math.max(8, Math.min(maxY + 8, this.start.hy + dy)));
  }

  protected up(e: PointerEvent): void {
    if (!this.start) return;
    const h = this.head();
    const w = this.winWidth();
    const ht = this.winHeight();
    if (this.dragging() && this.dismissible() && Math.hypot(h.x + 32 - w / 2, h.y + 32 - (ht - 56)) < 56) {
      this.hidden.set(true);
      this.dismissed.emit();
    } else if (this.dragging()) {
      const velocity = (e.clientX - this.start.x) / Math.max(1, performance.now() - this.start.t);
      const rightEdge = Math.max(16, w - 80);
      const x = Math.abs(velocity) > 0.5 ? (velocity < 0 ? 16 : rightEdge) : h.x + 32 < w / 2 ? 16 : rightEdge;
      const y = Math.max(16, Math.min(Math.max(16, ht - 80), h.y));
      this.headX.set(x);
      this.headY.set(y);
      this.positionChange.emit({ x, y });
    }
    this.dragging.set(false);
    this.start = undefined;
  }

  protected launcherKey(e: KeyboardEvent): void {
    if (this.launcher() !== 'draggable' || !e.altKey || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    const h = this.head();
    const rightEdge = Math.max(16, this.winWidth() - 80);
    const bottomEdge = Math.max(16, this.winHeight() - 80);
    const x = e.key === 'ArrowLeft' ? 16 : e.key === 'ArrowRight' ? rightEdge : h.x;
    const y = e.key === 'ArrowUp' ? 16 : e.key === 'ArrowDown' ? bottomEdge : h.y;
    this.headX.set(x);
    this.headY.set(y);
    this.positionChange.emit({ x, y });
  }
}
