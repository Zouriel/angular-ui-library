import { Component, signal } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';
import {
  UiReveal, UiMarquee, UiDriftRow, UiSectionLabel, UiSplitText, UiGlyphField, UiIntroLoader, UiMagnetic,
} from '@zouriel/ui/fx';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-fx',
  imports: [
    UiButton, UiReveal, UiMarquee, UiDriftRow, UiSectionLabel, UiSplitText, UiGlyphField, UiIntroLoader, UiMagnetic,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Motion" title="Motion & FX"
      lead="The cinematic layer from @zouriel/ui/fx: scroll reveals, marquee, drift row, split text, glyph-field background, custom cursor, grain, scroll progress, intro loader and the magnetic hover. Most shine in the Dark Orange theme (switch in the top bar). Each one's reduced-motion behaviour is given in its section: continuous motion stops, and one-shot entrances are softened rather than removed.">

      <doc-section name="Reveal" selector="[uiReveal]" [api]="revealApi" [shapes]="'type UiRevealMode = &quot;up&quot; | &quot;down&quot; | &quot;left&quot; | &quot;right&quot; | &quot;blur&quot; | &quot;scale&quot;;'"
        summary="Directive. Hides the host (opacity 0, offset) and fades it in when it scrolls into view (IntersectionObserver). The mode is the directive value; blur also un-blurs. With revealOnce off it hides again on leaving. Self-contained: inline transitions, no global CSS. Under prefers-reduced-motion it still fades in, but only from a 6px lift, with no slide, scale or blur. Inputs are read once, on init.">
        <doc-demo code="<div uiReveal>up</div>
<div uiReveal=&quot;blur&quot; [revealDelay]=&quot;120&quot;>blur</div>
<div uiReveal=&quot;left&quot; [revealOnce]=&quot;false&quot;>repeat</div>">
          <div uiReveal="up" class="rv">Reveals up</div>
          <div uiReveal="left" [revealDelay]="80" class="rv">Slides from left</div>
          <div uiReveal="blur" [revealDelay]="160" class="rv">Un-blurs</div>
        </doc-demo>
      </doc-section>

      <doc-section name="Marquee" selector="ui-marquee" [api]="marqueeApi"
        summary="Infinite horizontal scroller of text items with an edge fade. Pauses on hover; stands still under prefers-reduced-motion. The separator is decorative and hidden from screen readers, as is the duplicate track that makes the loop seamless.">
        <doc-demo code="<ui-marquee [items]=&quot;items&quot; [duration]=&quot;24&quot; [reverse]=&quot;false&quot; separator=&quot;✦&quot; />">
          <ui-marquee [items]="marquee" [duration]="22" />
        </doc-demo>
      </doc-section>

      <doc-section name="Drift row" selector="ui-drift-row" [api]="driftApi" [shapes]="'type UiDriftDirection = &quot;auto&quot; | &quot;left&quot; | &quot;right&quot;;'"
        summary="Horizontal rail that drifts on its own (to a random side by default, ping-ponging at the ends) and stays scrollable, swipeable and draggable. It pauses on hover, while focus is inside (so a keyboard user's item never drifts away) and after a wheel, touch or drag, resuming after resumeDelay ms. Click-drag scrolls with a mouse, and the click after a drag is swallowed so cards don't open. Under prefers-reduced-motion it doesn't drift but still scrolls. Set interactive to false for a passive display. Project any cards inside.">
        <doc-demo code="<ui-drift-row [speed]=&quot;26&quot; direction=&quot;auto&quot; gap=&quot;1rem&quot;>
  <article class=&quot;card&quot;>…</article>
</ui-drift-row>">
          <ui-drift-row [speed]="24" gap="1rem">
            @for (d of drift; track d) {
              <div class="dcard">{{ d }}</div>
            }
          </ui-drift-row>
        </doc-demo>
      </doc-section>

      <doc-section name="Section label" selector="ui-section-label" [api]="labelApi"
        summary="Editorial mono section marker, e.g. [ 00 · INDEX ]. label is required; the index and its dot are left out when index is empty.">
        <doc-demo code="<ui-section-label index=&quot;00&quot; label=&quot;Index&quot; />">
          <ui-section-label index="00" label="Index" />
        </doc-demo>
      </doc-section>

      <doc-section name="Split text" selector="[uiSplitText]" [api]="splitApi"
        summary="Directive. Splits the host's text into per-character spans and animates them in with a stagger (Web Animations API). Words stay unbroken, so a heading still wraps between words. The host gets the full text as its aria-label and the letters are hidden from screen readers. Under prefers-reduced-motion it still plays, as a fade with a small lift and no rotation. The text is read once after the first render, so use it on static text, not a changing binding.">
        <doc-demo code="<h1 uiSplitText [stagger]=&quot;35&quot; [base]=&quot;120&quot;>Headline</h1>">
          <div class="big" uiSplitText>Headline</div>
        </doc-demo>
      </doc-section>

      <doc-section name="Glyph field" selector="ui-glyph-field" [api]="glyphApi"
        summary="Animated glyph field drawn on a canvas, for a background. Use fixed for a page backdrop, or place it inside a positioned parent, which it fills. On light themes it switches from screen to multiply blending so it stays visible. Under prefers-reduced-motion it draws one still frame. chars and colors are read once, on init.">
        <doc-demo code="<ui-glyph-field [fixed]=&quot;true&quot; [opacity]=&quot;0.5&quot; chars=&quot;01&quot; [cell]=&quot;16&quot; [speed]=&quot;1&quot; />">
          <div class="gf-host"><ui-glyph-field [opacity]="0.6" /></div>
        </doc-demo>
      </doc-section>

      <doc-section name="Cursor / grain / scroll-progress" selector="ui-cursor · ui-grain · ui-scroll-progress" [api]="chromeApi"
        summary="Mount each once near the app root; this showcase uses all three. ui-cursor draws a dot plus a lagging ring that grows over interactive elements and shrinks on press. It hides itself on touch devices and under reduced motion, and puts ui-cursor-on on html while it draws, so hide the native cursor with html.ui-cursor-on, never unconditionally. ui-grain is a fixed film-grain overlay that ignores the pointer (hidden under reduced motion). ui-scroll-progress is a fixed 2px bar along the top that tracks window scroll with the brand gradient; it has no inputs and is hidden from screen readers. Colors come from --ui-cursor-color and --ui-scroll-progress-track.">
        <doc-demo code="<ui-scroll-progress />
@if (darkOrange) { <ui-grain [opacity]=&quot;0.06&quot; /> <ui-cursor /> }

html.ui-cursor-on, html.ui-cursor-on * { cursor: none; }"></doc-demo>
      </doc-section>

      <doc-section name="Intro loader" selector="ui-intro-loader" [api]="introApi" [outputs]="introOut"
        summary="Full-screen intro veil (role=status) with a progress line. After duration ms it fades and lifts away, then sets open to false and emits (done). Setting open to false yourself removes it at once, without the fade. Project a logo or wordmark. Under prefers-reduced-motion it holds for a third of duration and fades out without the lift.">
        <doc-demo code="<ui-intro-loader [(open)]=&quot;intro&quot; [duration]=&quot;1400&quot; (done)=&quot;start()&quot;>ui</ui-intro-loader>">
          <ui-button variant="outline" size="sm" (click)="replay()">Replay intro</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Magnetic & utility classes" selector="[uiMagnetic] · .ui-glow · .ui-gradient-text · .ui-underline" [api]="magApi"
        summary="uiMagnetic moves the host part of the way toward the cursor while it is over the element (or within magneticRadius px of it) and springs back when it leaves. It uses the CSS translate property, so the host's own transform still works. It is off on touch-first devices (coarse pointer) and under prefers-reduced-motion, and marks the host data-magnetic so ui-cursor treats it as interactive. The fx.css utility classes (.ui-glow, .ui-gradient-text, .ui-underline) are token-driven and adapt per theme.">
        <doc-demo code="<button uiMagnetic [magneticStrength]=&quot;0.35&quot;>Magnetic</button>
<span class=&quot;ui-gradient-text ui-glow&quot;>Glow</span>
<a class=&quot;ui-underline&quot;>Hover underline</a>">
          <div class="row items-center">
            <ui-button variant="primary" uiMagnetic>Magnetic</ui-button>
            <span class="ui-underline" style="cursor:pointer">Hover underline</span>
            <span class="ui-glow ui-gradient-text" style="font-family:var(--ui-font-display);font-weight:700;font-size:1.4rem">Glow gradient</span>
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>

    @if (intro()) { <ui-intro-loader [(open)]="intro"><div class="intro">ui</div></ui-intro-loader> }
  `,
  styles: `
    .rv { padding: var(--ui-space-3) var(--ui-space-4); background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); margin-bottom: var(--ui-space-2); }
    .big { font-family: var(--ui-font-display); font-weight: 800; font-size: clamp(2rem, 6vw, 3.5rem); letter-spacing: -0.03em; }
    .gf-host { position: relative; height: 180px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; background: var(--ui-color-bg); }
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-4); }
    .items-center { align-items: center; }
    .intro { font-size: 3rem; font-weight: 800; font-family: var(--ui-font-display); color: var(--ui-color-text); }
    .dcard { flex: 0 0 auto; width: 190px; height: 120px; display: grid; place-items: center;
      font-family: var(--ui-font-display); font-weight: 700; font-size: 1.15rem; color: var(--ui-color-text);
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
  `,
})
export class FxPage {
  protected readonly intro = signal(false);
  protected replay(): void { this.intro.set(false); queueMicrotask(() => this.intro.set(true)); }
  protected readonly marquee = ['Design tokens', 'Signals', 'Zoneless', 'CDK', 'A11y', 'Tree-shakeable', 'Themeable'];
  protected readonly drift = ['Editorial', 'Weddings', 'Birthdays', 'Galas', 'Launches', 'Ceremonies', 'Dinners', 'Reunions'];

  protected readonly revealApi: ApiRow[] = [
    { name: 'uiReveal', type: "'up'|'down'|'left'|'right'|'blur'|'scale'", default: "'up'", desc: 'Reveal direction (the value).' },
    { name: 'revealDelay', type: 'number', default: '0', desc: 'Delay before reveal (ms).' },
    { name: 'revealThreshold', type: 'number', default: '0.18', desc: 'Share of the host that must be visible (0–1).' },
    { name: 'revealOnce', type: 'boolean', default: 'true', desc: 'Reveal once; false hides it again when it leaves the viewport.' },
    { name: 'duration', type: 'number', default: '900', desc: 'Transition duration (ms).' },
  ];
  protected readonly marqueeApi: ApiRow[] = [
    { name: 'items', type: 'string[]', default: '[]', desc: 'Strings to scroll.' },
    { name: 'duration', type: 'number', default: '38', desc: 'Loop duration (s).' },
    { name: 'gap', type: 'string', default: "'3rem'", desc: 'Gap between items.' },
    { name: 'reverse', type: 'boolean', default: 'false', desc: 'Reverse direction.' },
    { name: 'separator', type: 'string', default: "'✦'", desc: 'Decorative text after each item, in the primary colour.' },
  ];
  protected readonly driftApi: ApiRow[] = [
    { name: 'speed', type: 'number', default: '26', desc: 'Drift speed (px/s).' },
    { name: 'direction', type: 'UiDriftDirection', default: "'auto'", desc: 'Starting drift side; auto picks one at random per instance.' },
    { name: 'gap', type: 'string', default: "'1.5rem'", desc: 'Gap between projected items.' },
    { name: 'pauseOnHover', type: 'boolean', default: 'true', desc: 'Pause drift while hovered.' },
    { name: 'resumeDelay', type: 'number', default: '1800', desc: 'Idle time before drift resumes (ms).' },
    { name: 'fade', type: 'boolean', default: 'true', desc: 'Edge-fade mask on the rail (only shown when it overflows).' },
    { name: 'interactive', type: 'boolean', default: 'true', desc: 'False makes a passive display: it keeps drifting but cannot be scrolled, dragged or clicked.' },
    { name: '<ng-content>', type: 'slot', default: '—', desc: 'The items on the rail.' },
  ];
  protected readonly labelApi: ApiRow[] = [
    { name: 'index', type: 'string', default: "''", desc: 'Leading index (e.g. 00).' },
    { name: 'label', type: 'string (required)', default: '—', desc: 'Section label.' },
  ];
  protected readonly splitApi: ApiRow[] = [
    { name: 'stagger', type: 'number', default: '35', desc: 'Per-character delay (ms).' },
    { name: 'base', type: 'number', default: '120', desc: 'Initial delay (ms).' },
    { name: 'duration', type: 'number', default: '900', desc: 'Per-character duration (ms).' },
  ];
  protected readonly glyphApi: ApiRow[] = [
    { name: 'fixed', type: 'boolean', default: 'false', desc: 'Fixed full-page backdrop.' },
    { name: 'opacity', type: 'number', default: '0.55', desc: 'Canvas opacity.' },
    { name: 'chars', type: 'string', default: "'01'", desc: 'Glyph set.' },
    { name: 'cell', type: 'number', default: '16', desc: 'Cell size (px).' },
    { name: 'speed', type: 'number', default: '1', desc: 'Animation speed multiplier.' },
    { name: 'colors', type: '[string, string, string]', default: "['#5a2832', '#e63946', '#fbbf24']", desc: 'Dim, mid and bright colours as 6-digit hex (#rrggbb); other formats are not parsed.' },
  ];
  protected readonly introApi: ApiRow[] = [
    { name: 'open', type: 'boolean', default: 'true', desc: 'Two-way (`[(open)]`). Whether the veil is shown; it sets itself false after the wipe.' },
    { name: 'duration', type: 'number', default: '1400', desc: 'Time before wipe (ms). A third of this under reduced motion.' },
    { name: '<ng-content>', type: 'slot', default: '—', desc: 'Logo or wordmark shown above the progress line.' },
  ];
  protected readonly chromeApi: ApiRow[] = [
    { name: 'ui-cursor: interactiveSelector', type: 'string', default: "'a, button, [data-magnetic], input, textarea, select, [role=\"button\"]'", desc: 'Elements that grow the ring.' },
    { name: 'ui-grain: opacity', type: 'number', default: '0.06', desc: 'Grain strength.' },
    { name: '--ui-cursor-color', type: 'CSS color', default: 'theme', desc: 'Dot and ring color.' },
    { name: '--ui-scroll-progress-track', type: 'CSS color', default: 'theme', desc: 'Track behind the progress bar.' },
  ];
  protected readonly introOut: ApiRow[] = [{ name: 'done', type: 'void', default: '—', desc: 'Emitted once the wipe has finished, about 650ms after it starts.' }];
  protected readonly magApi: ApiRow[] = [
    { name: 'magneticStrength', type: 'number', default: '0.35', desc: 'Share of the pointer’s offset from the centre that the host follows (0–1).' },
    { name: 'magneticRadius', type: 'number', default: '0', desc: 'Extra px around the host that already pull it. Read once, on init.' },
  ];
}
