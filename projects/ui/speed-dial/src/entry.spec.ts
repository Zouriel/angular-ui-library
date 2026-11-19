import { describe, expect, it } from 'vitest';
import * as button from '@zouriel/ui/button';
import * as speedDial from '@zouriel/ui/speed-dial';

// The speed dial has its own entry point so pages that only import buttons (every app header)
// don't ship it in their initial bundle.
describe('speed dial entry point', () => {
  it('is exported from @zouriel/ui/speed-dial and not from @zouriel/ui/button', () => {
    expect('UiSpeedDial' in speedDial).toBe(true);
    expect('UiSpeedDial' in button).toBe(false);
    expect('UiFab' in button).toBe(true);
  });
});
