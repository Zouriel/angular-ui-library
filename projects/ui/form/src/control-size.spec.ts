import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiSwitch } from './switch';
import { UiTextarea } from './textarea';
import { UiTokenInput } from './token-input';

// jsdom has no ResizeObserver; autosize measures with one.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

@Component({
  imports: [UiSwitch, UiTextarea, UiTokenInput],
  template: `
    <ui-switch size="sm">On</ui-switch><ui-textarea size="sm" /><ui-token-input size="sm" />
    <ui-switch>On</ui-switch><ui-textarea /><ui-token-input />
  `,
})
class Host {}

describe('control sizes', () => {
  it('switch, textarea and token input take sm for dense panels and default to md', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const sizes = [...(f.nativeElement as HTMLElement).querySelectorAll('.ui-switch, .ui-textarea, .editor')].map((e) => e.getAttribute('data-size'));
    expect(sizes).toEqual(['sm', 'sm', 'sm', 'md', 'md', 'md']);
  });
});
