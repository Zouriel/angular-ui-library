import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiHandleField, uiCleanHandle, type UiHandleCheck } from './handle-field';

@Component({
  imports: [UiHandleField],
  template: `<ui-handle-field [(value)]="value" [check]="check" [debounceMs]="400" suggestion="mia.ali" hint="invites.blog/@yourname"
    (statusChange)="states.push($event.state)" />`,
})
class Host {
  value = signal('');
  calls: string[] = [];
  pending: { handle: string; resolve: (r: UiHandleCheck) => void; reject: (e: unknown) => void }[] = [];
  states: string[] = [];
  check = (handle: string) => {
    this.calls.push(handle);
    return new Promise<UiHandleCheck>((resolve, reject) => this.pending.push({ handle, resolve, reject }));
  };
}

describe('uiCleanHandle', () => {
  it('lower-cases, drops everything but a-z 0-9 . _ and caps the length', () => {
    expect(uiCleanHandle('Mia Ali-2026!@é._x')).toBe('miaali2026._x');
    expect(uiCleanHandle('abcdef', 4)).toBe('abcd');
  });
});

describe('UiHandleField', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function render() {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const input = f.nativeElement.querySelector('input') as HTMLInputElement;
    const status = () => (f.nativeElement.querySelector('.status') as HTMLElement).textContent!.trim();
    const type = (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
      f.detectChanges();
    };
    const flush = async () => {
      await Promise.resolve();
      await Promise.resolve();
      f.detectChanges();
    };
    return { f, input, status, type, flush, host: f.componentInstance };
  }

  it('filters what is typed or pasted and writes the value back', () => {
    const { input, type, host } = render();
    type('Mia Ali!');
    expect(input.value).toBe('miaali');
    expect(host.value()).toBe('miaali');
    type('x'.repeat(40));
    expect(host.value().length).toBe(30);
  });

  it('shows the hint when idle, and says too short without calling check', () => {
    const { status, type, host } = render();
    expect(status()).toContain('invites.blog/@yourname');
    type('ab');
    vi.advanceTimersByTime(1000);
    expect(status()).toContain('At least 3 letters or numbers');
    expect(host.calls).toEqual([]);
  });

  it('waits for a pause, then reports free or taken', async () => {
    const { status, type, flush, host } = render();
    type('mia');
    expect(status()).toContain('Checking');
    vi.advanceTimersByTime(399);
    expect(host.calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(host.calls).toEqual(['mia']);
    host.pending[0].resolve({ state: 'available' });
    await flush();
    expect(status()).toContain('@mia is free');
    type('ali');
    vi.advanceTimersByTime(400);
    host.pending[1].resolve({ state: 'taken', suggestion: 'ali2' });
    await flush();
    expect(status()).toContain('@ali is taken');
    expect(host.states).toEqual(['idle', 'checking', 'available', 'checking', 'taken']);
  });

  it('ignores a reply for an older value', async () => {
    const { status, type, flush, host } = render();
    type('first');
    vi.advanceTimersByTime(400);
    type('second');
    vi.advanceTimersByTime(400);
    host.pending[1].resolve({ state: 'available' });
    await flush();
    host.pending[0].resolve({ state: 'taken' });
    await flush();
    expect(status()).toContain('@second is free');
  });

  it('says it could not check when the check fails', async () => {
    const { status, type, flush, host } = render();
    type('mia');
    vi.advanceTimersByTime(400);
    host.pending[0].reject(new Error('offline'));
    await flush();
    expect(status()).toContain("Couldn't check. Try again.");
  });

  it('offers the suggestion while empty and a reply suggestion after; using it sets and checks it', async () => {
    const { f, type, flush, host } = render();
    const use = () => f.nativeElement.querySelector('button.use') as HTMLButtonElement | null;
    expect(use()!.textContent!.trim()).toBe('Use @mia.ali');
    type('ali');
    expect(use()).toBeNull();
    vi.advanceTimersByTime(400);
    host.pending[0].resolve({ state: 'taken', suggestion: 'ali2' });
    await flush();
    expect(use()!.textContent!.trim()).toBe('Use @ali2');
    use()!.click();
    f.detectChanges();
    vi.advanceTimersByTime(400);
    expect(host.value()).toBe('ali2');
    expect(host.calls).toEqual(['ali', 'ali2']);
  });
});
