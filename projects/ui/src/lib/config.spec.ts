import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { UI_CONFIG, defaultUiConfig, provideUiConfig } from './config';

describe('provideUiConfig', () => {
  afterEach(() => {
    document.documentElement.classList.remove('ui-no-anim');
    document.documentElement.style.removeProperty('--ui-font-default');
  });

  it('merges the given keys over the defaults', () => {
    TestBed.configureTestingModule({ providers: [provideUiConfig({ glass: true })] });
    expect(TestBed.inject(UI_CONFIG)).toEqual({ ...defaultUiConfig, glass: true });
  });

  it('falls back to the defaults without a provider', () => {
    expect(TestBed.inject(UI_CONFIG)).toEqual(defaultUiConfig);
  });

  it('turns library animations off on <html> when animations is false', () => {
    TestBed.configureTestingModule({ providers: [provideUiConfig({ animations: false })] });
    TestBed.inject(UI_CONFIG);
    expect(document.documentElement.classList.contains('ui-no-anim')).toBe(true);
  });

  it('sets --ui-font-default on <html> from defaultFont', () => {
    TestBed.configureTestingModule({ providers: [provideUiConfig({ defaultFont: 'Inter, sans-serif' })] });
    TestBed.inject(UI_CONFIG);
    expect(document.documentElement.style.getPropertyValue('--ui-font-default')).toBe('Inter, sans-serif');
  });

  it('leaves the font token alone when defaultFont is not given', () => {
    TestBed.configureTestingModule({ providers: [provideUiConfig({ glass: true })] });
    TestBed.inject(UI_CONFIG);
    expect(document.documentElement.style.getPropertyValue('--ui-font-default')).toBe('');
  });

  it('leaves animations on by default', () => {
    TestBed.configureTestingModule({ providers: [provideUiConfig()] });
    TestBed.inject(UI_CONFIG);
    expect(document.documentElement.classList.contains('ui-no-anim')).toBe(false);
  });
});
