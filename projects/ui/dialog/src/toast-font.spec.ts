import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiToastHost, UiToastService } from './toast';

/*
 * 0.44.2: toasts draw their text in --ui-toast-font (default the theme font), as the text fields do
 * with --ui-field-font, so an app can give them its Thaana font (the Dhirumi nurse app: a Dhivehi
 * name in a toast came out as boxes in Flutter; the web toast was pinned to --ui-font-default too).
 */

const THAANA = '\u0787\u07A7\u0787\u07A8\u079D\u07A6\u078C\u07AA';

function render() {
  const f = TestBed.createComponent(UiToastHost);
  f.componentRef.setInput('position', 'top-center');
  const el = f.nativeElement as HTMLElement;
  el.style.setProperty('--ui-toast-font', "Faruma, 'Noto Sans Thaana'");
  f.detectChanges();
  TestBed.inject(UiToastService).show({ message: `New message from ${THAANA}`, title: THAANA, duration: 0, action: { label: 'Open', run: () => {} } });
  f.detectChanges();
  return el;
}

describe('ui-toast-host font (0.44.2)', () => {
  it('the toast and its action take their font from --ui-toast-font, defaulting to the theme font', () => {
    const el = render();
    const toast = el.querySelector<HTMLElement>('.toast')!;
    expect(getComputedStyle(toast).fontFamily).toBe('var(--ui-toast-font, var(--ui-font-default))');
    const act = el.querySelector<HTMLElement>('.act')!;
    expect(getComputedStyle(act).getPropertyValue('font')).toContain('var(--ui-toast-font, var(--ui-font-default))');
    expect(getComputedStyle(el).getPropertyValue('--ui-toast-font')).toBe("Faruma, 'Noto Sans Thaana'");
    expect(el.querySelector('.title')!.textContent).toBe(THAANA);
  });

  it('no rule in the toast styles sets a font family any other way (the title and message inherit it)', () => {
    const css = ((UiToastHost as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');
    expect(css).toContain('--ui-toast-font');
    const decls = css.match(/(?:^|[;{\s])font(?:-family)?\s*:[^;}]*/g) ?? [];
    expect(decls.length).toBeGreaterThan(1);
    const stray = decls.map((d) => d.trim().replace(/^[;{]\s*/, '')).filter((d) => !d.includes('--ui-toast-font') && !/^font\s*:\s*inherit$/.test(d));
    expect(stray).toEqual([]);
  });
});
