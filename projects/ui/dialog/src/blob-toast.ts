import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, computed, effect, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';
import { UiBlobSpring, uiBlobPath } from './blob-shape';
import type { UiToast } from './toast';

/** Corner radius of the card and of the concave join between the tab and the card, in px. */
const RADIUS = 20;
const FILLET = 14;
/** The pill shows alone for this long before the card grows out of it. */
const OPEN_DELAY = 360;
/** After a change of state: the pill shows its new title and colour for this long, then reopens. */
const REOPEN_DELAY = 180;

/** Whether a blob toast has anything to put in the card under its pill. */
export function uiBlobToastHasBody(t: Pick<UiToast, 'title' | 'message' | 'action' | 'content'>): boolean {
  return (!!t.title && !!t.message) || !!t.action || !!t.content;
}

/**
 * One toast drawn as a blob (`variant: 'blob'`): a pill with the tone's icon and the title, which
 * grows a card beneath it for the message, custom content and the action, as one shape. Rendered by
 * `ui-toast-host`; apps go through `UiToastService` (`blob`, `update`, `promise`).
 *
 * A change to the toast (`service.update`) closes the card back to the pill, swaps the title and
 * colour there, and opens it again.
 *
 * With `expanded` false the card stays closed until the pointer or focus is on the toast, or its pill
 * is clicked (a tap on a touch screen); the host does this when several blob toasts are showing.
 * Clicking the pill of an open toast, or of one with no card, dismisses it.
 */
