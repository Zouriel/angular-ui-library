import { Component, computed, signal } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';
import { UiBadge } from '@zouriel/ui/badge';
import { UiCopyToClipboard, UiRipple, UiInfiniteScroll, UiIntersect, UiResizeObserver, UiSwipe, UiVirtualList, type UiSize2D } from '@zouriel/ui/behaviors';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-behaviors',
  imports: [
    UiButton, UiBadge, UiCopyToClipboard, UiRipple, UiInfiniteScroll, UiIntersect, UiResizeObserver, UiSwipe, UiVirtualList,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Motion" title="Behavior directives"
      lead="Interaction primitives from @zouriel/ui/behaviors, attached to any element, plus a virtual list. The last section points to uiClickOutside (from @zouriel/ui/overlay) and CDK focus trapping, which the overlay components use.">

      <doc-section name="copyToClipboard" selector="[uiCopyToClipboard]" [api]="copyApi" [outputs]="copyOut"
        summary="Copies the bound text on click. For 1.5s after a copy, the copied() signal (exportAs 'uiCopy') is true and the host carries data-copied. The result is also announced to screen readers through a polite live region, including a hint to copy by hand when the clipboard refuses.">
        <doc-demo code="<button [uiCopyToClipboard]=&quot;'npm i ui'&quot; #c=&quot;uiCopy&quot;>
  {{ '{{' }} c.copied() ? 'Copied!' : 'Copy' {{ '}}' }}
</button>">
          <!-- Both labels share one grid cell, so the button keeps the wider one's width when the text swaps. -->
          <ui-button variant="outline" [uiCopyToClipboard]="'npm i ui'" #c="uiCopy">
            <span class="swap"><span [class.off]="c.copied()">Copy "npm i ui"</span><span [class.off]="!c.copied()">Copied!</span></span>
          </ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="ripple" selector="[uiRipple]" [api]="rippleApi"
        summary="A ripple that spreads from the pointer on press (pointerdown, so mouse, pen and touch; a keyboard press shows none). Skipped under prefers-reduced-motion. Sets position: relative and overflow: hidden on the host, so put it on an element whose corners should clip the ripple.">
        <doc-demo code="<ui-button uiRipple uiRippleColor=&quot;var(--ui-color-primary-contrast)&quot;>Press me</ui-button>">
          <ui-button class="ripple-host" uiRipple uiRippleColor="var(--ui-color-primary-contrast)">Press me</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="swipe" selector="[uiSwipe]" [api]="swipeApi" [outputs]="swipeOut"
        summary="Reports a sideways swipe across the host, e.g. to move between tabs or screens. It reads touch events for fingers, pointer events for a pen, and mouse drags only with uiSwipeMouse. It fires while the finger is still moving, as soon as the drag qualifies, and stays out of the way of everything else: mostly vertical drags, a second finger, gestures starting within 24px of the screen edge (the browser's back gesture), anything under the finger that scrolls sideways, and fields, editable text and draggable elements. Mark any subtree data-no-swipe to opt it out. It never calls preventDefault, so the page still scrolls under the same finger.">
        <doc-demo code="<main uiSwipe (uiSwipeLeft)=&quot;next()&quot; (uiSwipeRight)=&quot;previous()&quot;>…</main>">
          <div class="swipe" uiSwipe [uiSwipeMouse]="true" (uiSwipeLeft)="page.set(Math.min(page() + 1, 3))" (uiSwipeRight)="page.set(Math.max(page() - 1, 0))">
            <strong>{{ swipePages[page()] }}</strong>
            <span>Swipe left or right (with a mouse here too). Screen {{ page() + 1 }} of 4.</span>
          </div>
        </doc-demo>
        <doc-demo lang="ts" code="import { isSwipe, resist, SWIPE_MIN, SWIPE_MAX, FLICK_SPEED } from '@zouriel/ui/behaviors';

if (isSwipe(dx, dy, ms, stageWidth)) next();     // the same thresholds the viewers use
el.style.translate = resist(dx, stageWidth, atEnd) + 'px 0';  // rubber-band at the ends">
          <p class="plain">The thresholds live in one place, so the image viewer, the lightbox and uiSwipe all agree on what a swipe is: far enough (a fifth of the width, 32–72px) or a quick flick, and never mostly vertical.</p>
        </doc-demo>
      </doc-section>

      <doc-section name="intersect" selector="[uiIntersect]" [api]="intersectApi" [outputs]="intersectOut"
        summary="Emits true when the host enters the viewport and false when it leaves (the first report can be false if it starts out of view). With uiIntersectOnce it stops observing after the first true. The root margin is read once, on init.">
        <doc-demo code="<div (uiIntersect)=&quot;onVisible($event)&quot; [uiIntersectOnce]=&quot;true&quot;>…</div>">
          <ui-badge [tone]="vis() ? 'success' : 'neutral'" (uiIntersect)="vis.set($event)">{{ vis() ? 'in view' : 'out of view' }}</ui-badge>
        </doc-demo>
      </doc-section>

      <doc-section name="infiniteScroll" selector="[uiInfiniteScroll]" [api]="infApi" [outputs]="infOut"
        summary="Put it on the scrolling element itself (it needs a height and overflow: auto). Emits (scrolledToEnd) once when a scroll brings the host within threshold px of the bottom, and again only after it has been scrolled back above that line. It reacts to scroll events, so content shorter than the box never triggers it.">
        <doc-demo code="<div uiInfiniteScroll [uiInfiniteScrollThreshold]=&quot;120&quot; (scrolledToEnd)=&quot;loadMore()&quot;>…</div>">
          <div class="inf" uiInfiniteScroll (scrolledToEnd)="loadMore()">
            @for (n of items(); track n) { <div class="ln">Item {{ n }}</div> }
            <div class="ln muted">scroll for more… ({{ items().length }})</div>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="virtual-list" selector="ui-virtual-list" [api]="vlApi"
        summary="Renders only the visible slice of a large list with CDK virtual scroll. Provide the row template as a child ng-template let-item. Every row is exactly itemSize px tall, so use it for fixed-height rows.">
        <doc-demo code="<ui-virtual-list [items]=&quot;rows&quot; [itemSize]=&quot;32&quot; height=&quot;200px&quot;>
  <ng-template let-item>{{ '{{' }} item {{ '}}' }}</ng-template>
</ui-virtual-list>">
          <ui-virtual-list [items]="big" [itemSize]="30" height="160px">
            <ng-template let-item>Row #{{ item }}</ng-template>
          </ui-virtual-list>
        </doc-demo>
      </doc-section>

      <doc-section name="resizeObserver" selector="[uiResizeObserver]" [outputs]="roOut"
        summary="Emits the host's content-box size (UiSize2D, in px) when it is first observed and whenever it changes."
        [shapes]="'interface UiSize2D { width: number; height: number; }'">
        <doc-demo code="<div (uiResizeObserver)=&quot;size.set($event)&quot;>…</div>">
          <div class="ro" (uiResizeObserver)="roSize.set($event)">{{ roLabel() }}</div>
        </doc-demo>
      </doc-section>

      <doc-section name="clickOutside & focusTrap" selector="[uiClickOutside] · CDK cdkTrapFocus"
        summary="uiClickOutside, from @zouriel/ui/overlay, emits the PointerEvent when a pointerdown lands outside the host; popovers and menus use it to dismiss. Focus trapping in ui-modal and ui-drawer uses the CDK's cdkTrapFocus from @angular/cdk/a11y; there is no separate wrapper.">
        <doc-demo code="<div (uiClickOutside)=&quot;close()&quot;>…</div>"></doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .ro { width: 260px; max-width: 100%; height: 72px; min-width: 140px; min-height: 48px; resize: both; overflow: auto; padding: var(--ui-space-2) var(--ui-space-3);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .ripple-host { border-radius: var(--ui-radius); } /* the ripple clips to the host: round it like the button */
    .swap { display: grid; }
    .swap > span { grid-area: 1 / 1; }
    .swap > .off { visibility: hidden; }
    .inf { height: 160px; overflow: auto; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
    /* Rows match the virtual list below: control height, padded, ruled between. */
    .ln { display: flex; align-items: center; height: var(--ui-size-md); box-sizing: border-box; padding: 0 var(--ui-space-3); font-size: var(--ui-font-size-md); }
    .ln + .ln { border-top: 1px solid var(--ui-color-border); }
    .ln.muted { color: var(--ui-color-text-muted); }
    .swipe { display: grid; gap: var(--ui-space-1); place-content: center; text-align: center; height: 140px; border: 1px dashed var(--ui-color-border-strong);
      padding: 0 var(--ui-space-4); border-radius: var(--ui-radius); background: var(--ui-color-surface-subtle); user-select: none; cursor: grab; }
    .swipe strong { font-size: var(--ui-font-size-lg); }
    .swipe span, .plain { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .plain { margin: 0; max-width: 70ch; }
  `,
})
export class BehaviorsPage {
  protected readonly vis = signal(false);
  protected readonly Math = Math;
  protected readonly page = signal(0);
  protected readonly swipePages = ['Invitation', 'Details', 'RSVP', 'Photos'];
  protected readonly swipeApi: ApiRow[] = [
    { name: 'uiSwipeDisabled', type: 'boolean', default: 'false', desc: 'Stop listening, e.g. when there is nowhere to swipe to.' },
    { name: 'uiSwipeMouse', type: 'boolean', default: 'false', desc: 'Also read mouse drags (off by default: a mouse drag is a text selection).' },
    { name: 'isSwipe(dx, dy, ms, width)', type: 'function', default: '', desc: 'Whether a finished drag was a swipe.' },
    { name: 'resist(dx, width, blocked)', type: 'function', default: '', desc: 'How far to follow a drag, with a rubber-band when there is nothing that way.' },
    { name: 'SWIPE_FRACTION / SWIPE_MIN / SWIPE_MAX / FLICK_DISTANCE / FLICK_SPEED / RUBBER_BAND', type: 'number', default: '0.2 / 32 / 72 / 24 / 0.4 / 0.25', desc: 'The shared thresholds.' },
  ];
  protected readonly swipeOut: ApiRow[] = [
    { name: 'uiSwipeLeft', type: 'void', default: '—', desc: 'Finger moved right-to-left (go forward).' },
    { name: 'uiSwipeRight', type: 'void', default: '—', desc: 'Finger moved left-to-right (go back).' },
  ];
  protected readonly big = Array.from({ length: 1000 }, (_, i) => i + 1);
  protected readonly items = signal(Array.from({ length: 20 }, (_, i) => i + 1));
  protected loadMore(): void { this.items.update((l) => [...l, ...Array.from({ length: 10 }, (_, i) => l.length + i + 1)]); }

  protected readonly copyApi: ApiRow[] = [
    { name: 'uiCopyToClipboard', type: 'string', default: "''", desc: 'Text to copy (the value).' },
    { name: 'copied()', type: 'Signal<boolean>', default: 'false', desc: 'True for 1.5s after a successful copy. Read via #c="uiCopy".' },
    { name: 'copy()', type: 'method', default: '—', desc: 'Copy now (what a click does). Returns a Promise<void>.' },
  ];
  protected readonly copyOut: ApiRow[] = [
    { name: 'copied', type: 'string', default: '—', desc: 'Emitted with the copied text.' },
    { name: 'copyFailed', type: 'unknown', default: '—', desc: 'The clipboard refused (no permission, insecure context); the error.' },
  ];
  protected readonly rippleApi: ApiRow[] = [
    { name: 'uiRippleColor', type: 'string', default: "'currentColor'", desc: 'Any CSS colour, including var(--token).' },
    { name: 'uiRippleDisabled', type: 'boolean', default: 'false', desc: 'Disable the ripple.' },
  ];
  protected readonly intersectApi: ApiRow[] = [
    { name: 'uiIntersectRootMargin', type: 'string', default: "'0px'", desc: 'Observer root margin.' },
    { name: 'uiIntersectOnce', type: 'boolean', default: 'false', desc: 'Stop observing after the first true.' },
  ];
  protected readonly intersectOut: ApiRow[] = [{ name: 'uiIntersect', type: 'boolean', default: '—', desc: 'Whether the host is now in the viewport.' }];
  protected readonly infApi: ApiRow[] = [
    { name: 'uiInfiniteScrollThreshold', type: 'number', default: '120', desc: 'Trigger distance from bottom (px).' },
    { name: 'uiInfiniteScrollDisabled', type: 'boolean', default: 'false', desc: 'Ignore scrolling, e.g. while a page loads or when there is no more.' },
  ];
  protected readonly infOut: ApiRow[] = [{ name: 'scrolledToEnd', type: 'void', default: '—', desc: 'Scrolled within the threshold of the bottom.' }];
  protected readonly vlApi: ApiRow[] = [
    { name: 'items', type: 'T[]', default: '[]', desc: 'Full data set.' },
    { name: 'itemSize', type: 'number', default: '32', desc: 'Row height (px), applied to every row.' },
    { name: 'height', type: 'string', default: "'320px'", desc: 'Viewport height.' },
    { name: '<ng-template let-item>', type: 'slot', default: '—', desc: 'Row template; the item is the implicit context.' },
  ];
  protected readonly roOut: ApiRow[] = [{ name: 'uiResizeObserver', type: 'UiSize2D', default: '—', desc: 'Content-box width and height in px.' }];
  protected readonly roSize = signal<UiSize2D | null>(null);
  protected readonly roLabel = computed(() => {
    const z = this.roSize();
    return z ? `${Math.round(z.width)} × ${Math.round(z.height)} px. Drag the corner to resize.` : 'Measuring…';
  });
}
