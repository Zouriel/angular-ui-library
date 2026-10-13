/** Small building blocks shared by the builder's panels (rows, labels, icon buttons). */
export const FB_SHARED_STYLES = `
  .fb-icon-btn {
    display: inline-grid; place-items: center; width: 26px; height: 26px; flex: none;
    border: 0; border-radius: var(--ui-radius-xs); background: transparent; color: var(--ui-color-text-muted); cursor: pointer;
    transition: background var(--ui-motion-fast), color var(--ui-motion-fast);
  }
  .fb-icon-btn:hover:not(:disabled) { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
  .fb-icon-btn:disabled { opacity: 0.35; cursor: default; }
  .fb-icon-btn:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  .fb-icon-btn.danger:hover:not(:disabled) { color: var(--ui-color-danger); background: color-mix(in srgb, var(--ui-color-danger) 10%, transparent); }
  .fb-icon-btn.on { color: var(--ui-color-primary); background: color-mix(in srgb, var(--ui-color-primary) 12%, transparent); }
  @media (pointer: coarse) { .fb-icon-btn { width: 36px; height: 36px; } }
  .lw { display: block; min-width: 0; }
  .fb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .fb-label { display: block; font-size: 12px; font-weight: 550; color: var(--ui-color-text-secondary); margin-bottom: 4px; }
  .fb-hint { margin: 2px 0 0; font-size: 12px; line-height: 1.35; color: var(--ui-color-text-muted); }
  .fb-warn { margin: 0; padding: 6px var(--ui-space-2); font-size: 12px; line-height: 1.4; border-radius: var(--ui-radius-xs);
    color: var(--ui-color-text); background: color-mix(in srgb, var(--ui-color-warning) 14%, var(--ui-color-surface)); border: 1px solid color-mix(in srgb, var(--ui-color-warning) 35%, transparent); }
  .fb-chip { display: inline-flex; align-items: center; gap: var(--ui-space-1); height: 18px; padding: 0 6px; border-radius: var(--ui-radius-xs);
    font-size: 11px; font-weight: 550; white-space: nowrap; color: var(--ui-color-text-secondary); background: var(--ui-color-surface-hover); }
  .fb-chip.logic { color: color-mix(in srgb, var(--ui-color-primary) 75%, var(--ui-color-text)); background: color-mix(in srgb, var(--ui-color-primary) 13%, transparent); }
  .fb-chip.warn { color: var(--ui-color-warning); background: color-mix(in srgb, var(--ui-color-warning) 14%, transparent); }
  .fb-chip.bad { color: var(--ui-color-danger); background: color-mix(in srgb, var(--ui-color-danger) 13%, transparent); }
  .fb-chip.ok { color: var(--ui-color-success); background: color-mix(in srgb, var(--ui-color-success) 13%, transparent); }
  .fb-stack { display: flex; flex-direction: column; gap: var(--ui-space-3); }
  .fb-row { display: flex; align-items: center; gap: var(--ui-space-2); }
  .fb-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-2); }
  .fb-link { border: 0; background: none; padding: 0; color: var(--ui-color-primary); font: inherit; font-size: 12px; font-weight: 550; cursor: pointer; }
  .fb-link:hover { text-decoration: underline; text-underline-offset: 2px; }
  .fb-link:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 2px; }
  .fb-native-select {
    width: 100%; height: var(--ui-size-md); padding: 0 26px 0 var(--ui-space-2); box-sizing: border-box; min-width: 0;
    border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius); background-color: var(--ui-color-surface); color: var(--ui-color-text);
    font: inherit; font-size: 13px; appearance: none; cursor: pointer;
    background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-position: calc(100% - 13px) 50%, calc(100% - 9px) 50%; background-size: 4px 4px; background-repeat: no-repeat;
  }
  .fb-native-select:focus { outline: none; border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
  .fb-native-select:disabled { opacity: 0.55; cursor: not-allowed; }
  @media (pointer: coarse) { .fb-native-select { height: 40px; font-size: 15px; } }
`;
