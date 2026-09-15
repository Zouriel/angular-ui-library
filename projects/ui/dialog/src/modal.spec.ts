import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { UiDrawer } from './drawer';
import { UiModal } from './modal';

/**
 * The layer a dialog moves to the end of `<body>`.
 *
 * <p>Moving it out of the host is what lets it escape transformed ancestors, and also what Angular
 * can't see: destroying the owner removes the host, not the layer. The regression this guards is a
 * page navigating away with a modal open and leaving a backdrop over the next page, with the body
 * still unable to scroll.</p>
 */
@Component({
  imports: [UiModal, UiDrawer],
  template: `
    <ui-modal [(open)]="modal" title="Modal"><p>Body</p></ui-modal>
    <ui-drawer [(open)]="drawer" title="Drawer"><p>Body</p></ui-drawer>
  `,
})
class Host {
  modal = signal(false);
  drawer = signal(false);
}

describe('UiModal / UiDrawer layer', () => {
  const layers = () => document.body.querySelectorAll(':scope > .ui-layer').length;

  afterEach(() => {
    document.body.style.overflow = '';
  });

  async function open(which: Partial<Pick<Host, 'modal' | 'drawer'>> & object, set: ('modal' | 'drawer')[]) {
    const fixture = TestBed.createComponent(Host);
    for (const key of set) fixture.componentInstance[key].set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('moves an open modal to body and removes it when the host is destroyed', async () => {
    const fixture = await open({}, ['modal']);
    expect(layers()).toBe(1);
    expect(document.body.style.overflow).toBe('hidden');

    fixture.destroy();

    expect(layers()).toBe(0);
    expect(document.body.style.overflow).toBe('');
  });

  it('removes an open drawer when the host is destroyed', async () => {
    const fixture = await open({}, ['drawer']);
    expect(layers()).toBe(1);

    fixture.destroy();

    expect(layers()).toBe(0);
    expect(document.body.style.overflow).toBe('');
  });

  it('removes the layer on a normal close', async () => {
    const fixture = await open({}, ['modal']);
    fixture.componentInstance.modal.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    // Leave animations never finish in jsdom's missing layout; give Angular's fallback a moment.
    await new Promise((r) => setTimeout(r, 50));

    expect(layers()).toBe(0);
    expect(document.body.style.overflow).toBe('');
    fixture.destroy();
  });

  it('keeps the body locked while another dialog is still open', async () => {
    const fixture = await open({}, ['modal', 'drawer']);
    expect(layers()).toBe(2);

    fixture.componentInstance.modal.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.componentInstance.drawer.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.body.style.overflow).toBe('');
    fixture.destroy();
  });

  it('restores the overflow the page had before', async () => {
    document.body.style.overflow = 'clip';
    const fixture = await open({}, ['modal']);
    expect(document.body.style.overflow).toBe('hidden');
    fixture.destroy();
    expect(document.body.style.overflow).toBe('clip');
  });
});
