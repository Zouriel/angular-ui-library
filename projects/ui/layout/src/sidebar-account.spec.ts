import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, onTestFinished } from 'vitest';
import type { UiStatus } from '@zouriel/ui';
import { UiMenu, type UiMenuItem } from '@zouriel/ui/overlay';
import { UiSidebarAccount } from './sidebar-account';
import { UiSidebarLayout } from './sidebar-layout';

@Component({
  imports: [UiSidebarAccount],
  template: `
    <div [attr.dir]="dir()">
      <ui-sidebar-account
        [name]="name()"
        [subtitle]="subtitle()"
        [src]="src()"
        [badge]="badge()"
        [badgeTone]="tone()"
        [hint]="hint()"
        [showChevron]="chevron()"
        [disabled]="disabled()"
        [collapsed]="collapsed()"
        (activate)="presses = presses + 1"
      />
    </div>
  `,
})
class Host {
  readonly name = signal('Aishath Mohamed Ibrahim');
  readonly subtitle = signal<string | null>('Clerk · Secretariat');
  readonly src = signal<string | null>(null);
  readonly badge = signal<string | null>(null);
  readonly tone = signal<UiStatus>('neutral');
  readonly hint = signal<string | null>(null);
  readonly chevron = signal(true);
  readonly disabled = signal(false);
  readonly collapsed = signal(false);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  presses = 0;
}

@Component({
  imports: [UiSidebarAccount, UiMenu],
  template: `
    <ui-menu block [items]="items" [(open)]="open" (select)="picked = $event.value">
      <ui-sidebar-account menu-trigger name="Ali Hassan" subtitle="Director" />
    </ui-menu>
  `,
})
class MenuHost {
  items: UiMenuItem[] = [
    { label: 'Profile', value: 'profile' },
    { label: 'Sign out', value: 'out', danger: true },
  ];
  readonly open = signal(false);
  picked = '';
}

@Component({
  imports: [UiSidebarAccount, UiSidebarLayout],
  template: `
    <ui-sidebar-layout mainLandmark="false">
      <nav sidebar>nav</nav>
      <ui-sidebar-account sidebar-footer name="Ali Hassan" subtitle="Director" />
      <p>page</p>
    </ui-sidebar-layout>
  `,
})
class LayoutHost {}