@Component({
  selector: 'ui-blob-toast',
  imports: [NgTemplateOutlet],
  template: `
    @let t = shown();
    @if (t) {
      <div #root class="blob" [class.live]="open()" (mouseenter)="hover(true)" (mouseleave)="hover(false)"
           (focusin)="focus(true)" (focusout)="focus(false)" [attr.data-tone]="t.loading ? 'loading' : t.tone" [attr.data-side]="side()"
           [attr.role]="!t.loading && (t.tone === 'danger' || t.tone === 'warning') ? 'alert' : 'status'">
        <svg class="shape" aria-hidden="true" focusable="false"><path #path /></svg>
        <button #pill class="pill" type="button" [attr.title]="canOpen() ? null : strings.dismiss"
                [attr.aria-expanded]="hasBody() ? open() : null" (click)="pillClick()">
          @for (r of [rev()]; track r) {
            <span class="badge" aria-hidden="true">
              @if (t.loading) {
                <span class="spin"></span>
              } @else {
                <svg viewBox="0 0 24 24" width="12" height="12">
                  @switch (t.tone) {
                    @case ('success') { <path d="M5 12.5l4.5 4.5L19 7.5" /> }
                    @case ('danger') { <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /> }
                    @case ('warning') { <path d="M12 5v8.5M12 18.5v.01" /> }
                    @default { <path d="M12 10.5V19M12 5.5v.01" /> }
                  }
                </svg>
              }
            </span>
            <span class="title">{{ t.title || t.message }}</span>
          }
        </button>
        <div #clip class="body" [attr.inert]="open() ? null : ''">
          <div #bodyIn class="body-in">
            @if (t.title && t.message) { <p class="msg">{{ t.message }}</p> }
            @if (t.content) {
              <div class="custom"><ng-container [ngTemplateOutlet]="t.content" [ngTemplateOutletContext]="{ $implicit: t }" /></div>
            }
            @if (t.action) {
              <button class="act" type="button" (click)="act.emit()">{{ t.action.label }}</button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; pointer-events: none; }
    .blob {
      /* The inverted surface the snackbar uses: near-black on a light theme, near-white on a dark one. */
      --_bg: var(--ui-color-text);
      --_fg: color-mix(in srgb, var(--ui-color-bg) 70%, var(--ui-color-text));
      --_hue: var(--ui-color-info);
      /* The tone, moved most of the way to the page's lightness so it reads on the inverted surface. */
      --ui-toast-tone: color-mix(in srgb, var(--_hue) 40%, var(--ui-color-bg));
      --_blur: 0px;
      position: relative; box-sizing: border-box; width: min(340px, 100%); min-height: var(--ui-size-lg);
      display: flex; justify-content: center;
      color: var(--ui-toast-tone);
      font-family: var(--ui-toast-font, var(--ui-font-default)); font-size: var(--ui-font-size-sm); line-height: 1.45;
    }
    /* Same hue and strength of colour as the tone, at a lightness 80% of the way to the page's, which
       keeps it readable on the surface and on the action's tint in every theme (the Flutter twin's
       uiBlobTone does the same sum, and its test checks the contrast per theme). */
    @supports (color: oklch(from red l c h)) {
      .blob {
        --ui-toast-tone: oklch(from color-mix(in oklab, var(--_hue) 20%, oklch(from var(--ui-color-bg) l 0 h)) l calc(c * 5) h);
      }
    }
    .blob[data-tone="success"] { --_hue: var(--ui-color-success); }
    .blob[data-tone="warning"] { --_hue: var(--ui-color-warning); }
    .blob[data-tone="danger"]  { --_hue: var(--ui-color-danger); }
    .blob[data-tone="loading"] { --ui-toast-tone: var(--_fg); }
    /* While open the whole box holds the pointer, so the card keeps it as it grows under the pill. */
    .blob.live { pointer-events: auto; }
    .blob[data-side="left"]   { margin-right: auto; justify-content: flex-start; }
    .blob[data-side="right"]  { margin-left: auto; justify-content: flex-end; }
    .blob[data-side="center"] { margin-inline: auto; }

    .shape {
      position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible;
      fill: var(--_bg); filter: blur(var(--_blur)) drop-shadow(var(--ui-shadow-2));
    }

    .pill {
      position: relative; box-sizing: border-box; pointer-events: auto;
      display: inline-flex; align-items: center; gap: var(--ui-space-2);
      height: var(--ui-size-lg); max-width: calc(100% - 72px);
      padding: 0 var(--ui-space-4) 0 var(--ui-space-2); margin: 0;
      border: none; border-radius: var(--ui-radius-pill); background: transparent;
      color: inherit; font: inherit; font-weight: 600; text-align: start; cursor: pointer;
      transition: color var(--ui-motion-base) var(--ui-ease-standard);
    }
    .pill:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .badge {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; border-radius: 50%;
      background: color-mix(in srgb, var(--ui-toast-tone) 20%, var(--_bg));
      animation: tb-in var(--ui-motion-slow) var(--ui-ease-decelerate) both;
    }
    .badge svg { display: block; fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .spin {
      box-sizing: border-box; width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid color-mix(in srgb, currentColor 28%, transparent); border-top-color: currentColor;
      animation: tb-spin 0.8s linear infinite;
    }
    .title {
      min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
      animation: tb-in var(--ui-motion-slow) var(--ui-ease-decelerate) both;
    }

    .body { position: absolute; top: 0; left: 0; right: 0; padding-top: var(--ui-size-lg); opacity: 0; pointer-events: auto; }
    .body[inert] { pointer-events: none; }
    .body-in {
      display: flex; flex-direction: column; gap: var(--ui-space-3);
      padding: var(--ui-space-4);
      filter: blur(var(--_blur));
    }
    .body-in:empty { display: none; }
    .msg { margin: 0; color: var(--_fg); overflow-wrap: anywhere; }
    .custom { color: var(--_fg); min-width: 0; }
    .act {
      box-sizing: border-box; width: 100%; min-height: var(--ui-size-lg); padding: 0 var(--ui-space-4);
      border: none; border-radius: var(--ui-radius-pill);
      background: color-mix(in srgb, var(--ui-toast-tone) 16%, var(--_bg)); color: var(--ui-toast-tone);
      font: inherit; font-weight: 600; cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .act:hover { background: color-mix(in srgb, var(--ui-toast-tone) 26%, var(--_bg)); }
    .act:active { transform: scale(var(--ui-scale-press)); }
    .act:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }

    @keyframes tb-in { from { opacity: 0; filter: blur(4px); } to { opacity: 1; filter: blur(0); } }
    @keyframes tb-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .shape { filter: drop-shadow(var(--ui-shadow-2)); }
      .body-in { filter: none; }
      .badge, .title { animation-name: ui-fade-in; }
    }
  `,
})
export class UiBlobToast {
  protected readonly strings = injectUiStrings();
  /** The toast to show. A new object for the same toast replays the close, swap, open sequence. */
  toast = input.required<UiToast>();
  /** Where the pill sits over the card, and which side of the stack the toast keeps to. */
  side = input<'left' | 'center' | 'right'>('center');
  /** Whether the card opens by itself. When false it opens on hover, focus, or a click on the pill. */
  expanded = input(true);
  dismiss = output<void>();
  act = output<void>();

  /** What is drawn now; it trails `toast` while the card closes for a swap. */
  protected readonly shown = signal<UiToast | null>(null);
  /** Bumped on each swap, so the icon and title are re-created and fade in again. */
  protected readonly rev = signal(0);
  protected readonly open = signal(false);
  protected readonly hasBody = computed(() => { const t = this.shown(); return !!t && uiBlobToastHasBody(t); });
  private readonly hovered = signal(false);
  private readonly focused = signal(false);
  /** Opened by a click on the pill; holds until the toast changes. */
  private readonly pinned = signal(false);
  private readonly wantsOpen = computed(() => this.hasBody() && (this.expanded() || this.hovered() || this.focused() || this.pinned()));
  /** A click on the pill opens the card rather than dismissing. */
  protected readonly canOpen = computed(() => this.hasBody() && !this.open());

