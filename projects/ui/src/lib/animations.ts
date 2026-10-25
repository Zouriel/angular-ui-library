/**
 * Typed handles for the shared animation classes defined in
 * `@zouriel/ui/styles/animations.css`. Use these with Angular's modern CSS enter/leave
 * bindings so durations/easings stay token-driven and reduced-motion-safe:
 *
 *   import { UI_ANIM } from '@zouriel/ui';
 *   protected readonly anim = UI_ANIM;
 *   <div [animate.enter]="anim.scale.enter" [animate.leave]="anim.scale.leave">
 *
 * Under prefers-reduced-motion the moving variants fall back to a plain fade, and
 * `provideUiConfig({ animations: false })` turns them all off.
 */
export const UI_ANIM = {
  fade: { enter: 'ui-fade-enter', leave: 'ui-fade-leave' },
  scale: { enter: 'ui-scale-enter', leave: 'ui-scale-leave' },
  slideUp: { enter: 'ui-slide-up-enter', leave: 'ui-slide-up-leave' },
  slideDown: { enter: 'ui-slide-down-enter', leave: 'ui-slide-down-leave' },
  slideLeft: { enter: 'ui-slide-left-enter', leave: 'ui-slide-left-leave' },
  slideRight: { enter: 'ui-slide-right-enter', leave: 'ui-slide-right-leave' },
  /** In from / out to the inline start or end edge: mirrors under dir="rtl" (0.46.0). */
  slideFromStart: { enter: 'ui-slide-from-start-enter', leave: 'ui-slide-from-start-leave' },
  slideFromEnd: { enter: 'ui-slide-from-end-enter', leave: 'ui-slide-from-end-leave' },
  sheet: { enter: 'ui-sheet-enter', leave: 'ui-sheet-leave' },
  backdrop: { enter: 'ui-backdrop-enter', leave: 'ui-backdrop-leave' },
  window: { enter: 'ui-window-open-enter', leave: 'ui-window-close-leave', dock: 'ui-window-dock' },
} as const;

/** Seconds or milliseconds from a computed `animation-duration` / `-delay` list, the longest one. */
function longestMs(value: string): number {
  return Math.max(0, ...value.split(',').map((v) => (v.trim().endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000) || 0));
}

/**
 * An `(animate.leave)` handler that plays [leaveClass] and then keeps the element invisible until
 * Angular removes it.
 *
 * A backdrop shares its dialog's layer, and the layer goes only when its longest leave animation
 * ends. With the class form (`animate.leave="ui-backdrop-leave"`) Angular drops the class as soon as
 * the backdrop's own, shorter fade ends, so a backdrop that was already invisible snapped back to
 * the full overlay for a frame or two before the panel finished. Use this form instead:
 *
 *   protected readonly backdropLeave = uiLeaveHidden(UI_ANIM.backdrop.leave);
 *   <div class="backdrop" animate.enter="ui-backdrop-enter" (animate.leave)="backdropLeave($event)"></div>
 *
 * With animations off (reduced to nothing, `animations: false`, or a test DOM) it hides at once.
 */
export function uiLeaveHidden(leaveClass: string): (event: { target: Element; animationComplete: () => void }) => void {
  return ({ target, animationComplete }) => {
    const el = target as HTMLElement;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onEnd = (e: Event) => {
      if (e.target === el) finish();
    };
    const finish = () => {
      if (done) return;
      done = true;
      el.style.opacity = '0';
      el.removeEventListener('animationend', onEnd);
      el.removeEventListener('animationcancel', onEnd);
      if (timer) clearTimeout(timer);
      animationComplete();
    };
    el.classList.add(leaveClass);
    const view = el.ownerDocument?.defaultView;
    const style = view?.getComputedStyle(el);
    const ms = style ? longestMs(style.animationDuration || '0s') + longestMs(style.animationDelay || '0s') : 0;
    if (!style || !style.animationName || style.animationName === 'none' || ms === 0) {
      finish();
      return;
    }
    el.addEventListener('animationend', onEnd);
    el.addEventListener('animationcancel', onEnd);
    // A safety net: some browsers skip animationend for a tab in the background.
    timer = setTimeout(finish, ms + 50);
  };
}
