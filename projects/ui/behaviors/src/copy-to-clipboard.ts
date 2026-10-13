import { DOCUMENT } from '@angular/common';
import { Directive, inject, input, output, signal } from '@angular/core';

/**
 * `uiCopyToClipboard` — copies the bound text to the clipboard on click and
 * exposes a transient `copied` state. Emits `(copied)` / `(copyFailed)`.
 */
@Directive({
  selector: '[uiCopyToClipboard]',
  exportAs: 'uiCopy',
  host: { '(click)': 'copy()', '[attr.data-copied]': 'copied() || null' },
})
export class UiCopyToClipboard {
  private doc = inject(DOCUMENT);
  text = input<string>('', { alias: 'uiCopyToClipboard' });
  readonly copied = signal(false);
  copyEvent = output<string>({ alias: 'copied' });
  copyFailed = output<unknown>();

  async copy(): Promise<void> {
    const value = this.text();
    try {
      await this.doc.defaultView?.navigator.clipboard.writeText(value);
      this.copied.set(true);
      this.announce('Copied to clipboard');
      this.copyEvent.emit(value);
      setTimeout(() => this.copied.set(false), 1500);
    } catch (err) {
      this.announce('Couldn’t copy. Select the text and copy it manually.');
      this.copyFailed.emit(err);
    }
  }

  /** One shared, visually hidden polite live region, so the result is spoken and not just styled. */
  private announce(message: string): void {
    const id = 'ui-copy-live';
    let region = this.doc.getElementById(id);
    if (!region) {
      region = this.doc.createElement('div');
      region.id = id;
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('role', 'status');
      region.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';
      this.doc.body.appendChild(region);
    }
    region.textContent = '';
    setTimeout(() => (region!.textContent = message), 50);
  }
}