describe('UiSidebarAccount', () => {
  afterEach(() =>
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')),
  );

  const make = () => {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const button = () => el.querySelector<HTMLButtonElement>('button.acct')!;
    const set = (fn: (h: Host) => void) => {
      fn(f.componentInstance);
      f.detectChanges();
    };
    return { f, el, button, set, host: f.componentInstance };
  };

  it('renders the avatar, name, subtitle and chevron inside one native button', () => {
    const { el, button } = make();
    expect(el.querySelectorAll('button')).toHaveLength(1);
    expect(button().type).toBe('button');
    expect(button().querySelector('ui-avatar')).not.toBeNull();
    expect(button().querySelector('.name')!.textContent!.trim()).toBe('Aishath Mohamed Ibrahim');
    expect(button().querySelector('.sub')!.textContent!.trim()).toBe('Clerk · Secretariat');
    expect(button().querySelector('hugeicons-icon.chev')).not.toBeNull();
  });

  it('falls back to initials without an image and shows the image when given one', () => {
    const { button, set } = make();
    expect(button().querySelector('.initials')!.textContent!.trim()).toBe('AI');
    expect(button().querySelector('img')).toBeNull();
    set((h) => h.src.set('https://example.test/me.png'));
    expect(button().querySelector('img')!.getAttribute('src')).toBe('https://example.test/me.png');
  });

  it('is named by the name, subtitle and badge, and described by the hint', () => {
    const { button, set } = make();
    expect(button().getAttribute('aria-label')).toBe(
      'Aishath Mohamed Ibrahim, Clerk · Secretariat',
    );
    expect(button().hasAttribute('aria-describedby')).toBe(false);
    set((h) => {
      h.badge.set('Read-only');
      h.hint.set('Switch test account');
    });
    expect(button().getAttribute('aria-label')).toBe(
      'Aishath Mohamed Ibrahim, Clerk · Secretariat, Read-only',
    );
    const hint = document.getElementById(button().getAttribute('aria-describedby')!)!;
    expect(hint.textContent!.trim()).toBe('Switch test account');
    // The visible text is not read twice on top of the label.
    expect(button().querySelector('.text')!.getAttribute('aria-hidden')).toBe('true');
    expect(button().querySelector('ui-avatar')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('leaves out an empty subtitle', () => {
    const { button, set } = make();
    set((h) => h.subtitle.set(null));
    expect(button().getAttribute('aria-label')).toBe('Aishath Mohamed Ibrahim');
    expect(button().querySelector('.sub')).toBeNull();
  });

  it('shows the badge in its tone', () => {
    const { button, set } = make();
    expect(button().querySelector('ui-badge')).toBeNull();
    set((h) => {
      h.badge.set('Read-only');
      h.tone.set('warning');
    });
    const badge = button().querySelector('ui-badge .ui-badge')!;
    expect(badge.textContent!.trim()).toBe('Read-only');
    expect(badge.getAttribute('data-tone')).toBe('warning');
  });

  it('emits activate when pressed; it is a focusable native button, so Enter and Space press it', () => {
    const { button, host } = make();
    button().focus();
    expect(document.activeElement).toBe(button());
    button().click();
    expect(host.presses).toBe(1);
  });

  it('does not emit while disabled, and emits again once enabled', () => {
    const { button, host, set } = make();
    set((h) => h.disabled.set(true));
    expect(button().disabled).toBe(true);
    button().click();
    expect(host.presses).toBe(0);
    set((h) => h.disabled.set(false));
    button().click();
    expect(host.presses).toBe(1);
  });

  it('hides the chevron when told to', () => {
    const { button, set } = make();
    set((h) => h.chevron.set(false));
    expect(button().querySelector('.chev')).toBeNull();
    expect(button().querySelector('.name')).not.toBeNull();
  });

  it('collapsed: only the avatar, keeps its name, and shows the label as a tooltip on hover', () => {
    const { f, el, button, set } = make();
    const wrap = () => el.querySelector<HTMLElement>('.wrap')!;
    wrap().dispatchEvent(new MouseEvent('mouseenter'));
    f.detectChanges();
    expect(document.querySelector('.ui-tooltip')).toBeNull();
    wrap().dispatchEvent(new MouseEvent('mouseleave'));

    set((h) => {
      h.collapsed.set(true);
      h.hint.set('Switch test account');
    });
    expect(el.querySelector('ui-sidebar-account')!.classList.contains('ui-collapsed')).toBe(true);
    expect(button().querySelector('ui-avatar')).not.toBeNull();
    expect(button().querySelector('.text')).toBeNull();
    expect(button().querySelector('.chev')).toBeNull();
    expect(button().getAttribute('aria-label')).toBe(
      'Aishath Mohamed Ibrahim, Clerk · Secretariat',
    );
    expect(button().hasAttribute('aria-describedby')).toBe(false);
    wrap().dispatchEvent(new MouseEvent('mouseenter'));
    f.detectChanges();
    expect(document.querySelector('.ui-tooltip')!.textContent).toBe(
      'Aishath Mohamed Ibrahim, Clerk · Secretariat',
    );
    wrap().dispatchEvent(new MouseEvent('mouseleave'));
  });

  it('ellipsizes long names and subtitles instead of wrapping', () => {
    const styles = (UiSidebarAccount as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join(
      '\n',
    );
    for (const sel of ['.name', '.line']) {
      const rule = styles.match(new RegExp(`\\${sel}\\[[^\\]]+\\]\\s*\\{([^}]*)\\}`))![1];
      expect(rule).toContain('text-overflow: ellipsis');
      expect(rule).toContain('white-space: nowrap');
    }
    expect(styles).toMatch(/\.text\[[^\]]+\]\s*\{[^}]*min-width: 0/);
  });

  it('works right to left: logical alignment only, the same button and label', () => {
    const { button, set } = make();
    set((h) => h.dir.set('rtl'));
    expect(button().closest('[dir="rtl"]')).not.toBeNull();
    expect(button().getAttribute('aria-label')).toBe(
      'Aishath Mohamed Ibrahim, Clerk · Secretariat',
    );
    const styles = (UiSidebarAccount as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join(
      '\n',
    );
    expect(styles).toContain('text-align: start');
    expect(styles).not.toMatch(/text-align: (left|right)|margin-(left|right)|padding-(left|right)/);
  });

  it('is a ui-menu trigger: the button says it opens a menu, opens it and gets focus back', async () => {
    const f = TestBed.createComponent(MenuHost);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const button = el.querySelector<HTMLButtonElement>('ui-sidebar-account button')!;
    const settle = async () => {
      f.detectChanges();
      await f.whenStable();
    };
    expect(el.querySelector('ui-menu')!.classList.contains('ui-block')).toBe(true);
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    await settle();
    expect(f.componentInstance.open()).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    document.querySelectorAll<HTMLButtonElement>('.ui-menu .item')[1].click();
    await settle();
    expect(f.componentInstance.picked).toBe('out');
    expect(f.componentInstance.open()).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it('sits in the sidebar footer of ui-sidebar-layout', () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    onTestFinished(() => {
      window.matchMedia = original;
    });
    const f = TestBed.createComponent(LayoutHost);
    f.detectChanges();
    const footer = (f.nativeElement as HTMLElement).querySelector('.sb-ft')!;
    expect(footer.querySelector('ui-sidebar-account button.acct')).not.toBeNull();
  });
});
