import { describe, expect, it } from 'vitest';
import { unionBreaks } from './docs-ui';

describe('unionBreaks', () => {
  it('keeps each | with the member before it, so no line starts with a bare |', () => {
    expect(unionBreaks("'rect' | 'circle' | 'text'")).toBe("'rect'\u00a0| 'circle'\u00a0| 'text'");
  });
  it('treats a bar written without spaces the same way', () => {
    expect(unionBreaks("'text'|'search'")).toBe("'text'\u00a0| 'search'");
  });
  it('leaves types without a union alone', () => {
    expect(unionBreaks('WritableSignal<UiTheme>')).toBe('WritableSignal<UiTheme>');
  });
});
