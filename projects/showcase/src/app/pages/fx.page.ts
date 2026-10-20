import { Component, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import AiBrain01Icon from '@hugeicons/core-free-icons/AiBrain01Icon';
import { UiButton } from '@zouriel/ui/button';
import { UiThemeProvider } from '@zouriel/ui/theme';
import {
  UiReveal, UiMarquee, UiDriftRow, UiSectionLabel, UiSplitText, UiGlyphField, UiIntroLoader, UiMagnetic,
  UiWaveFooter, UiOceanHero, UiCoralDecor, UiPalmDecor, UiSunrise, UiSeaSurface, UiTide, type UiDecorCorner,
} from '@zouriel/ui/fx';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-fx',
  imports: [
    HugeiconsIconComponent, UiButton, UiThemeProvider, UiReveal, UiMarquee, UiDriftRow, UiSectionLabel, UiSplitText, UiGlyphField,
    UiIntroLoader, UiMagnetic, UiWaveFooter, UiOceanHero, UiCoralDecor, UiPalmDecor, UiSunrise, UiSeaSurface, UiTide,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Motion" title="Motion & FX"
      lead="The cinematic layer from @zouriel/ui/fx: scroll reveals, marquee, drift row, split text, glyph-field background, custom cursor, grain, scroll progress, intro loader and the magnetic hover, plus the sea backdrops of the Maldives theme. Most shine in the Dark Orange theme (switch in the top bar); the sea backdrops are shown inside Maldives islands whatever the page theme. Each one's reduced-motion behaviour is given in its section: continuous motion stops, and one-shot entrances are softened rather than removed.">

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

      <doc-section name="Section label" selector="ui-section-label" [api]="labelApi" [shapes]="'type UiSectionLabelVariant = &quot;auto&quot; | &quot;bracket&quot; | &quot;eyebrow&quot;;'"
        summary="A section marker above a heading. eyebrow is a short accent bar and the label in small caps, in the theme's own font, with the index in the primary colour; bracket is the editorial mono marker made for Dark Orange, [ 00 · INDEX ]. auto (the default) picks bracket on Dark Orange and eyebrow everywhere else. The accent colour is --ui-section-label-bracket: the theme's primary by default, its warm accent in Winter, blood red in Dark Orange, coral in Maldives. label is required; the index is left out when empty.">
        <doc-demo code="<ui-section-label index=&quot;00&quot; label=&quot;Index&quot; />
<ui-section-label variant=&quot;bracket&quot; index=&quot;01&quot; label=&quot;Work&quot; />">
          <div class="labels">
            <ui-section-label index="00" label="Index" />
            <ui-section-label variant="eyebrow" index="01" label="Eyebrow" />
            <ui-section-label variant="bracket" index="02" label="Bracket" />
          </div>
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
          <div class="gf-host"><ui-glyph-field [opacity]="0.9" /></div>
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

      <doc-section name="Wave footer" selector="ui-wave-footer" [api]="waveApi" [shapes]="'type UiWaveLayers = 2 | 3;'"
        summary="Two or three stacked wave bands pinned to the bottom of the nearest positioned container, in the theme's Lagoon (secondary in themes without one). Each band drifts sideways on its own slow loop, alternating direction (the tide: 30, 38 and 46 seconds). Decorative: hidden from screen readers and never takes the pointer. The drift stops under prefers-reduced-motion and with provideUiConfig({ animations: false }).">
        <doc-demo code="<div style=&quot;position: relative&quot;>
  …
  <ui-wave-footer [layers]=&quot;3&quot; [height]=&quot;120&quot; [opacity]=&quot;0.5&quot; />
</div>">
          <ui-theme-provider theme="maldives" class="ui-surface sea-box">
            <ui-wave-footer [layers]="3" [height]="110" [opacity]="0.6" />
          </ui-theme-provider>
        </doc-demo>
      </doc-section>

      <doc-section name="Ocean hero" selector="ui-ocean-hero" [api]="heroApi"
        summary="A full-bleed sea backdrop: the theme's --ui-gradient-hero (in Maldives a sand and coral sky over the lagoon into deep teal), an optional photo under it as a wash, and a slow diagonal light sweep every 8 seconds. Project the hero's content; it sits above the sky. The photo and sweep are decorative. The sweep stops under reduced motion or with animations off. With fill it covers its positioned parent instead of flowing.">
        <doc-demo code="<ui-ocean-hero src=&quot;beach.jpg&quot; [shimmer]=&quot;true&quot;>
  <h1>Find a doctor</h1>
</ui-ocean-hero>">
          <ui-theme-provider theme="maldives">
            <ui-ocean-hero class="hero-demo">
              <div class="hero-inner"><span class="hero-title">Find Doctor</span><span class="hero-tag">Care, close to home</span></div>
            </ui-ocean-hero>
          </ui-theme-provider>
        </doc-demo>
      </doc-section>

      <doc-section name="Coral and palm decor" selector="ui-coral-decor · ui-palm-decor" [api]="decorApi" [shapes]="'type UiDecorCorner = &quot;bl&quot; | &quot;br&quot; | &quot;tl&quot; | &quot;tr&quot;;'"
        summary="Corner silhouettes for a positioned container: branching coral on a sand mound (Coral and Sand), and two leaning palms (Ocean Deep and Lagoon). corner picks the corner and mirrors the shape to face inward. They float 4px up and down on a 5 second loop, which stops under reduced motion or with animations off. Decorative: hidden from screen readers, never take the pointer. The shapes come from the shared SVG sources in projects/ui/fx/assets/maldives.">
        <doc-demo code="<ui-coral-decor corner=&quot;bl&quot; [scale]=&quot;1&quot; [opacity]=&quot;0.9&quot; />
<ui-palm-decor corner=&quot;br&quot; [scale]=&quot;0.8&quot; />">
          <div class="row">
            @for (c of corners; track c) {
              <ui-theme-provider theme="maldives" class="ui-surface decor-box">
                <ui-coral-decor [corner]="c" [scale]="0.6" />
                <ui-palm-decor [corner]="c === 'bl' ? 'br' : c === 'br' ? 'bl' : c === 'tl' ? 'tr' : 'tl'" [scale]="0.55" />
                <span class="decor-label">{{ c }}</span>
              </ui-theme-provider>
            }
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Sunrise" selector="ui-sunrise" [api]="sunApi"
        summary="A Coral sun with a soft Sand glow behind a logo slot, for a splash or empty state. On mount it fades in and rises 12px over twice --ui-motion-slow, then idles with a slow glow pulse. Under reduced motion it only fades in and the pulse stops; with animations off it simply shows. Project the logo; the sun and glow are hidden from screen readers.">
        <doc-demo code="<ui-sunrise [size]=&quot;120&quot;><img src=&quot;logo.svg&quot; alt=&quot;Find Doctor&quot; /></ui-sunrise>">
          <ui-theme-provider theme="maldives" class="ui-surface sun-box">
            <div class="sun-inner">
              @if (sunKey()) { <ui-sunrise [size]="96"><span class="sun-logo">FD</span></ui-sunrise> }
              <ui-button variant="outline" size="sm" (click)="replaySun()">Replay</ui-button>
            </div>
          </ui-theme-provider>
        </doc-demo>
      </doc-section>

      <doc-section name="Sea surface" selector="ui-sea-surface" [api]="surfaceApi"
        summary="The whole look in one element. It scopes a theme to the region (maldives by default, null keeps the page's), paints that theme's background, text colour and font like ui-theme-provider with class ui-surface, and lays the wave footer and any corner decor behind the projected content.">
        <doc-demo code="<ui-sea-surface coral=&quot;bl&quot; palm=&quot;br&quot; [waveLayers]=&quot;3&quot;>
  <h2>Book a visit</h2>
</ui-sea-surface>">
          <ui-sea-surface class="surface-demo" coral="bl" palm="br" [decorScale]="0.6" [waveHeight]="90">
            <div class="surface-inner">
              <span class="surface-title">Book a visit</span>
              <span class="surface-copy">Waves along the bottom, coral and palms in the corners, Maldives tokens inside.</span>
              <ui-button variant="accent">Get guidance</ui-button>
            </div>
          </ui-sea-surface>
        </doc-demo>
      </doc-section>

      <doc-section name="Tide" selector="[uiTide]" [api]="tideApi"
        summary="Directive. A staggered entrance for lists and cards: each item fades in and slides up 8px, starting tideDelay + index × tideStep ms after it renders. It reuses the shared ui-slide-up-enter class from animations.css (load it globally), so reduced motion turns it into a plain fade and animations off skips it. The .ui-pulse class from fx.css is the matching slow glow pulse for a working or AI-thinking mark.">
        <doc-demo code="@for (d of doctors; track d.id; let i = $index) {
  <ui-card [uiTide]=&quot;i&quot; [tideStep]=&quot;60&quot;>…</ui-card>
}
<hugeicons-icon class=&quot;ui-pulse&quot; [icon]=&quot;aiIcon&quot; />">
          <ui-theme-provider theme="maldives" class="ui-surface tide-box">
            <div class="tide-inner">
              @if (tideKey()) {
                @for (d of tideItems; track d; let i = $index) { <div class="tide-card" [uiTide]="i" [tideStep]="80">{{ d }}</div> }
              }
              <div class="row items-center">
                <hugeicons-icon class="ui-pulse ai" aria-hidden="true" [icon]="aiIcon" [size]="24" [strokeWidth]="1.8" />
                <ui-button variant="outline" size="sm" (click)="replayTide()">Replay</ui-button>
              </div>
            </div>
          </ui-theme-provider>
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
    .labels { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .items-center { align-items: center; }
    .intro { font-size: 3rem; font-weight: 800; font-family: var(--ui-font-display); color: var(--ui-color-text); }
    .sea-box { position: relative; display: block; height: 160px; border-radius: var(--ui-radius-lg); overflow: hidden; }
    .hero-demo { height: 220px; border-radius: var(--ui-radius-lg); }
    .hero-inner { height: 100%; display: flex; flex-direction: column; justify-content: flex-end; gap: var(--ui-space-1); padding: var(--ui-space-6); box-sizing: border-box; }
    .hero-title { font-family: var(--ui-font-display); font-weight: 600; font-size: 1.75rem; color: var(--ui-color-primary-contrast); }
    .hero-tag { font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); letter-spacing: var(--ui-tracking-wide); text-transform: uppercase; color: var(--ui-color-primary-contrast); }
    .decor-box { position: relative; display: block; width: 168px; height: 140px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg); overflow: hidden; }
    .decor-label { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .sun-box { border-radius: var(--ui-radius-lg); }
    .sun-inner { display: flex; flex-direction: column; align-items: center; gap: var(--ui-space-3); padding: var(--ui-space-4); }
    .sun-logo { font-family: var(--ui-font-display); font-weight: 600; font-size: 1.6rem; }
    .surface-demo { border-radius: var(--ui-radius-lg); min-height: 260px; }
    .surface-inner { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--ui-space-3); padding: var(--ui-space-8) var(--ui-space-6) var(--ui-space-20); }
    .surface-title { font-family: var(--ui-font-display); font-weight: 600; font-size: 1.4rem; }
    .surface-copy { max-width: 36ch; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
    .tide-box { border-radius: var(--ui-radius-lg); }
    .tide-inner { display: flex; flex-direction: column; gap: var(--ui-space-2); padding: var(--ui-space-4); }
    .tide-card { padding: var(--ui-space-3) var(--ui-space-4); background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-1); font-family: var(--ui-font-default); color: var(--ui-color-text); }
    .ai { color: var(--ui-color-secondary); }
    .dcard { flex: 0 0 auto; width: 190px; height: 120px; display: grid; place-items: center;
      font-family: var(--ui-font-display); font-weight: 700; font-size: 1.15rem; color: var(--ui-color-text);
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
  `,
})
export class FxPage {
  protected readonly intro = signal(false);
  protected replay(): void { this.intro.set(false); queueMicrotask(() => this.intro.set(true)); }
  protected readonly aiIcon = AiBrain01Icon;
  protected readonly corners: UiDecorCorner[] = ['bl', 'br', 'tl', 'tr'];
  protected readonly tideItems = ['Dr. Aisha Rasheed · Cardiology', 'Dr. Ibrahim Naseem · Paediatrics', 'Dr. Mariyam Shifa · Dermatology'];
  /** Re-mounting is the replay: the entrances run when the element renders. */
  protected readonly sunKey = signal(true);
  protected readonly tideKey = signal(true);
  protected replaySun(): void { this.sunKey.set(false); setTimeout(() => this.sunKey.set(true)); }
  protected replayTide(): void { this.tideKey.set(false); setTimeout(() => this.tideKey.set(true)); }
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
    { name: 'variant', type: 'UiSectionLabelVariant', default: "'auto'", desc: 'bracket on Dark Orange and eyebrow elsewhere, or force one.' },
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
    { name: 'colors', type: '[string, string, string]', default: 'theme ramp', desc: "Dim, mid and bright colours (any CSS colour). By default the theme's ember, blood and rose, or a ramp from its primary and accent; follows theme switches." },
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
  protected readonly waveApi: ApiRow[] = [
    { name: 'layers', type: 'UiWaveLayers', default: '3', desc: 'Bands, back to front; 2 drops the middle one.' },
    { name: 'height', type: 'number', default: '120', desc: 'Height of the tallest band (px).' },
    { name: 'opacity', type: 'number', default: '0.5', desc: 'Opacity of the whole footer.' },
  ];
  protected readonly heroApi: ApiRow[] = [
    { name: 'src', type: 'string | null', default: 'null', desc: 'Optional photo under the gradient, which becomes a wash over it. Decorative (empty alt).' },
    { name: 'shimmer', type: 'boolean', default: 'true', desc: 'The slow diagonal light sweep.' },
    { name: 'fill', type: 'boolean', default: 'false', desc: 'Cover the nearest positioned parent (absolute, inset 0) instead of flowing.' },
    { name: '<ng-content>', type: 'slot', default: '—', desc: 'The hero content, drawn above the sky.' },
  ];
  protected readonly decorApi: ApiRow[] = [
    { name: 'corner', type: 'UiDecorCorner', default: "'bl'", desc: 'Corner of the positioned parent; the shape is mirrored to face inward.' },
    { name: 'scale', type: 'number', default: '1', desc: 'Size multiplier: coral is 160 × 128px at 1, palms 160 × 176px.' },
    { name: 'opacity', type: 'number', default: '0.9', desc: 'Opacity of the silhouette.' },
  ];
  protected readonly sunApi: ApiRow[] = [
    { name: 'size', type: 'number', default: '120', desc: 'Diameter of the sun (px); the host is 1.6 times that, for the glow.' },
    { name: '<ng-content>', type: 'slot', default: '—', desc: 'The logo, centred on the sun.' },
  ];
  protected readonly surfaceApi: ApiRow[] = [
    { name: 'theme', type: 'string | null', default: "'maldives'", desc: "Theme scoped to the region ('maldives-dark' for the night sea); null keeps the page theme." },
    { name: 'waves', type: 'boolean', default: 'true', desc: 'Show the wave footer.' },
    { name: 'waveLayers', type: 'UiWaveLayers', default: '3', desc: 'Wave bands.' },
    { name: 'waveHeight', type: 'number', default: '120', desc: 'Wave footer height (px).' },
    { name: 'waveOpacity', type: 'number', default: '0.5', desc: 'Wave footer opacity.' },
    { name: 'coral', type: 'UiDecorCorner | null', default: 'null', desc: 'Corner for the coral, or none.' },
    { name: 'palm', type: 'UiDecorCorner | null', default: 'null', desc: 'Corner for the palms, or none.' },
    { name: 'decorScale', type: 'number', default: '1', desc: 'Scale of both decor silhouettes.' },
    { name: '<ng-content>', type: 'slot', default: '—', desc: 'The region content, above the backdrop.' },
  ];
  protected readonly tideApi: ApiRow[] = [
    { name: 'uiTide', type: 'number', default: '0', desc: 'The item’s index in its list.' },
    { name: 'tideDelay', type: 'number', default: '0', desc: 'Delay before the first item (ms).' },
    { name: 'tideStep', type: 'number', default: '60', desc: 'Extra delay per index (ms).' },
  ];
  protected readonly magApi: ApiRow[] = [
    { name: 'magneticStrength', type: 'number', default: '0.35', desc: 'Share of the pointer’s offset from the centre that the host follows (0–1).' },
    { name: 'magneticRadius', type: 'number', default: '0', desc: 'Extra px around the host that already pull it. Read once, on init.' },
  ];
}
