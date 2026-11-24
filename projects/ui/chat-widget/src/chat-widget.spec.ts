import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { UiChatBubble } from '@zouriel/ui/chat-bubble';
import {
  UiChatActions,
  UiChatComposer,
  UiChatSource,
  UiChatTyping,
  UiChatWidget,
  type UiChatAction,
  type UiChatHeadPosition,
  type UiChatLauncher,
  type UiChatPosition,
} from './public-api';

// The placement tests set the window size; put the real one back so later specs keep a desktop window.
const realViewport = {
  width: Object.getOwnPropertyDescriptor(window, 'innerWidth'),
  height: Object.getOwnPropertyDescriptor(window, 'innerHeight'),
};
const restoreViewport = () => {
  if (realViewport.width) Object.defineProperty(window, 'innerWidth', realViewport.width);
  if (realViewport.height) Object.defineProperty(window, 'innerHeight', realViewport.height);
};
const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
};

@Component({
  imports: [UiChatWidget, UiChatBubble, UiChatComposer, UiChatTyping, UiChatActions, UiChatSource],
  template: `
    <ui-chat-widget
      [(open)]="open"
      [position]="position()"
      [unread]="unread()"
      [launcher]="launcher()"
      [dismissible]="dismissible()"
      title="Help Assistant"
      subtitle="Usually replies instantly"
      notice="Answers come from an AI and cite their source."
      launcherLabel="Open assistant"
      closeLabel="Close assistant"
      label="Ask the Assistant"
      hint="Questions, or help"
      [teaser]="teaser()"
      (dismissed)="dismissedCount = dismissedCount + 1"
      (teaserDismissed)="teaserDismissedCount = teaserDismissedCount + 1"
      (positionChange)="lastPos = $event"
    >
      <button chat-header-actions type="button" id="hdr-act">Help</button>
      <ui-chat-bubble>
        Hello!
        <ui-chat-source label="Guide" href="https://example.com/guide" />
        <ui-chat-source label="Local note" />
      </ui-chat-bubble>
      <ui-chat-typing />
      <div chat-quick-actions>
        <ui-chat-actions [actions]="actions()" [disabled]="actionsDisabled()" (pick)="picked = $event" />
      </div>
      <div chat-footer>
        <ui-chat-composer
          [attach]="true"
          accept=".pdf"
          [multiple]="true"
          [disabled]="composerDisabled()"
          [busy]="composerBusy()"
          (send)="sent.push($event)"
          (files)="pickedFiles = $event"
        />
      </div>
    </ui-chat-widget>
  `,
})
class Host {
  readonly open = signal(false);
  readonly position = signal<UiChatPosition>('end');
  readonly unread = signal(2);
  readonly launcher = signal<UiChatLauncher>('floating');
  readonly teaser = signal('Hi there!');
  readonly actions = signal<UiChatAction[]>([
    { id: 'fill', label: 'Fill It In' },
    { id: 'open', label: 'Open Form' },
  ]);
  readonly actionsDisabled = signal(false);
  readonly composerDisabled = signal(false);
  readonly composerBusy = signal(false);
  picked = '';
  sent: string[] = [];
  pickedFiles: File[] = [];
  readonly dismissible = signal(true);
  dismissedCount = 0;
  teaserDismissedCount = 0;
  lastPos: UiChatHeadPosition | null = null;
}

