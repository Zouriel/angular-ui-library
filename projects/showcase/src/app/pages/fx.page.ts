import { Component, signal } from '@angular/core';
import { UiButton } from 'ui/button';
import {
  UiReveal, UiMarquee, UiDriftRow, UiSectionLabel, UiSplitText, UiGlyphField, UiIntroLoader, UiMagnetic,
} from 'ui/fx';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-fx',
  imports: [
    UiButton, UiReveal, UiMarquee, UiDriftRow, UiSectionLabel, UiSplitText, UiGlyphField, UiIntroLoader, UiMagnetic,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Motion" title="Motion & FX"
      lead="The cinematic layer (ui/fx) — scroll reveals, marquee, glyph-field background, split-text, custom cursor, grain, glow. Most shine in the Dark Orange theme (switch in the top bar). All honor prefers-reduced-motion.">

      <doc-section name="Reveal" selector="[uiReveal]" [api]="revealApi"
        summary="Directive. Reveals the host as it scrolls into view (IntersectionObserver). The mode is the directive value. Self-contained (inline transitions; no global CSS).">
        <doc-demo code="<div uiReveal>up</div>
<div uiReveal=&quot;blur&quot; [revealDelay]=&quot;120&quot;>blur</div>
<div uiReveal=&quot;left&quot; [revealOnce]=&quot;false&quot;>repeat</div>">
          <div uiReveal="up" class="rv">Reveals up</div>
          <div uiReveal="left" [revealDelay]="80" class="rv">Slides from left</div>
          <div uiReveal="blur" [revealDelay]="160" class="rv">Un-blurs</div>
        </doc-demo>
      </doc-section>

      <doc-section name="Marquee" selector="ui-marquee" [api]="marqueeApi"
        summary="Infinite horizontal scroller with edge fade; pauses on hover.">
        <doc-demo code="<ui-marquee [items]=&quot;items&quot; [duration]=&quot;24&quot; [reverse]=&quot;false&quot; separator=&quot;✦&quot; />">
          <ui-marquee [items]="marquee" [duration]="22" />
        </doc-demo>
      </doc-section>

      <doc-section name="Drift row" selector="ui-drift-row" [api]="driftApi"
        summary="Horizontal rail that auto-drifts to a random side and stays fully draggable/swipeable/scrollable. Pauses on hover or interaction and resumes after resumeDelay. Ping-pongs at the ends; honors prefers-reduced-motion. Project any cards inside.">
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
        summary="Editorial mono section marker, e.g. [ 00 · INDEX ]. label is required.">
        <doc-demo code="<ui-section-label index=&quot;00&quot; label=&quot;Index&quot; />">
          <ui-section-label index="00" label="Index" />
        </doc-demo>
      </doc-section>

      <doc-section name="Split text" selector="[uiSplitText]" [api]="splitApi"
        summary="Directive. Splits the host's text into per-character spans and animates them in with a stagger (Web Animations API).">
        <doc-demo code="<h1 uiSplitText [stagger]=&quot;35&quot; [base]=&quot;120&quot;>Headline</h1>">
          <div class="big" uiSplitText>Headline</div>
        </doc-demo>
      </doc-section>

      <doc-section name="Glyph field" selector="ui-glyph-field" [api]="glyphApi"
        summary="Animated binary/glyph canvas background (asset-free take on the portfolio's binary-face). Use fixed for a page backdrop, or contain within a positioned parent.">
        <doc-demo code="<ui-glyph-field [fixed]=&quot;true&quot; [opacity]=&quot;0.5&quot; chars=&quot;01&quot; [cell]=&quot;16&quot; [speed]=&quot;1&quot; />">
          <div class="gf-host"><ui-glyph-field [opacity]="0.6" /></div>
        </doc-demo>
      </doc-section>

      <doc-section name="Cursor / grain / scroll-progress" selector="ui-cursor · ui-grain · ui-scroll-progress"
        summary="Mount once near the app root. ui-cursor replaces the pointer (pair with body { cursor: none }); ui-grain is a film-grain overlay; ui-scroll-progress is a top progress bar using the brand gradient. ui-cursor has an interactiveSelector input; ui-grain has opacity (default 0.06).">
        <doc-demo code="<ui-scroll-progress />
@if (darkOrange) { <ui-grain [opacity]=&quot;0.06&quot; /> <ui-cursor /> }"></doc-demo>
      </doc-section>

      <doc-section name="Intro loader" selector="ui-intro-loader" [api]="introApi" [outputs]="introOut"
        summary="Full-screen intro veil that wipes after duration (or when [(open)] is set false). Project a logo/wordmark.">
        <doc-demo code="<ui-intro-loader [(open)]=&quot;intro&quot; [duration]=&quot;1400&quot; (done)=&quot;start()&quot;>ui</ui-intro-loader>">
          <ui-button variant="outline" size="sm" (click)="replay()">Replay intro</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Magnetic & utility classes" selector="[uiMagnetic] · .ui-glow · .ui-gradient-text · .ui-underline" [api]="magApi"
        summary="uiMagnetic pulls the host toward the cursor on hover. The fx.css utility classes (.ui-glow, .ui-gradient-text, .ui-underline) are token-driven and adapt per theme.">
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
    { name: 'revealThreshold', type: 'number', default: '0.18', desc: 'Intersection ratio to trigger.' },
    { name: 'revealOnce', type: 'boolean', default: 'true', desc: 'Reveal only once.' },
    { name: 'duration', type: 'number', default: '900', desc: 'Transition duration (ms).' },
  ];
  protected readonly marqueeApi: ApiRow[] = [
    { name: 'items', type: 'string[]', default: '[]', desc: 'Strings to scroll.' },
    { name: 'duration', type: 'number', default: '38', desc: 'Loop duration (s).' },
    { name: 'gap', type: 'string', default: "'3rem'", desc: 'Gap between items.' },
    { name: 'reverse', type: 'boolean', default: 'false', desc: 'Reverse direction.' },
    { name: 'separator', type: 'string', default: "'✦'", desc: 'Item separator glyph.' },
  ];
  protected readonly driftApi: ApiRow[] = [
    { name: 'speed', type: 'number', default: '26', desc: 'Drift speed (px/s).' },
    { name: 'direction', type: "'auto'|'left'|'right'", default: "'auto'", desc: 'Drift side; auto = random per instance.' },
    { name: 'gap', type: 'string', default: "'1.5rem'", desc: 'Gap between projected items.' },
    { name: 'pauseOnHover', type: 'boolean', default: 'true', desc: 'Pause drift while hovered.' },
    { name: 'resumeDelay', type: 'number', default: '1800', desc: 'Idle time before drift resumes (ms).' },
    { name: 'fade', type: 'boolean', default: 'true', desc: 'Edge-fade mask on the rail.' },
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
    { name: 'speed', type: 'number', default: '1', desc: 'Animation speed.' },
    { name: 'colors', type: '[string, string, string]', default: 'brand ramp', desc: 'Dim → mid → bright.' },
  ];
  protected readonly introApi: ApiRow[] = [
    { name: 'open', type: 'boolean (model)', default: 'true', desc: 'Two-way visibility.' },
    { name: 'duration', type: 'number', default: '1400', desc: 'Time before wipe (ms).' },
  ];
  protected readonly introOut: ApiRow[] = [{ name: 'done', type: 'void', default: '—', desc: 'Emitted after the wipe.' }];
  protected readonly magApi: ApiRow[] = [
    { name: 'magneticStrength', type: 'number', default: '0.35', desc: 'Pull factor (0–1).' },
    { name: 'magneticRadius', type: 'number', default: '0', desc: 'Extra attraction padding (px).' },
  ];
}
