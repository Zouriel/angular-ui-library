import { describe, expect, it } from 'vitest';
import { uiMapIsDark, uiMapMarkerHtml } from './map';

describe('ui-map helpers', () => {
  it('tells dark backgrounds from light ones, to dim the tiles', () => {
    expect(uiMapIsDark('rgb(7, 27, 35)')).toBe(true);
    expect(uiMapIsDark('rgb(243, 248, 251)')).toBe(false);
    expect(uiMapIsDark('rgba(0, 0, 0, 0)')).toBe(true);
    expect(uiMapIsDark('not a colour')).toBe(false);
  });

  it('draws a marker in its tone with its label, escaped', () => {
    expect(uiMapMarkerHtml({})).toBe('<span class="ui-map-dot" data-tone="primary"></span>');
    expect(uiMapMarkerHtml({ tone: 'success', label: 'Aminath <RN>' })).toBe(
      '<span class="ui-map-dot" data-tone="success"></span><span class="ui-map-label">Aminath &lt;RN&gt;</span>',
    );
  });
});
