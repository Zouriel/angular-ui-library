import { Injectable, signal } from '@angular/core';
import { applyUiDensity, type UiDensity } from '@zouriel/ui';

/** The showcase's density switch (top bar and the Foundation page share it), remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class ShowcaseDensity {
  private static readonly KEY = 'ui-showcase-density';
  readonly options: { value: UiDensity; label: string }[] = [
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'compact', label: 'Compact' },
    { value: 'auto', label: 'Auto' },
  ];
  readonly density = signal<UiDensity>(ShowcaseDensity.stored());

  constructor() {
    applyUiDensity(this.density());
  }

  set(d: UiDensity): void {
    this.density.set(d);
    applyUiDensity(d);
    try { localStorage.setItem(ShowcaseDensity.KEY, d); } catch { /* storage blocked: still applies for this visit */ }
  }

  private static stored(): UiDensity {
    try {
      const v = localStorage.getItem(ShowcaseDensity.KEY);
      if (v === 'compact' || v === 'auto' || v === 'comfortable') return v;
    } catch { /* no storage */ }
    return 'comfortable';
  }
}