describe('ui-chat-widget & pieces', () => {
  it('renders floating launcher, unread badge, and dismissible teaser', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    const launcher = el.querySelector('.launcher') as HTMLButtonElement;
    expect(launcher.getAttribute('aria-label')).toBe('Open assistant');
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.badge')!.textContent!.trim()).toBe('2');
    expect(el.querySelector('.teaser')!.textContent).toContain('Hi there!');

    (el.querySelector('.teaser button') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('.teaser')).toBeNull();
    expect(f.componentInstance.teaserDismissedCount).toBe(1);
  });

  it('opens dialog, moves focus, and closes on Escape', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const launcher = el.querySelector('.launcher') as HTMLButtonElement;
    launcher.click();
    f.detectChanges();
    await Promise.resolve();

    expect(f.componentInstance.open()).toBe(true);
    const panel = el.querySelector('.panel') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.getAttribute('role')).toBe('dialog');
    const titleId = panel.getAttribute('aria-labelledby')!;
    expect(el.querySelector(`#${titleId}`)!.textContent).toBe('Help Assistant');
    expect(el.querySelector('.notice')!.textContent).toContain('Answers come from an AI');
    expect(el.querySelector('#hdr-act')).toBeTruthy();
    expect(document.activeElement).toBe(panel);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f.detectChanges();
    await Promise.resolve();
    expect(f.componentInstance.open()).toBe(false);
    expect(el.querySelector('.panel')).toBeNull();
    expect(document.activeElement).toBe(launcher);
  });

  it('supports position="start" and hover pill mode', () => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.position.set('start');
    f.componentInstance.launcher.set('hover');
    f.detectChanges();
    const widget = (f.nativeElement as HTMLElement).querySelector('ui-chat-widget')!;
    expect(widget.classList.contains('at-start')).toBe(true);
    const pill = widget.querySelector('.launcher.pill')!;
    expect(pill).toBeTruthy();
    expect(pill.querySelector('.pill-copy b')!.textContent).toBe('Ask the Assistant');
    expect(pill.querySelector('.pill-copy small')!.textContent).toBe('Questions, or help');
  });

  it('supports draggable mode keyboard movement (Alt+Arrow)', () => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.launcher.set('draggable');
    f.detectChanges();
    const launcher = (f.nativeElement as HTMLElement).querySelector('.launcher') as HTMLButtonElement;
    launcher.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true }));
    f.detectChanges();
    expect(f.componentInstance.lastPos?.x).toBe(16);

    launcher.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true }));
    f.detectChanges();
    expect(f.componentInstance.lastPos?.y).toBe(16);
  });

  describe('draggable panel placement (desktop)', () => {
    afterEach(restoreViewport);

    const openWithHeadAt = (key: 'ArrowUp' | 'ArrowDown') => {
      setViewport(1280, 900);
      const f = TestBed.createComponent(Host);
      f.componentInstance.launcher.set('draggable');
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      el.querySelector('.launcher')!.dispatchEvent(new KeyboardEvent('keydown', { key, altKey: true }));
      f.componentInstance.open.set(true);
      f.detectChanges();
      return el.querySelector('.panel') as HTMLElement;
    };

    it('opens downward from a bubble near the top, so the panel stays on screen', () => {
      const panel = openWithHeadAt('ArrowUp');
      expect(panel.classList).toContain('opens-down');
      expect(panel.style.top).toBe('16px');
      expect(panel.style.bottom).toBe('');
    });

    it('opens upward from a bubble near the bottom, its bottom level with the bubble', () => {
      const panel = openWithHeadAt('ArrowDown');
      expect(panel.classList).not.toContain('opens-down');
      // bubble at y 820 (900 - 80), 64 tall; panel 600 tall (min(600, 900 - 112)) ends at 884
      expect(panel.style.top).toBe('284px');
    });
  });

  describe('draggable drop-to-dismiss', () => {
    afterEach(restoreViewport);

    // Window 1280 x 900: the bubble starts at (1200, 820); the X drop zone is centred at (640, 844).
    const setup = (dismissible: boolean) => {
      setViewport(1280, 900);
      const f = TestBed.createComponent(Host);
      f.componentInstance.launcher.set('draggable');
      f.componentInstance.dismissible.set(dismissible);
      f.detectChanges();
      return f;
    };
    const dragToX = (f: ReturnType<typeof setup>) => {
      const launcher = (f.nativeElement as HTMLElement).querySelector('.launcher')!;
      launcher.dispatchEvent(new PointerEvent('pointerdown', { clientX: 1232, clientY: 852, pointerId: 1 }));
      launcher.dispatchEvent(new PointerEvent('pointermove', { clientX: 640, clientY: 844, pointerId: 1 }));
      f.detectChanges();
      const dropShown = !!(f.nativeElement as HTMLElement).querySelector('.drop');
      launcher.dispatchEvent(new PointerEvent('pointerup', { clientX: 640, clientY: 844, pointerId: 1 }));
      f.detectChanges();
      return dropShown;
    };

    it('hides the bubble on the X, and opening from the page brings it back to its corner', () => {
      const f = setup(true);
      expect(dragToX(f)).toBe(true);
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('.launcher')).toBeNull();
      expect(f.componentInstance.dismissedCount).toBe(1);

      f.componentInstance.open.set(true);
      f.detectChanges();
      const launcher = el.querySelector('.launcher') as HTMLElement;
      expect(launcher).not.toBeNull();
      expect(launcher.style.left).toBe('1200px');
      expect(launcher.style.top).toBe('820px');
    });

    it('with dismissible off, shows no X and keeps the bubble when dropped there', () => {
      const f = setup(false);
      expect(dragToX(f)).toBe(false);
      expect((f.nativeElement as HTMLElement).querySelector('.launcher')).not.toBeNull();
      expect(f.componentInstance.dismissedCount).toBe(0);
    });
  });

  it('renders typing indicator, quick actions, and sources', () => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.open.set(true);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    const typing = el.querySelector('ui-chat-typing')!;
    expect(typing.getAttribute('role')).toBe('status');
    expect(typing.getAttribute('aria-live')).toBe('polite');
    expect(typing.querySelectorAll('span').length).toBe(3);

    const srcLink = el.querySelector('ui-chat-source a') as HTMLAnchorElement;
    expect(srcLink.getAttribute('href')).toBe('https://example.com/guide');
    expect(el.querySelector('ui-chat-source .plain')!.textContent).toContain('Local note');

    const chips = el.querySelectorAll('ui-chat-actions button');
    expect(chips.length).toBe(2);
    (chips[0] as HTMLButtonElement).click();
    expect(f.componentInstance.picked).toBe('fill');

    f.componentInstance.actionsDisabled.set(true);
    f.detectChanges();
    expect((chips[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('composer sends trimmed text on Enter, keeps newline on Shift+Enter, and clears', () => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.open.set(true);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const box = el.querySelector('ui-chat-composer textarea') as HTMLTextAreaElement;
    const send = el.querySelector('ui-chat-composer .send') as HTMLButtonElement;

    expect(box.getAttribute('dir')).toBe('auto');
    expect(send.disabled).toBe(true);

    box.value = '  Hello council  ';
    box.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(send.disabled).toBe(false);

    // Shift+Enter does not submit
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    expect(f.componentInstance.sent).toEqual([]);

    // Enter submits and clears
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    f.detectChanges();
    expect(f.componentInstance.sent).toEqual(['Hello council']);
    expect(box.value).toBe('');
    expect(send.disabled).toBe(true);
  });
});
