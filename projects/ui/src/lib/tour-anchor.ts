import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, Injectable, effect, inject, input, untracked } from '@angular/core';

/**
 * The tour anchors on the page, by id. It lives in the core entry point (not `@zouriel/ui/guidance`)
 * so components that carry an optional anchor (`ui-bottom-nav` items, `ui-tab`) can register one
 * without pulling the whole guidance entry point (tour panel, overlay, cards) into every app's first
 * paint: a library entry point is one module. `UiTourService` reads anchors from here.
 */
@Injectable({ providedIn: 'root' })
export class UiTourAnchors {
  private readonly doc = inject(DOCUMENT);
  private readonly anchors = new Map<string, Set<HTMLElement>>();

  /** Adds an element under an id; returns the function that removes it. */
  register(id: string, el: HTMLElement): () => void {
    let set = this.anchors.get(id);
    if (!set) this.anchors.set(id, (set = new Set()));
    set.add(el);
    return () => {
      set!.delete(el);
      if (!set!.size && this.anchors.get(id) === set) this.anchors.delete(id);
    };
  }

  /** The element for an anchor id that is on the page and drawn (has a size), or null. */
  find(id: string): HTMLElement | null {
    for (const el of this.anchors.get(id) ?? []) {
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (this.doc.defaultView?.getComputedStyle(el).visibility === 'hidden') continue;
      return el;
    }
    return null;
  }
}

/**
 * `uiTourAnchor`: marks an element as a tour step's target, by a shared id
 * (`<a uiTourAnchor="nav.feed">`). Several elements may share an id; the first one on screen wins.
 * An empty, null or undefined id registers nothing, so library components can bind an optional
 * anchor (`ui-bottom-nav` items, `ui-tab`) without changing anything when it isn't set.
 * Also exported from `@zouriel/ui/guidance`, next to `UiTourService`.
 */
@Directive({ selector: '[uiTourAnchor]' })
export class UiTourAnchor {
  readonly id = input.required<string | null | undefined>({ alias: 'uiTourAnchor' });

  constructor() {
    const anchors = inject(UiTourAnchors);
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let off: (() => void) | null = null;
    // Registered under its id, again whenever the id changes.
    effect(() => {
      const id = this.id();
      untracked(() => {
        off?.();
        off = id ? anchors.register(id, host) : null;
      });
    });
    inject(DestroyRef).onDestroy(() => off?.());
  }
}
