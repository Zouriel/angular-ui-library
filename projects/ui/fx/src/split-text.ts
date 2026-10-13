import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Directive, ElementRef, PLATFORM_ID, inject, input } from '@angular/core';

/**
 * `uiSplitText` — splits the host's text into per-character spans and animates
 * them in with a stagger (Web Animations API; no global keyframes needed).
 * Best on a single line/heading. Honors `prefers-reduced-motion`.
 *
 *   <h1 uiSplitText>Mohamed</h1>
 */
@Directive({
  selector: '[uiSplitText]',
})
export class UiSplitText implements AfterViewInit {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  /** Per-character delay (ms). */
  stagger = input(35);
  /** Initial delay before the first character (ms). */
  base = input(120);
  duration = input(900);

  ngAfterViewInit(): void {
    // Prerendered HTML keeps the plain text, which is also what a search engine should read.
    if (!this.browser) return;
    const el = this.host.nativeElement;
    const text = el.textContent ?? '';
    if (!text.trim()) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    el.textContent = '';
    // Screen readers get the sentence once, not a letter at a time.
    el.setAttribute('aria-label', text.trim());
    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    const spans: HTMLElement[] = [];
    // Characters are grouped into unbreakable words with ordinary spaces between them, so a heading
    // still wraps at word boundaries instead of running off the side of a phone.
    text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { wrap.appendChild(document.createTextNode(' ')); return; }
      const word = document.createElement('span');
      word.style.display = 'inline-block';
      word.style.whiteSpace = 'nowrap';
      for (const ch of Array.from(part)) {
        const span = document.createElement('span');
        span.textContent = ch;
        span.style.display = 'inline-block';
        word.appendChild(span);
        spans.push(span);
      }
      wrap.appendChild(word);
    });
    el.appendChild(wrap);

    if (typeof Element.prototype.animate !== 'function') return;
    // Animation-first: the headline reveal plays even under reduced-motion, softened to a gentle
    // per-character fade (no rotation / big travel) so it stays comfortable.
    const from = reduce
      ? { opacity: 0, transform: 'translateY(0.2em)' }
      : { opacity: 0, transform: 'translateY(0.9em) rotate(8deg)' };
    const to = { opacity: 1, transform: 'translateY(0) rotate(0)' };
    spans.forEach((span, i) => {
      span.style.willChange = 'transform, opacity';
      const anim = span.animate([from, to], {
        duration: this.duration(),
        delay: this.base() + i * this.stagger(),
        easing: 'cubic-bezier(.16,1,.3,1)',
        fill: 'both',
      });
      anim.finished.then(() => (span.style.willChange = 'auto'), () => undefined);
    });
  }
}