  private readonly root = viewChild<ElementRef<HTMLElement>>('root');
  private readonly path = viewChild<ElementRef<SVGPathElement>>('path');
  private readonly pill = viewChild<ElementRef<HTMLElement>>('pill');
  private readonly clip = viewChild<ElementRef<HTMLElement>>('clip');
  private readonly bodyIn = viewChild<ElementRef<HTMLElement>>('bodyIn');

  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly spring = new UiBlobSpring();
  private pending: UiToast | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private frame = 0;
  private lastFrame = 0;
  private width = 0;
  private pillHeight = 0;
  private pillWidth = 0;
  private pillTarget = 0;
  private bodyHeight = 0;
  private observer: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const t = this.toast();
      untracked(() => this.receive(t));
    });
    effect(() => {
      this.side();
      untracked(() => this.redraw());
    });
    effect(() => {
      this.wantsOpen();
      // Not during the first wait or a swap: those end in reopen(), which reads it then.
      untracked(() => { if (this.started && !this.pending && !this.timer) this.reopen(); });
    });
    afterNextRender(() => {
      if (typeof ResizeObserver === 'function') {
        this.observer = new ResizeObserver(() => this.redraw());
        for (const ref of [this.root(), this.pill(), this.bodyIn()]) if (ref) this.observer.observe(ref.nativeElement);
      }
      this.redraw();
    });
    inject(DestroyRef).onDestroy(() => {
      this.observer?.disconnect();
      if (this.timer) clearTimeout(this.timer);
      if (this.frame) cancelAnimationFrame(this.frame);
    });
  }

  protected hover(on: boolean): void { this.hovered.set(on); }
  protected focus(on: boolean): void { this.focused.set(on); }

  protected pillClick(): void {
    if (this.canOpen()) this.pinned.set(true);
    else this.dismiss.emit();
  }

  private started = false;

  private receive(t: UiToast): void {
    if (!this.shown()) {
      this.shown.set(t);
      this.later(() => { this.started = true; this.reopen(); }, OPEN_DELAY);
      return;
    }
    this.pending = t;
    if (this.spring.target > 0 || this.spring.value > 0) {
      // Close to the pill first; tick() swaps when it gets there.
      this.spring.target = 0;
      this.open.set(false);
      this.run();
    } else {
      this.swap();
    }
  }

  private swap(): void {
    const t = this.pending;
    if (!t) return;
    this.pending = null;
    this.pinned.set(false);
    this.shown.set(t);
    this.rev.update((n) => n + 1);
    this.later(() => this.reopen(), REOPEN_DELAY);
  }

  private reopen(): void {
    if (this.pending) return;
    this.measure();
    this.spring.target = this.wantsOpen() ? 1 : 0;
    this.open.set(this.spring.target > 0);
    this.run();
  }

  private later(fn: () => void, ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; fn(); }, ms);
  }

  private redraw(): void {
    this.measure();
    this.draw();
    this.run();
  }

  private measure(): void {
    const root = this.root()?.nativeElement;
    const pill = this.pill()?.nativeElement;
    if (!root || !pill) return;
    this.width = root.clientWidth;
    this.pillHeight = pill.offsetHeight;
    this.pillTarget = pill.offsetWidth;
    if (!this.pillWidth) this.pillWidth = this.pillTarget;
    this.bodyHeight = this.bodyIn()?.nativeElement.offsetHeight ?? 0;
  }

  private run(): void {
    if (!this.browser || this.frame) return;
    if (typeof requestAnimationFrame !== 'function') {
      // No frames to animate on (a test DOM): land at once.
      this.spring.value = this.spring.target;
      this.spring.velocity = 0;
      this.pillWidth = this.pillTarget;
      this.draw();
      if (this.pending && this.spring.value === 0) this.swap();
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    const dt = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60;
    this.lastFrame = now;
    this.spring.step(dt);
    const gap = this.pillTarget - this.pillWidth;
    this.pillWidth = Math.abs(gap) < 0.4 ? this.pillTarget : this.pillWidth + gap * (1 - Math.exp(-dt * 16));
    this.draw();
    if (this.spring.resting && this.pillWidth === this.pillTarget) {
      this.frame = 0;
      this.lastFrame = 0;
      if (this.pending && this.spring.value === 0) this.swap();
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private draw(): void {
    const root = this.root()?.nativeElement;
    const path = this.path()?.nativeElement;
    const clip = this.clip()?.nativeElement;
    if (!root || !path || !clip || this.width <= 0 || this.pillHeight <= 0) return;
    const p = this.spring.value;
    const pc = Math.min(1, p);
    const d = uiBlobPath({
      width: this.width, pillWidth: this.pillWidth, pillHeight: this.pillHeight, bodyHeight: this.bodyHeight,
      align: this.side(), progress: p, radius: RADIUS, fillet: FILLET,
    });
    path.setAttribute('d', d);
    root.style.height = `${this.pillHeight + this.bodyHeight * pc}px`;
    clip.style.clipPath = `path("${d}")`;
    clip.style.opacity = String(Math.max(0, Math.min(1, (pc - 0.45) / 0.55)));
    // Soft while it moves, sharp at rest: the shape and text blur in the middle of a transition.
    root.style.setProperty('--_blur', `${(3.5 * Math.sin(Math.PI * pc)).toFixed(2)}px`);
  }
}
