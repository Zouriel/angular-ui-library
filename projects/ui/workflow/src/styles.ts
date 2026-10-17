/** Building blocks shared by the workflow components (rows, labels, chips, icon buttons, native selects). */
export const WF_SHARED_STYLES = `
  .wf-icon-btn {
    display: inline-grid; place-items: center; width: 26px; height: 26px; flex: none; padding: 0;
    border: 0; border-radius: var(--ui-radius-xs); background: transparent; color: var(--ui-color-text-muted); cursor: pointer;
    transition: background var(--ui-motion-fast), color var(--ui-motion-fast);
  }
  .wf-icon-btn:hover:not(:disabled) { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
  .wf-icon-btn:disabled { opacity: 0.35; cursor: default; }
  .wf-icon-btn:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  .wf-icon-btn.danger:hover:not(:disabled) { color: var(--ui-color-danger); background: color-mix(in srgb, var(--ui-color-danger) 10%, transparent); }
  .wf-icon-btn.on { color: var(--ui-color-primary); background: color-mix(in srgb, var(--ui-color-primary) 12%, transparent); }
  @media (pointer: coarse) { .wf-icon-btn { width: 36px; height: 36px; } }
  .wf-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .wf-label { display: block; font-size: 12px; font-weight: 550; color: var(--ui-color-text-secondary); margin-bottom: 4px; }
  .wf-hint { margin: 2px 0 0; font-size: 12px; line-height: 1.35; color: var(--ui-color-text-muted); }
  .wf-warn { margin: 0; padding: 6px var(--ui-space-2); font-size: 12px; line-height: 1.4; border-radius: var(--ui-radius-xs);
    color: var(--ui-color-text); background: color-mix(in srgb, var(--ui-color-warning) 14%, var(--ui-color-surface)); border: 1px solid color-mix(in srgb, var(--ui-color-warning) 35%, transparent); }
  .wf-error { margin: 0; padding: 6px var(--ui-space-2); font-size: 12px; line-height: 1.4; border-radius: var(--ui-radius-xs);
    color: var(--ui-color-text); background: color-mix(in srgb, var(--ui-color-danger) 12%, var(--ui-color-surface)); border: 1px solid color-mix(in srgb, var(--ui-color-danger) 32%, transparent); }
  .wf-chip { display: inline-flex; align-items: center; gap: 4px; height: 18px; padding: 0 6px; border-radius: var(--ui-radius-xs);
    font-size: 11px; font-weight: 550; white-space: nowrap; color: var(--ui-color-text-secondary); background: var(--ui-color-surface-hover); }
  .wf-chip[data-tone="success"] { color: var(--ui-color-success); background: color-mix(in srgb, var(--ui-color-success) 13%, transparent); }
  .wf-chip[data-tone="danger"] { color: var(--ui-color-danger); background: color-mix(in srgb, var(--ui-color-danger) 13%, transparent); }
  .wf-chip[data-tone="warning"] { color: var(--ui-color-warning); background: color-mix(in srgb, var(--ui-color-warning) 14%, transparent); }
  .wf-chip[data-tone="info"], .wf-chip[data-tone="primary"] { color: color-mix(in srgb, var(--ui-color-primary) 80%, var(--ui-color-text)); background: color-mix(in srgb, var(--ui-color-primary) 13%, transparent); }
  .wf-stack { display: flex; flex-direction: column; gap: var(--ui-space-3); }
  .wf-row { display: flex; align-items: center; gap: var(--ui-space-2); }
  .wf-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-2); }
  .wf-link { border: 0; background: none; padding: 0; color: var(--ui-color-primary); font: inherit; font-size: 12px; font-weight: 550; cursor: pointer; }
  .wf-link:hover { text-decoration: underline; text-underline-offset: 2px; }
  .wf-link:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 2px; }
  .wf-select {
    width: 100%; height: var(--ui-size-md); padding: 0 26px 0 var(--ui-space-2); box-sizing: border-box; min-width: 0;
    border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius); background-color: var(--ui-color-surface); color: var(--ui-color-text);
    font: inherit; font-size: 13px; appearance: none; cursor: pointer;
    background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-position: calc(100% - 13px) 50%, calc(100% - 9px) 50%; background-size: 4px 4px; background-repeat: no-repeat;
  }
  .wf-select:focus { outline: none; border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
  .wf-select:disabled { opacity: 0.55; cursor: not-allowed; }
  @media (pointer: coarse) { .wf-select { height: 40px; font-size: 15px; } }
  .wf-section { border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); padding-top: var(--ui-space-3); }
  .wf-section-title { margin: 0 0 var(--ui-space-2); font-size: 11px; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ui-color-text-muted); }
`;
