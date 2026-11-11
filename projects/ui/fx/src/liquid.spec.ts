import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { provideUiConfig } from '@zouriel/ui';
import { UiLiquidBackdrop } from './liquid';

@Component({
  imports: [UiLiquidBackdrop],
  template: `
    <div class="box" style="position: relative">
      <ui-liquid-backdrop id="bd" [opacity]="opacity()" />
      <p class="content">Hello</p>
    </div>
    <ui-liquid-backdrop id="fx" fixed />
  `,
})
class Host {
  opacity = signal(1);
}

function setup(animations = true) {
  TestBed.configureTestingModule({ providers: [provideUiConfig({ animations })] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement;
  return { fixture, q, host: fixture.componentInstance };
}

/** The component's own CSS, as compiled. */
const styles = ((UiLiquidBackdrop as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');

describe('ui-liquid-backdrop', () => {
  it('is decorative: hidden from screen readers, with its pools and sheen, and leaves the content alone', () => {
    const { q } = setup();
    const bd = q('#bd');
    expect(bd.getAttribute('aria-hidden')).toBe('true');
    expect(bd.querySelectorAll('.pool')).toHaveLength(3);
    expect(bd.querySelectorAll('.sheen')).toHaveLength(1);
    expect(bd.querySelectorAll('.moves')).toHaveLength(4);
    expect(bd.classList.contains('still')).toBe(false);
    expect(q('.content').textContent).toBe('Hello');
    expect(q('#fx').classList.contains('fixed')).toBe(true);
    expect(bd.classList.contains('fixed')).toBe(false);
  });

  it('never takes the pointer and sits behind its siblings', () => {
    expect(styles).toMatch(/pointer-events:\s*none/);
    expect(styles).toMatch(/z-index:\s*0/);
    expect(styles).toMatch(/position:\s*absolute/);
  });

  it('follows its opacity input', () => {
    const { fixture, q, host } = setup();
    host.opacity.set(0.6);
    fixture.detectChanges();
    expect(q('#bd').style.opacity).toBe('0.6');
  });

  it('goes still when the library animations are off', () => {
    const { q } = setup(false);
    expect(q('#bd').classList.contains('still')).toBe(true);
    expect(styles).toMatch(/\.still[^{]*\*[^{]*\{\s*animation:\s*none\s*!important/);
  });

  it('stops under prefers-reduced-motion and inside .ui-no-anim', () => {
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.moves[^{]*\{\s*animation:\s*none\s*!important/);
    expect(styles).toContain('.ui-no-anim');
  });

  it('animates only transform and opacity', () => {
    // From the source: the compiled styles rename keyframes per component.
    const source = readFileSync(join(process.cwd(), 'projects/ui/fx/src/liquid.ts'), 'utf8');
    const frames = [...source.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?\})\s*\}/g)];
    expect(frames.length).toBe(4);
    const props = new Set<string>();
    for (const f of frames) for (const m of f[1].matchAll(/([\w-]+)\s*:/g)) props.add(m[1]);
    expect([...props].sort()).toEqual(['opacity', 'transform']);
  });

  it('paints from theme tokens only, with fallbacks for themes without the liquid ones', () => {
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d/);
    for (const t of ['--ui-liquid-main', '--ui-liquid-second', '--ui-liquid-accent', '--ui-liquid-second-strength', '--ui-liquid-accent-strength', '--ui-glass-highlight-top']) {
      expect(styles).toContain(t);
    }
    expect(styles).toMatch(/var\(--ui-liquid-main,\s*var\(--ui-color-bg\)\)/);
  });
});
