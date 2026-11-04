import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { provideUiStrings } from '@zouriel/ui';
import { UiContactChannels, type UiEmailStatus, type UiMessengerChannel } from './contact-channels';
import type { UiMessengerApp } from './messenger-brand';

/*
 * Behaviour and structure here; the real layout (columns lining up, the buttons fitting at 360px,
 * centring) is measured in Chromium by projects/showcase/audit/messenger.mjs (npm run audit:messenger).
 */

@Component({
  imports: [UiContactChannels],
  template: `
    <ui-contact-channels [email]="email()" [emailStatus]="status()" [emailTickLabel]="tick()" [emailError]="error()" [emailBusy]="busy()"
      [phone]="phone()" [messengers]="messengers()" (emailSend)="log.push('send')" (emailRetry)="log.push('retry')"
      (messengerPress)="log.push($event)" />`,
})
class Host {
  email = signal<string | null>('aisha.ibrahim@example.com');
  status = signal<UiEmailStatus>('sent');
  tick = signal<string | undefined>('Emailed 4 Nov, 7:02 pm');
  error = signal<string | undefined>(undefined);
  busy = signal(false);
  phone = signal<string | null>('+960 777 1234');
  messengers = signal<UiMessengerChannel[]>([
    { app: 'whatsapp', ticked: true, tickLabel: 'Opened in WhatsApp · 3:14 pm', ariaLabel: 'Send to Aisha on WhatsApp' },
    { app: 'viber', ariaLabel: 'Send to Aisha on Viber' },
    { app: 'telegram', ariaLabel: 'Send to Aisha on Telegram' },
  ]);
  log: (string | UiMessengerApp)[] = [];
}

function make() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return { f, h: f.componentInstance, el, q: (s: string) => el.querySelector(s) as HTMLElement | null, qa: (s: string) => [...el.querySelectorAll(s)] as HTMLElement[] };
}

/** The compiled styles as selector -> declarations. */
const rule = (() => {
  const css = ((UiContactChannels as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');
  const map = new Map<string, string>();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].replace(/\[_nghost-[^\]]*\]/g, ':host').replace(/\[_ngcontent-[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    map.set(sel, (map.get(sel) ?? '') + m[2].replace(/\s+/g, ' ').trim());
  }
  return (sel: string) => map.get(sel) ?? '';
})();

describe('ui-contact-channels', () => {
  it('lays every row on one three-column grid: label, value, status', () => {
    expect(rule('.cc')).toMatch(/display: grid/);
    expect(rule('.cc')).toMatch(/grid-template-columns: minmax\(64px, max-content\) minmax\(0, 1fr\) minmax\(var\(--ui-size-touch\), max-content\)/);
    expect(rule('.lbl')).toMatch(/grid-column: 1/);
    expect(rule('.val')).toMatch(/grid-column: 2/);
    expect(rule('.val')).toMatch(/text-overflow: ellipsis/);
    expect(rule('.status')).toMatch(/grid-column: 3/);
    // The number spans value + status; the buttons start at the value column.
    expect(rule('.val.wide')).toMatch(/grid-column: 2 \/ -1/);
    expect(rule('.apps')).toMatch(/grid-column: 2 \/ -1/);
    expect(rule('.err')).toMatch(/grid-column: 2 \/ -1/);
  });

  it('shows email, number and the buttons in order, with labels from the library strings', () => {
    const { qa, q } = make();
    expect(qa('.lbl').map((e) => e.textContent!.trim())).toEqual(['Email', 'Number']);
    expect(qa('.val').map((e) => e.textContent!.trim())).toEqual(['aisha.ibrahim@example.com', '+960 777 1234']);
    expect(q('.val[data-row="email"]')!.getAttribute('title')).toBe('aisha.ibrahim@example.com');
    const buttons = qa('.apps ui-messenger-button button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Send to Aisha on WhatsApp, Opened in WhatsApp · 3:14 pm',
      'Send to Aisha on Viber',
      'Send to Aisha on Telegram',
    ]);
    expect(q('.apps')!.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
    // Expanded, and icon-only by themselves when narrow.
    expect(qa('.apps ui-messenger-button').every((b) => b.classList.contains('expand'))).toBe(true);
    expect(buttons.every((b) => b.classList.contains('auto'))).toBe(true);
  });

  it('ticks a sent or delivered email, named by its tick label', () => {
    const { f, h, q } = make();
    const tick = q('.status .tick')!;
    expect(tick.getAttribute('role')).toBe('img');
    expect(tick.getAttribute('aria-label')).toBe('Emailed 4 Nov, 7:02 pm');
    h.status.set('delivered');
    h.tick.set(undefined);
    f.detectChanges();
    expect(q('.status .tick')!.getAttribute('aria-label')).toBe('Sent');
    expect(q('.status ui-button')).toBeNull();
  });

  it('offers Retry with the error under the row when the email failed or bounced', () => {
    const { f, h, q, el } = make();
    for (const s of ['failed', 'bounced'] as const) {
      h.status.set(s);
      h.error.set('Mailbox full');
      f.detectChanges();
      const err = q('.err')!;
      expect(err.textContent!.trim()).toBe('Mailbox full');
      const retry = q('.status ui-button button') as HTMLButtonElement;
      expect(retry.textContent!.trim()).toBe('Retry');
      expect(retry.getAttribute('aria-describedby')).toBe(err.id);
      retry.click();
    }
    expect(h.log).toEqual(['retry', 'retry']);
    expect(el.querySelector('.status .tick')).toBeNull();
  });

  it('offers Send when not sent, and a spinner while busy', () => {
    const { f, h, q } = make();
    for (const s of ['none', 'skipped'] as const) {
      h.status.set(s);
      f.detectChanges();
      const send = q('.status ui-button button') as HTMLButtonElement;
      expect(send.textContent!.trim()).toBe('Send');
      send.click();
    }
    expect(h.log).toEqual(['send', 'send']);
    h.busy.set(true);
    f.detectChanges();
    expect(q('.status ui-spinner')).not.toBeNull();
    expect(q('.status ui-button')).toBeNull();
  });

  it('reports which messenger was pressed; ticked buttons still press', () => {
    const { h, qa } = make();
    for (const b of qa('.apps ui-messenger-button button')) b.click();
    expect(h.log).toEqual(['whatsapp', 'viber', 'telegram']);
  });

  it('leaves out rows without a value, and hidden messengers', () => {
    const { f, h, qa, q } = make();
    h.messengers.update((m) => m.map((x) => (x.app === 'viber' ? { ...x, hidden: true } : x)));
    f.detectChanges();
    expect(qa('.apps ui-messenger-button').length).toBe(2);
    expect(q('.apps')!.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    h.email.set(null);
    f.detectChanges();
    expect(qa('.lbl').map((e) => e.textContent!.trim())).toEqual(['Number']);
    h.phone.set('');
    f.detectChanges();
    expect(qa('.lbl')).toEqual([]);
    expect(q('.apps')).toBeNull();
  });

  it('takes its words from the library strings', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings({ contactEmail: 'E', contactNumber: 'N', contactRetry: 'Again' })] });
    const { f, h, qa, q } = make();
    h.status.set('failed');
    f.detectChanges();
    expect(qa('.lbl').map((e) => e.textContent!.trim())).toEqual(['E', 'N']);
    expect(q('.status ui-button')!.textContent!.trim()).toBe('Again');
  });
});
