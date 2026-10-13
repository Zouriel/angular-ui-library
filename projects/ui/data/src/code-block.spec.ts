import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiCodeBlock } from './code-block';

describe('UiCodeBlock copy', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else delete (navigator as { clipboard?: unknown }).clipboard;
  });

  async function press(writeText: () => Promise<void>): Promise<string> {
    // jsdom has no clipboard; a browser runner does. Stub it either way.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(writeText) }, configurable: true });
    const fixture = TestBed.createComponent(UiCodeBlock);
    fixture.componentRef.setInput('code', 'npm i');
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.copy')!;
    btn.click();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    return btn.textContent!.trim();
  }

  it('says Copied when the clipboard accepted the text', async () => {
    expect(await press(() => Promise.resolve())).toBe('Copied');
  });

  it('says Copy failed instead of claiming success when the clipboard refuses', async () => {
    expect(await press(() => Promise.reject(new Error('denied')))).toBe('Copy failed');
  });
});
