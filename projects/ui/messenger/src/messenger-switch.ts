import { Component, ElementRef, computed, inject, input, model, output, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import { injectUiStrings, uiFormatString } from '@zouriel/ui';
import { UI_MESSENGER_BRANDS, type UiMessengerApp } from './messenger-brand';
import { UiMessengerLogo } from './messenger-logo';

let nextId = 0;

/** A horizontal touch move at least this long (and more sideways than up/down) is a swipe. */
export const UI_MESSENGER_SWIPE_MIN = 40;

/**
 * `ui-messenger-switch` — a "Send next" button that is also a channel switch: the chosen app's logo
 * and brand colour on a pill with the words (`label`, default "Send next on WhatsApp") and a second
 * line (`sublabel`, e.g. "Next: Aisha"). The host changes channel by swiping the pill sideways
 * (touch; swipe left for the next app), with the chevrons on both sides, with the arrow keys
 * (Home/End: first/last), or by tapping one of the small logos under it, which show the choice.
 * Tapping the pill emits `(pressed)` with the app. `disabled` turns off the pill only (e.g. everyone
 * on that channel has been sent to): switching still works.
 *
 * Centred in its container, at most 360px wide. Words in the brand's dark ink (AA, as on
 * `ui-messenger-button`); the logo unaltered. The new channel slides in from the side it comes from
 * (none with reduced motion). Twin of Flutter's `UiMessengerSwitch`.
 */
@Component({
  selector: 'ui-messenger-switch',
  imports: [HugeiconsIconComponent, UiMessengerLogo],
  host: { class: 'ui-messenger-switch' },
  template: `
    <div class="row">
      <button type="button" class="nav" [disabled]="apps().length < 2" [attr.aria-label]="strings.messengerPrevChannel" (click)="step(-1)">
        <hugeicons-icon [icon]="prevIcon" [size]="20" [strokeWidth]="1.8" aria-hidden="true" />
      </button>
      <button #pill type="button" class="pill" [attr.data-app]="value()"
        [style.--m-top]="brand().fill[0]" [style.--m-bottom]="brand().fill[1]" [style.--m-ink]="brand().ink"
        [style.--m-logo]="brand().logoSize + 2 + 'px'"
        [attr.aria-disabled]="disabled() || null" [attr.aria-label]="name()" [attr.aria-describedby]="hintId"
        (click)="press()" (keydown)="key($event)"
        (touchstart)="touchStart($event)" (touchmove)="touchMove($event)" (touchend)="touchEnd($event)" (touchcancel)="swipe = null">
        @for (a of [shown()]; track a.key) {
          <span class="content" [class.from-next]="a.from === 1" [class.from-prev]="a.from === -1">
            <ui-messenger-logo [app]="a.app" [size]="brand().logoSize + 2" />
            <span class="text">
              <span class="label">{{ labelText() }}</span>
              @if (sublabel()) { <span class="sub">{{ sublabel() }}</span> }
            </span>
          </span>
        }
      </button>
      <button type="button" class="nav" [disabled]="apps().length < 2" [attr.aria-label]="strings.messengerNextChannel" (click)="step(1)">
        <hugeicons-icon [icon]="nextIcon" [size]="20" [strokeWidth]="1.8" aria-hidden="true" />
      </button>
    </div>
    <span class="vh" [id]="hintId">{{ strings.messengerSwitchHint }}</span>
    <div class="dots" role="radiogroup" [attr.aria-label]="strings.messengerChannel" (keydown)="key($event)">
      @for (a of apps(); track a) {
        <button type="button" class="dot" role="radio" [attr.data-app]="a" [attr.aria-checked]="a === value()"
          [attr.aria-label]="nameOf(a)" [tabIndex]="a === value() ? 0 : -1" (click)="choose(a, 0)">
          <span class="disc" [style.background]="'linear-gradient(' + fillOf(a)[0] + ', ' + fillOf(a)[1] + ')'">
            <ui-messenger-logo [app]="a" [size]="a === 'telegram' ? 20 : 13" />
          </span>
        </button>
      }
    </div>
  `,
  styles: `
    :host { --ui-messenger-veil: #FFFFFF; display: block; width: 100%; max-width: 360px; margin-inline: auto; font-family: var(--ui-font-default); }
    .row { display: flex; align-items: center; gap: var(--ui-space-1); }
    .nav {
      flex: none; display: grid; place-items: center; width: var(--ui-size-touch); height: var(--ui-size-touch);
      margin: 0; padding: 0; border: none; border-radius: var(--ui-radius-pill); background: transparent;
      color: var(--ui-color-text-muted); cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .nav:hover:not(:disabled) { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .nav:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .nav:disabled { opacity: .4; cursor: default; }
    .nav hugeicons-icon { display: block; line-height: 0; }
    :host-context([dir="rtl"]) .nav hugeicons-icon { transform: scaleX(-1); }
    /* The pill: the brand fill (Telegram's gradient laid over its logo's band, as on ui-messenger-button). */
    .pill {
      position: relative; flex: 1 1 auto; min-width: 0; box-sizing: border-box; min-height: 52px;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
      margin: 0; padding: var(--ui-space-1) var(--ui-space-4); border: none; border-radius: var(--ui-radius-pill);
      background-color: var(--m-bottom);
      background-image: linear-gradient(var(--m-top) calc(50% - var(--m-logo) / 2), var(--m-bottom) calc(50% + var(--m-logo) / 2));
      color: var(--m-ink); cursor: pointer; touch-action: pan-y; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none;
      user-select: none; -webkit-user-select: none;
      transition: background-color var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .pill::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--ui-messenger-veil); opacity: 0; pointer-events: none;
      transition: opacity var(--ui-motion-fast) var(--ui-ease-standard); }
    .pill:hover:not([aria-disabled])::after { opacity: 0.1; }
    .pill:active:not([aria-disabled])::after { opacity: 0.18; }
    .pill:active:not([aria-disabled]) { transform: scale(var(--ui-scale-press)); }
    .pill:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .pill[aria-disabled] { opacity: .5; cursor: not-allowed; }
    .content { position: relative; z-index: 1; display: flex; align-items: center; gap: var(--ui-space-2); min-width: 0; }
    .content.from-next { animation: ui-mswitch-from-next var(--ui-motion-base) var(--ui-ease-decelerate); }
    .content.from-prev { animation: ui-mswitch-from-prev var(--ui-motion-base) var(--ui-ease-decelerate); }
    @keyframes ui-mswitch-from-next { from { opacity: 0; transform: translateX(16px); } }
    @keyframes ui-mswitch-from-prev { from { opacity: 0; transform: translateX(-16px); } }
    .text { display: flex; flex-direction: column; min-width: 0; text-align: start; }
    /* The words may take two lines on a phone rather than lose the app's name; the sub-line one. */
    .label { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; text-wrap: balance; overflow-wrap: anywhere; }
    .sub { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label { font-size: var(--ui-font-size-md); font-weight: 600; line-height: 20px; }
    .sub { font-size: var(--ui-font-size-sm); font-weight: 500; line-height: 16px; }
    .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .dots { display: flex; justify-content: center; gap: var(--ui-space-2); margin-top: var(--ui-space-2); }
    .dot {
      display: grid; place-items: center; width: 28px; height: 28px; margin: 0; padding: 0; border: none;
      border-radius: var(--ui-radius-pill); background: transparent; cursor: pointer; opacity: .45;
      transition: opacity var(--ui-motion-fast) var(--ui-ease-standard), box-shadow var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .dot:hover { opacity: .8; }
    .dot[aria-checked="true"] { opacity: 1; box-shadow: inset 0 0 0 2px var(--ui-color-text); }
    .dot:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .disc { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; overflow: hidden; }
    @media (prefers-reduced-motion: reduce) {
      .content.from-next, .content.from-prev { animation: none; }
      .pill, .pill::after, .nav, .dot { transition: none; }
    }
  `,
})
export class UiMessengerSwitch {
  /** The channels, in order. */
  apps = input<UiMessengerApp[]>(['whatsapp', 'viber', 'telegram']);
  /** The chosen channel (two-way: `[(value)]`). */
  value = model<UiMessengerApp>('whatsapp');
  /** The words; default "Send next on <app>". */
  label = input<string>();
  /** The second line, e.g. "Next: Aisha". */
  sublabel = input<string>();
  /** Turns off the pill (not the switching). */
  disabled = input(false);
  /** The pill was tapped: send on this channel. */
  readonly pressed = output<UiMessengerApp>();

  protected readonly strings = injectUiStrings();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly prevIcon = ArrowLeft01Icon;
  protected readonly nextIcon = ArrowRight01Icon;
  protected readonly hintId = `ui-mswitch-hint-${nextId++}`;
  protected readonly brand = computed(() => UI_MESSENGER_BRANDS[this.value()]);
  protected readonly labelText = computed(() => this.label() || uiFormatString(this.strings.messengerSendNext, { app: this.brand().name }));
  protected readonly name = computed(() => (this.sublabel() ? `${this.labelText()}, ${this.sublabel()}` : this.labelText()));
  /** The content shown, keyed so a change re-creates it (and runs its slide-in). */
  private readonly from = signal(0);
  private seq = 0;
  protected readonly shown = computed(() => ({ app: this.value(), from: this.from(), key: `${this.value()}-${this.seq++}` }));
  protected swipe: { x: number; y: number; moved: boolean } | null = null;
  private swiped = false;

  protected nameOf(a: UiMessengerApp): string {
    return UI_MESSENGER_BRANDS[a].name;
  }
  protected fillOf(a: UiMessengerApp): readonly [string, string] {
    return UI_MESSENGER_BRANDS[a].fill;
  }

  /** Moves `by` places through `apps`, wrapping round. */
  step(by: number): void {
    const list = this.apps();
    if (list.length < 2) return;
    const i = Math.max(0, list.indexOf(this.value()));
    this.choose(list[(i + by + list.length) % list.length], by);
  }

  protected choose(a: UiMessengerApp, from: number): void {
    if (a === this.value()) return;
    this.from.set(from || Math.sign(this.apps().indexOf(a) - this.apps().indexOf(this.value())));
    this.value.set(a);
  }

  private get rtl(): boolean {
    return typeof getComputedStyle === 'function' && getComputedStyle(this.host).direction === 'rtl';
  }

  protected key(e: KeyboardEvent): void {
    const fwd = this.rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = this.rtl ? 'ArrowRight' : 'ArrowLeft';
    const list = this.apps();
    let handled = true;
    if (e.key === fwd || e.key === 'ArrowDown') this.step(1);
    else if (e.key === back || e.key === 'ArrowUp') this.step(-1);
    else if (e.key === 'Home') this.choose(list[0], -1);
    else if (e.key === 'End') this.choose(list[list.length - 1], 1);
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    // Keys on the dots move the focus with the choice (roving tabindex).
    if ((e.target as HTMLElement).classList?.contains('dot')) {
      queueMicrotask(() => this.host.querySelector<HTMLElement>(`.dot[data-app="${this.value()}"]`)?.focus());
    }
  }

  protected press(): void {
    if (this.swiped) {
      this.swiped = false;
      return;
    }
    if (!this.disabled()) this.pressed.emit(this.value());
  }

  protected touchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) {
      this.swipe = null;
      return;
    }
    this.swiped = false;
    this.swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false };
  }

  protected touchMove(e: TouchEvent): void {
    const t = e.touches[0];
    if (!this.swipe || !t) return;
    const dx = t.clientX - this.swipe.x;
    const dy = t.clientY - this.swipe.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) this.swipe.moved = true;
  }

  protected touchEnd(e: TouchEvent): void {
    const start = this.swipe;
    this.swipe = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) >= UI_MESSENGER_SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
      // Finger to the left: the next app comes in from the right (mirrored in RTL).
      const next = dx < 0 !== this.rtl;
      this.step(next ? 1 : -1);
      this.swiped = true;
      if (e.cancelable) e.preventDefault();
      setTimeout(() => (this.swiped = false), 600);
    } else if (start.moved) {
      this.swiped = true;
      setTimeout(() => (this.swiped = false), 600);
    }
  }
}
