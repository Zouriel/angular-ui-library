import { Component, signal } from '@angular/core';
import { UiButton } from 'ui/button';
import { UiBadge } from 'ui/badge';
import { UiCopyToClipboard, UiRipple, UiInfiniteScroll, UiIntersect, UiVirtualList } from 'ui/behaviors';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-behaviors',
  imports: [
    UiButton, UiBadge, UiCopyToClipboard, UiRipple, UiInfiniteScroll, UiIntersect, UiVirtualList,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Motion" title="Behavior directives"
      lead="Reusable interaction primitives from ui/behaviors — attach to any element. Plus clickOutside & focusTrap used across the overlay components.">

      <doc-section name="copyToClipboard" selector="[uiCopyToClipboard]" [api]="copyApi" [outputs]="copyOut"
        summary="Copies the bound text on click; exposes a transient copied() signal via exportAs='uiCopy'. The text is the directive value.">
        <doc-demo code="<button [uiCopyToClipboard]=&quot;'npm i ui'&quot; #c=&quot;uiCopy&quot;>
  {{ '{{' }} c.copied() ? 'Copied!' : 'Copy' {{ '}}' }}
</button>">
          <ui-button variant="outline" [uiCopyToClipboard]="'npm i ui'" #c="uiCopy">{{ c.copied() ? 'Copied!' : 'Copy "npm i ui"' }}</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="ripple" selector="[uiRipple]" [api]="rippleApi"
        summary="Material-style ripple emanating from the pointer on press.">
        <doc-demo code="<button uiRipple uiRippleColor=&quot;#fff&quot;>Press</button>">
          <ui-button variant="primary" uiRipple>Ripple me</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="intersect" selector="[uiIntersect]" [api]="intersectApi" [outputs]="intersectOut"
        summary="Emits visibility (boolean) as the host enters/leaves the viewport. uiIntersectOnce fires once then disconnects.">
        <doc-demo code="<div (uiIntersect)=&quot;onVisible($event)&quot; [uiIntersectOnce]=&quot;true&quot;>…</div>">
          <ui-badge [tone]="vis() ? 'success' : 'neutral'" (uiIntersect)="vis.set($event)">{{ vis() ? 'in view' : 'out of view' }}</ui-badge>
        </doc-demo>
      </doc-section>

      <doc-section name="infiniteScroll" selector="[uiInfiniteScroll]" [api]="infApi" [outputs]="infOut"
        summary="Emits (scrolledToEnd) when the host scrolls within threshold px of the bottom; re-arms when scrolled up.">
        <doc-demo code="<div uiInfiniteScroll [uiInfiniteScrollThreshold]=&quot;120&quot; (scrolledToEnd)=&quot;loadMore()&quot;>…</div>">
          <div class="inf" uiInfiniteScroll (scrolledToEnd)="loadMore()">
            @for (n of items(); track n) { <div class="ln">Item {{ n }}</div> }
            <div class="ln muted">scroll for more… ({{ items().length }})</div>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="virtual-list" selector="ui-virtual-list" [api]="vlApi"
        summary="Renders only the visible slice of a large list via CDK virtual scroll. Provide an item template via ng-template let-item.">
        <doc-demo code="<ui-virtual-list [items]=&quot;rows&quot; [itemSize]=&quot;32&quot; height=&quot;200px&quot;>
  <ng-template let-item>{{ '{{' }} item {{ '}}' }}</ng-template>
</ui-virtual-list>">
          <ui-virtual-list [items]="big" [itemSize]="30" height="160px">
            <ng-template let-item>Row #{{ item }}</ng-template>
          </ui-virtual-list>
        </doc-demo>
      </doc-section>

      <doc-section name="resizeObserver" selector="[uiResizeObserver]" [outputs]="roOut"
        summary="Emits the host's content-box size whenever it changes.">
        <doc-demo code="<div (uiResizeObserver)=&quot;onResize($event)&quot;>…</div>   // { width, height }"></doc-demo>
      </doc-section>

      <doc-section name="clickOutside & focusTrap" selector="[uiClickOutside] · CDK cdkTrapFocus"
        summary="uiClickOutside (ui/overlay) emits when a pointer event occurs outside the host — used to dismiss popovers/menus. Focus trapping inside modal/drawer uses CDK a11y's cdkTrapFocus (no separate UI wrapper needed).">
        <doc-demo code="<div (uiClickOutside)=&quot;close()&quot;>…</div>"></doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .inf { height: 160px; overflow: auto; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
    .ln { padding: 2px var(--ui-space-3); font-size: var(--ui-font-size-sm); }
    .ln.muted { color: var(--ui-color-text-muted); }
  `,
})
export class BehaviorsPage {
  protected readonly vis = signal(false);
  protected readonly big = Array.from({ length: 1000 }, (_, i) => i + 1);
  protected readonly items = signal(Array.from({ length: 20 }, (_, i) => i + 1));
  protected loadMore(): void { this.items.update((l) => [...l, ...Array.from({ length: 10 }, (_, i) => l.length + i + 1)]); }

  protected readonly copyApi: ApiRow[] = [
    { name: 'uiCopyToClipboard', type: 'string', default: "''", desc: 'Text to copy (the value).' },
  ];
  protected readonly copyOut: ApiRow[] = [
    { name: 'copied', type: 'string', default: '—', desc: 'Emitted with the copied text.' },
    { name: 'copyFailed', type: 'unknown', default: '—', desc: 'Clipboard error.' },
  ];
  protected readonly rippleApi: ApiRow[] = [
    { name: 'uiRippleColor', type: 'string', default: "'currentColor'", desc: 'Ripple color.' },
    { name: 'uiRippleDisabled', type: 'boolean', default: 'false', desc: 'Disable the ripple.' },
  ];
  protected readonly intersectApi: ApiRow[] = [
    { name: 'uiIntersectRootMargin', type: 'string', default: "'0px'", desc: 'Observer root margin.' },
    { name: 'uiIntersectOnce', type: 'boolean', default: 'false', desc: 'Fire once then stop.' },
  ];
  protected readonly intersectOut: ApiRow[] = [{ name: 'uiIntersect', type: 'boolean', default: '—', desc: 'isIntersecting.' }];
  protected readonly infApi: ApiRow[] = [
    { name: 'uiInfiniteScrollThreshold', type: 'number', default: '120', desc: 'Trigger distance from bottom (px).' },
    { name: 'uiInfiniteScrollDisabled', type: 'boolean', default: 'false', desc: 'Disable.' },
  ];
  protected readonly infOut: ApiRow[] = [{ name: 'scrolledToEnd', type: 'void', default: '—', desc: 'Reached the bottom.' }];
  protected readonly vlApi: ApiRow[] = [
    { name: 'items', type: 'T[]', default: '[]', desc: 'Full data set.' },
    { name: 'itemSize', type: 'number', default: '32', desc: 'Row height (px).' },
    { name: 'height', type: 'string', default: "'320px'", desc: 'Viewport height.' },
  ];
  protected readonly roOut: ApiRow[] = [{ name: 'uiResizeObserver', type: '{ width, height }', default: '—', desc: 'Content-box size.' }];
}
