import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createDefinition } from './definition';
import { sourcesFromSettings, type UiFormGlobalSettings } from './global-settings';
import { UiFormGlobalSettingsEditor } from './global-settings-editor';
import {
  fillPattern, httpOptionSource, originAllowed, provideUiFormHttpSources, readSourceReply, sourceUrl, type UiFbHttpSourceConfig,
} from './http-sources';

const users: UiFbHttpSourceConfig = {
  type: 'users', label: 'Users', url: 'https://dummy.test/users/search',
  paging: 'offset', pageParam: 'skip', pageSizeParam: 'limit', pageSize: 2,
  itemsPath: 'users', valueField: 'id', labelField: '{firstName} {lastName}', descriptionField: 'email', totalPath: 'total',
};
const reply = { users: [{ id: 1, firstName: 'Aminath', lastName: 'Shareef', email: 'a@x.mv' }, { id: 2, firstName: 'Ali', lastName: 'Zahir', email: 'z@x.mv' }], total: 30 };

describe('lists set up in settings', () => {
  it('builds the request for page numbers or skip/limit, adding the search and settings', () => {
    expect(sourceUrl(users, { query: 'ami', page: 3, pageSize: 2, params: {} })).toBe('https://dummy.test/users/search?q=ami&skip=4&limit=2');
    const paged: UiFbHttpSourceConfig = { type: 'c', label: 'C', url: 'https://api.test/courses', firstPage: 0, valueField: 'id', labelField: 'name' };
    expect(sourceUrl(paged, { query: '', page: 1, pageSize: 20, params: { faculty: 'health' } })).toBe('https://api.test/courses?page=0&pageSize=20&faculty=health');
  });

  it('reads items, combined labels and totals from the reply, and explains a reply that does not match', () => {
    expect(readSourceReply(users, reply, 2)).toEqual({
      items: [{ value: 1, label: 'Aminath Shareef', description: 'a@x.mv' }, { value: 2, label: 'Ali Zahir', description: 'z@x.mv' }], total: 30, hasMore: undefined,
    });
    expect(fillPattern({ a: { b: 'deep' } }, 'a.b')).toBe('deep');
    expect(() => readSourceReply({ ...users, itemsPath: 'data' }, reply, 2)).toThrow('No list at “data” in the reply (it has: users, total).');
    expect(() => readSourceReply({ ...users, valueField: 'uuid' }, reply, 2)).toThrow('No “uuid” field in the items.');
  });

  it('only calls allowed servers, through the app’s hook', async () => {
    expect(originAllowed('https://dummy.test/x', ['https://dummy.test'])).toBe(true);
    expect(originAllowed('https://evil.test/x', ['https://dummy.test'])).toBe(false);
    const seen: string[] = [];
    const src = httpOptionSource(users, { allowedOrigins: ['https://dummy.test'], fetch: async (url) => { seen.push(url); return reply; } });
    const page = await src.search({ query: '', page: 1, pageSize: 2, params: {}, signal: new AbortController().signal });
    expect(page.items.map((i) => i.label)).toEqual(['Aminath Shareef', 'Ali Zahir']);
    expect(seen).toEqual(['https://dummy.test/users/search?skip=0&limit=2']);
    const blocked = httpOptionSource({ ...users, url: 'https://evil.test/users' }, { allowedOrigins: ['https://dummy.test'], fetch: async () => reply });
    await expect(blocked.search({ query: '', page: 1, pageSize: 2, params: {}, signal: new AbortController().signal })).rejects.toThrow('doesn’t allow lists from https://evil.test');
    expect(sourcesFromSettings({ version: 1, sources: [users, { ...users, type: '', url: '' }] }).map((s) => s.type)).toEqual(['users']);
  });

  it('starts new forms with the app’s defaults', () => {
    expect(createDefinition('New', { labelPlacement: 'inside', validateOn: 'submit' }).settings).toEqual({ labelPlacement: 'inside', validateOn: 'submit' });
    expect(createDefinition('New').settings).toEqual({});
  });
});

@Component({
  imports: [UiFormGlobalSettingsEditor],
  providers: [provideUiFormHttpSources({ allowedOrigins: ['https://dummy.test'], fetch: async () => reply })],
  template: `<ui-form-global-settings [(settings)]="settings" [usage]="usage" />`,
})
class SettingsHost {
  settings = signal<UiFormGlobalSettings>({ version: 1, sources: [], defaults: {} });
  usage: Record<string, number> = {};
}

describe('ui-form-global-settings', () => {
  function render() {
    const fx = TestBed.createComponent(SettingsHost);
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    const button = (text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim().includes(text))!;
    const inputByPlaceholder = (ph: string) => el.querySelector<HTMLInputElement>(`input[placeholder^="${ph}"]`)!;
    const type = async (input: HTMLInputElement, v: string) => { input.value = v; input.dispatchEvent(new Event('input')); await fx.whenStable(); fx.detectChanges(); };
    return { fx, el, host: fx.componentInstance, button, inputByPlaceholder, type };
  }

  it('adds a list whose key follows its name, maps the reply, and tests it the way forms will', async () => {
    const { fx, el, host, button, inputByPlaceholder, type } = render();
    button('Add a list').click();
    fx.detectChanges();
    await type(inputByPlaceholder('e.g. Students'), 'Student records');
    expect(host.settings().sources![0].type).toBe('student_records');
    await type(inputByPlaceholder('https://api.example.com'), 'https://dummy.test/users/search');
    await type(inputByPlaceholder('Empty when'), 'users');
    await type(inputByPlaceholder('name, or'), '{firstName} {lastName}');
    expect(el.textContent).toContain('A search asks:');
    button('Run test').click();
    await fx.whenStable();
    fx.detectChanges();
    expect(el.querySelector('.res-msg')!.textContent).toContain('Works');
    expect(Array.from(el.querySelectorAll('.items td')).map((t) => t.textContent!.trim())).toContain('Aminath Shareef');
    expect(el.textContent).toContain('Fields in each item:');
  });

  it('refuses an address the app doesn’t allow, and warns before deleting a list forms use', async () => {
    const { fx, el, host, button, inputByPlaceholder, type } = render();
    host.usage = { 'list-1': 3 };
    button('Add a list').click();
    fx.detectChanges();
    await type(inputByPlaceholder('https://api.example.com'), 'https://evil.test/x');
    expect(el.textContent).toContain('This app doesn’t allow lists from https://evil.test');
    button('Delete').click();
    fx.detectChanges();
    expect(el.textContent).toContain('3 forms use this list.');
    expect(host.settings().sources!.length).toBe(1);
    button('Delete anyway').click();
    fx.detectChanges();
    expect(host.settings().sources!.length).toBe(0);
  });

  it('edits the defaults new forms start with', () => {
    const { fx, el, host } = render();
    const seg = Array.from(el.querySelectorAll<HTMLElement>('ui-segmented [role=radio], ui-segmented button')).find((b) => b.textContent!.includes('New form defaults'))!;
    seg.click();
    fx.detectChanges();
    const sel = el.querySelector<HTMLSelectElement>('ui-fb-settings-fields select')!;
    sel.value = 'inside';
    sel.dispatchEvent(new Event('change'));
    expect(host.settings().defaults).toEqual({ labelPlacement: 'inside' });
  });
});
