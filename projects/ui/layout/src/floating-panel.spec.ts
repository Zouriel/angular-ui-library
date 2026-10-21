import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideUiConfig, type UiGlassStrength } from '@zouriel/ui';
import { describe, expect, it } from 'vitest';
import { UiFloatingPanel } from './floating-panel';

@Component({
  imports: [UiFloatingPanel],
  template: `<div style="position: relative; height: 400px"><ui-floating-panel ariaLabel="Status" [glass]="glass()" [glassStrength]="strength()">Looking for a nurse</ui-floating-panel></div>`,
})
class GlassHost {
  glass = signal(true);
  strength = signal<UiGlassStrength>('clear');
}

@Component({
  imports: [UiFloatingPanel],
  template: `<div style="position: relative; height: 400px"><ui-floating-panel ariaLabel="Status">Status</ui-floating-panel></div>`,
})
class DefaultHost {}

/** The glass look itself (tint, blur, fallbacks, contrast in every theme) is checked in style-contract.spec. */
describe('UiFloatingPanel glass', () => {
  it('is solid by default and follows UiConfig.glass, as before', async () => {
    let fixture = TestBed.createComponent(DefaultHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-floating-panel').classList.contains('glass')).toBe(false);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideUiConfig({ glass: true })] });
    fixture = TestBed.createComponent(DefaultHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-floating-panel').classList.contains('glass')).toBe(true);
  });

  it('turns the see-through surface on and off with glass and stays a named region', async () => {
    const fixture = TestBed.createComponent(GlassHost);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement.querySelector('ui-floating-panel');
    expect(host.classList.contains('glass')).toBe(true);
    expect(host.getAttribute('role')).toBe('region');
    expect(host.getAttribute('aria-label')).toBe('Status');
    fixture.componentInstance.glass.set(false);
    fixture.detectChanges();
    expect(host.classList.contains('glass')).toBe(false);
  });

  it("is clear by default (0.41.3); glassStrength 'frosted' adds the frosted class, only while glass is on", () => {
    const fixture = TestBed.createComponent(GlassHost);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement.querySelector('ui-floating-panel');
    expect(host.classList.contains('frosted')).toBe(false);
    fixture.componentInstance.strength.set('frosted');
    fixture.detectChanges();
    expect(host.classList.contains('frosted')).toBe(true);
    fixture.componentInstance.glass.set(false);
    fixture.detectChanges();
    expect(host.classList.contains('frosted')).toBe(false);
  });
});

@Component({
  imports: [UiFloatingPanel],
  template: `<div style="position: relative; height: 400px"><ui-floating-panel glass>Status</ui-floating-panel></div>`,
})
class BareHost {}

describe('UiFloatingPanel glass attribute', () => {
  it('takes a bare glass attribute, as in the map-page sample', () => {
    const fixture = TestBed.createComponent(BareHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-floating-panel').classList.contains('glass')).toBe(true);
  });
});
