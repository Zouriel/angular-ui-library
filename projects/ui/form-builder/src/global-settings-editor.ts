import { Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiInput, UiNumberInput, UiSwitch, UiTextarea } from '@zouriel/ui/form';
import { FB_ICONS } from './builder-icons';
import { FB_SHARED_STYLES } from './builder-styles';
import { fbSlug } from './definition';
import { createGlobalSettings, type UiFormGlobalSettings } from './global-settings';
import {
  UI_FB_HTTP_SOURCES, originAllowed, originOf, readPath, readSourceReply, sourceFetch, sourceUrl, type UiFbHttpSourceConfig,
} from './http-sources';
import { UI_FB_OPTION_SOURCES, type UiFbSourceItem, type UiFbSourceParamSpec } from './option-sources';
import type { UiFbSettings } from './schema';
import { FbSettingsFields } from './settings-fields';

type Section = 'sources' | 'defaults';

interface TestRun {
  url: string;
  ok: boolean;
  message: string;
  items: UiFbSourceItem[];
  /** Field names found in the first item, to help fill in the reply mapping. */
  fields: string[];
  raw: string;
}

/**
 * `ui-form-global-settings` — the app's form settings page: the lists every
 * form can search (where to ask, how it pages, how to read the reply, with a
 * test), and what new forms start with. Bind `[(settings)]` and store the JSON;
 * pass it to `ui-form-builder` and `ui-form-renderer` as `globalSettings`.
 *
 * Requests go through the app's hook (`provideUiFormHttpSources`), which adds
 * the login and limits which servers may be called. No secrets are stored here.
 */
@Component({
  selector: 'ui-form-global-settings',
  imports: [FormsModule, HugeiconsIconComponent, UiButton, UiSegmented, UiInput, UiNumberInput, UiSwitch, UiTextarea, FbSettingsFields],
  host: { class: 'ui-form-global-settings' },
  template: `
    <ui-segmented class="sections" size="sm" label="Settings section" [options]="sectionOptions" [value]="section()" (valueChange)="section.set($any($event))" />

    @if (section() === 'defaults') {
      <section class="pane defaults">
        <p class="intro">New forms start with these. Each form can change its own, and forms that already exist aren’t changed.</p>
        <ui-fb-settings-fields [settings]="settings().defaults ?? {}" (patch)="patchDefaults($event.patch)" />
      </section>
    } @else {
      <div class="sources" [class.has-open]="open() !== null">
        <section class="pane list" aria-label="Data sources">
          <div class="list-head">
            <p class="intro">Lists that dropdowns and multi-selects can search, in any form.</p>
            <ui-button size="sm" (click)="add()"><hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="14" [strokeWidth]="1.8" />Add a list</ui-button>
          </div>
          @if (!sources().length && !builtIn().length) {
            <p class="empty">No lists yet. Add one to let forms search your data, e.g. students or courses.</p>
          }
          <ul class="rows">
            @for (c of sources(); track $index; let i = $index) {
              <li>
                <button type="button" class="row" [class.on]="open() === i" [attr.aria-current]="open() === i ? 'true' : null" (click)="open.set(i)">
                  <span class="row-main"><strong>{{ c.label || 'Untitled list' }}</strong><span class="row-sub">{{ host(c.url) || 'No address yet' }}</span></span>
                  @if (used(c.type); as n) { <span class="fb-chip">{{ n }}</span> }
                  @if (problemOf(c); as p) { <span class="fb-chip bad" [title]="p">Fix</span> }
                </button>
              </li>
            }
          </ul>
          @if (builtIn().length) {
            <p class="sub-head">Built into the app</p>
            <ul class="rows">
              @for (d of builtIn(); track d.type) {
                <li class="row static"><span class="row-main"><strong>{{ d.label }}</strong><span class="row-sub">{{ d.description || 'Provided by the app’s code. It can’t be changed here.' }}</span></span></li>
              }
            </ul>
          }
        </section>

        @if (current(); as c) {
          <section class="pane editor" [attr.aria-label]="'Editing ' + (c.label || 'list')">
            <div class="ed-head">
              <ui-button class="back" size="sm" variant="ghost" (click)="open.set(null)"><hugeicons-icon aria-hidden="true" [icon]="backIcon" [size]="14" [strokeWidth]="1.8" />Lists</ui-button>
              <h3>{{ c.label || 'Untitled list' }}</h3>
              <ui-button size="sm" variant="ghost" (click)="remove()"><hugeicons-icon aria-hidden="true" [icon]="deleteIcon" [size]="14" [strokeWidth]="1.8" />Delete</ui-button>
            </div>
            @if (confirmDelete()) {
              <div class="fb-warn confirm" role="alert">
                <span>{{ used(c.type) }} use this list. They’ll show “This list isn’t available” until it’s back.</span>
                <ui-button size="sm" variant="destructive" (click)="remove(true)">Delete anyway</ui-button>
                <ui-button size="sm" variant="ghost" (click)="confirmDelete.set(false)">Cancel</ui-button>
              </div>
            }

            <div class="grp">
              <h4>About</h4>
              <div class="fb-grid2">
                <label class="fld"><span class="fb-label">Name</span>
                  <ui-input size="sm" [ngModel]="c.label" (ngModelChange)="setLabel($event)" placeholder="e.g. Students" /></label>
                <label class="fld"><span class="fb-label">Key</span>
                  <ui-input size="sm" class="mono" [ngModel]="c.type" (ngModelChange)="patch({ type: $event })" placeholder="students" [invalid]="!!keyProblem()" /></label>
              </div>
              <span class="fb-hint" [class.bad]="!!keyProblem()">{{ keyProblem() || (used(c.type) ? 'Forms refer to this list by its key, so changing it disconnects them.' : 'Forms refer to the list by this key.') }}</span>
              <label class="fld"><span class="fb-label">Description</span>
                <ui-input size="sm" [ngModel]="c.description ?? ''" (ngModelChange)="patch({ description: $event || undefined })" placeholder="Shown to form builders, e.g. ‘Everyone in the student records’" /></label>
            </div>

            <div class="grp">
              <h4>Where to ask</h4>
              <label class="fld"><span class="fb-label">Address</span>
                <ui-input size="sm" class="mono" [ngModel]="c.url" (ngModelChange)="patch({ url: $event.trim() })" placeholder="https://api.example.com/students" [invalid]="!!urlProblem()" /></label>
              @if (urlProblem(); as p) { <span class="fb-hint bad">{{ p }}</span> }
              @else { <span class="fb-hint">Your app adds its login to every request, so no keys go here.</span> }
            </div>

            <div class="grp">
              <h4>Searching and pages</h4>
              <div class="fb-grid2">
                <label class="fld"><span class="fb-label">Search setting</span>
                  <ui-input size="sm" class="mono" [ngModel]="c.searchParam ?? 'q'" (ngModelChange)="patch({ searchParam: $event || undefined })" placeholder="q" /></label>
                <label class="fld"><span class="fb-label">Results per page</span>
                  <ui-number-input size="sm" [ngModel]="c.pageSize ?? 20" (ngModelChange)="patch({ pageSize: $event || undefined })" [min]="1" [max]="200" ariaLabel="Results per page" /></label>
              </div>
              <ui-segmented size="sm" label="How pages are asked for" [options]="pagingOptions" [value]="c.paging ?? 'page'" (valueChange)="patch({ paging: $any($event), pageParam: undefined })" />
              <div class="fb-grid2">
                <label class="fld"><span class="fb-label">{{ (c.paging ?? 'page') === 'page' ? 'Page setting' : 'Skip setting' }}</span>
                  <ui-input size="sm" class="mono" [ngModel]="c.pageParam ?? ''" (ngModelChange)="patch({ pageParam: $event || undefined })" [placeholder]="(c.paging ?? 'page') === 'page' ? 'page' : 'offset'" /></label>
                @if ((c.paging ?? 'page') === 'page') {
                  <label class="fld"><span class="fb-label">First page is</span>
                    <select class="fb-native-select" (change)="patch({ firstPage: +$any($event.target).value === 0 ? 0 : undefined })">
                      <option value="1" [selected]="(c.firstPage ?? 1) === 1">1</option>
                      <option value="0" [selected]="c.firstPage === 0">0</option>
                    </select></label>
                } @else {
                  <label class="fld"><span class="fb-label">Page size setting</span>
                    <ui-input size="sm" class="mono" [ngModel]="c.pageSizeParam ?? 'pageSize'" (ngModelChange)="patch({ pageSizeParam: $event })" placeholder="limit" /></label>
                }
              </div>
              @if ((c.paging ?? 'page') === 'page') {
                <label class="fld"><span class="fb-label">Page size setting</span>
                  <ui-input size="sm" class="mono" [ngModel]="c.pageSizeParam ?? 'pageSize'" (ngModelChange)="patch({ pageSizeParam: $event })" placeholder="pageSize" /></label>
              }
              <label class="fld narrow"><span class="fb-label">Search after typing</span>
                <div class="fb-row"><ui-number-input size="sm" [ngModel]="c.minQueryLength ?? 0" (ngModelChange)="patch({ minQueryLength: $event || undefined })" [min]="0" [max]="10" ariaLabel="Characters before searching" /><span class="unit">characters</span></div></label>
              <span class="fb-hint">A search asks: <code class="mono">{{ example() }}</code></span>
            </div>

            <div class="grp">
              <h4>Reading the reply</h4>
              @if (lastTest()?.fields?.length) {
                <p class="fb-hint">Fields in each item: @for (k of lastTest()!.fields; track k) { <code class="mono key">{{ k }}</code> }</p>
              }
              <div class="fb-grid2">
                <label class="fld"><span class="fb-label">Where the list is</span>
                  <ui-input size="sm" class="mono" [ngModel]="c.itemsPath ?? ''" (ngModelChange)="patch({ itemsPath: $event || undefined })" placeholder="Empty when the reply is the list" /></label>
                <label class="fld"><span class="fb-label">Saved value</span>
                  <ui-input size="sm" class="mono" [ngModel]="c.valueField" (ngModelChange)="patch({ valueField: $event })" placeholder="id" /></label>
                <label class="fld"><span class="fb-label">What people see</span>
                  <ui-input size="sm" class="mono" [ngModel]="c.labelField" (ngModelChange)="patch({ labelField: $event })" placeholder="name, or {firstName} {lastName}" /></label>
                <label class="fld"><span class="fb-label">Second line (optional)</span>
                  <ui-input size="sm" class="mono" [ngModel]="c.descriptionField ?? ''" (ngModelChange)="patch({ descriptionField: $event || undefined })" placeholder="email" /></label>
                <label class="fld"><span class="fb-label">Total count at (optional)</span>
                  <ui-input size="sm" class="mono" [ngModel]="c.totalPath ?? ''" (ngModelChange)="patch({ totalPath: $event || undefined })" placeholder="total" /></label>
                <label class="fld"><span class="fb-label">“More pages” flag at (optional)</span>
                  <ui-input size="sm" class="mono" [ngModel]="c.hasMorePath ?? ''" (ngModelChange)="patch({ hasMorePath: $event || undefined })" placeholder="hasMore" /></label>
              </div>
              <span class="fb-hint">Use dots for nested fields (<code class="mono">data.items</code>). Without a total or flag, a full page means there may be more.</span>
            </div>

            <div class="grp">
              <h4>Settings for each question</h4>
              <span class="fb-hint">Filters form builders set per question, sent as query settings, e.g. a faculty. Each can follow another answer.</span>
              @for (p of c.params ?? []; track $index; let i = $index) {
                <div class="param">
                  <div class="fb-grid2">
                    <label class="fld"><span class="fb-label">Setting</span>
                      <ui-input size="sm" class="mono" [ngModel]="p.key" (ngModelChange)="patchParam(i, { key: $event })" placeholder="faculty" /></label>
                    <label class="fld"><span class="fb-label">Shown as</span>
                      <ui-input size="sm" [ngModel]="p.label" (ngModelChange)="patchParam(i, { label: $event })" placeholder="Faculty" /></label>
                  </div>
                  <div class="fb-row wrap">
                    <select class="fb-native-select kind" (change)="patchParam(i, { kind: $any($event.target).value })" aria-label="Kind of value">
                      <option value="text" [selected]="(p.kind ?? 'text') === 'text'">Text</option>
                      <option value="number" [selected]="p.kind === 'number'">Number</option>
                      <option value="select" [selected]="p.kind === 'select'">Choice</option>
                    </select>
                    <ui-switch size="sm" [ngModel]="!!p.required" (ngModelChange)="patchParam(i, { required: $event || undefined })">Needed before searching</ui-switch>
                    <button type="button" class="fb-icon-btn danger" (click)="removeParam(i)" [attr.aria-label]="'Remove setting ' + (p.label || p.key)">
                      <hugeicons-icon aria-hidden="true" [icon]="deleteIcon" [size]="14" [strokeWidth]="1.8" />
                    </button>
                  </div>
                  @if (p.kind === 'select') {
                    <label class="fld"><span class="fb-label">Choices, one per line as value: label</span>
                      <ui-textarea size="sm" [rows]="3" [autosize]="true" [maxRows]="8" [ngModel]="choicesText(p)" (ngModelChange)="setChoices(i, $event)" placeholder="health: Health and medicine" /></label>
                  }
                </div>
              }
              <button type="button" class="fb-link" (click)="addParam()"><hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="13" [strokeWidth]="2" /> Add a setting</button>
            </div>

            <div class="grp test">
              <h4>Test</h4>
              @for (p of c.params ?? []; track $index) {
                <label class="fld"><span class="fb-label">{{ p.label || p.key }}</span>
                  <ui-input size="sm" [ngModel]="testParams()[p.key] ?? ''" (ngModelChange)="setTestParam(p.key, $event)" placeholder="A value to test with" /></label>
              }
              <div class="fb-row">
                <label class="lw grow"><span class="fb-sr">Search for</span>
                  <ui-input size="sm" [(ngModel)]="testQuery" placeholder="Search for (optional)" (keydown.enter)="runTest()" /></label>
                <ui-button size="sm" [loading]="testing()" (click)="runTest()">Run test</ui-button>
              </div>
              @if (lastTest(); as t) {
                <div class="result" [class.bad]="!t.ok" role="status">
                  <p class="res-msg">{{ t.message }}</p>
                  <code class="mono req">{{ t.url }}</code>
                  @if (t.items.length) {
                    <table class="items">
                      <thead><tr><th scope="col">Shown as</th><th scope="col">Saved value</th>@if (c.descriptionField) { <th scope="col">Second line</th> }</tr></thead>
                      <tbody>
                        @for (it of t.items; track $index) {
                          <tr><td>{{ it.label }}</td><td class="mono">{{ it.value }}</td>@if (c.descriptionField) { <td>{{ it.description }}</td> }</tr>
                        }
                      </tbody>
                    </table>
                  }
                  @if (t.raw) {
                    <details><summary>The reply</summary><pre class="mono">{{ t.raw }}</pre></details>
                  }
                </div>
              }
            </div>
          </section>
        }
      </div>
    }
  `,
  styles: [FB_SHARED_STYLES, `
    :host { display: block; container: gs / inline-size; font-family: var(--ui-font-default); color: var(--ui-color-text); line-height: 1.35; }
    .sections { display: inline-flex; margin-bottom: var(--ui-space-3); }
    .intro { margin: 0; font-size: calc(13px * var(--ui-font-scale)); color: var(--ui-color-text-secondary); }
    .pane { min-width: 0; }
    .defaults { display: flex; flex-direction: column; gap: var(--ui-space-3); max-width: 560px; }
    .sources { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--ui-space-4); }
    @container gs (min-width: 760px) { .sources.has-open { grid-template-columns: 280px minmax(0, 1fr); } .back { display: none; } }
    @container gs (max-width: 759px) { .sources.has-open .list { display: none; } }
    .list-head { display: flex; align-items: center; gap: var(--ui-space-3); flex-wrap: wrap; justify-content: space-between; margin-bottom: var(--ui-space-2); }
    .empty { margin: var(--ui-space-2) 0; padding: var(--ui-space-4); font-size: calc(13px * var(--ui-font-scale)); text-align: center; color: var(--ui-color-text-muted);
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); }
    /* The app's own lists and the built-in ones are the same kind of thing, so they share one card style. */
    .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .row { display: flex; align-items: center; gap: var(--ui-space-2); width: 100%; padding: var(--ui-space-2) var(--ui-space-3); box-sizing: border-box;
      border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
    .row:hover:not(.static) { background: var(--ui-color-surface-hover); }
    .row.on { background: var(--ui-color-selected); }
    .row:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    .row.static { cursor: default; }
    .row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .row-main strong { font-size: calc(14px * var(--ui-font-scale)); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-sub { font-size: 12px; color: var(--ui-color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sub-head { margin: var(--ui-space-3) 0 var(--ui-space-1); font-size: 12px; font-weight: 600; color: var(--ui-color-text-secondary); }
    .editor { display: flex; flex-direction: column; gap: var(--ui-space-3); padding: var(--ui-space-3) var(--ui-space-4) var(--ui-space-4);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); }
    .ed-head { display: flex; align-items: center; gap: var(--ui-space-2); }
    .ed-head h3 { flex: 1; min-width: 0; margin: 0; font-size: calc(15px * var(--ui-font-scale)); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .confirm { display: flex; align-items: center; gap: var(--ui-space-2); flex-wrap: wrap; }
    .confirm span { flex: 1; min-width: 200px; }
    .grp { display: flex; flex-direction: column; gap: var(--ui-space-2); padding-top: var(--ui-space-3); border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .grp h4 { margin: 0; font-size: 12px; font-weight: 600; }
    .fld { display: flex; flex-direction: column; min-width: 0; }
    .fld.narrow { max-width: 220px; }
    .unit { font-size: 12px; color: var(--ui-color-text-secondary); }
    .grow { flex: 1; min-width: 0; }
    .wrap { flex-wrap: wrap; }
    .mono { font-family: var(--ui-font-mono); font-size: 12px; }
    code.mono { padding: 1px 4px; border-radius: var(--ui-radius-xs); background: var(--ui-color-surface-hover); overflow-wrap: anywhere; }
    code.key { display: inline-block; margin: 0 4px 4px 0; white-space: nowrap; overflow-wrap: normal; }
    .fb-hint.bad { color: var(--ui-color-danger); }
    .param { display: flex; flex-direction: column; gap: var(--ui-space-2); padding: var(--ui-space-2); border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius); }
    .kind { width: auto; }
    .fb-link { display: inline-flex; align-items: center; gap: 3px; align-self: flex-start; }
    .result { display: flex; flex-direction: column; gap: var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-radius);
      background: color-mix(in srgb, var(--ui-color-success) 8%, var(--ui-color-surface)); border: 1px solid color-mix(in srgb, var(--ui-color-success) 30%, transparent); }
    .result.bad { background: color-mix(in srgb, var(--ui-color-danger) 8%, var(--ui-color-surface)); border-color: color-mix(in srgb, var(--ui-color-danger) 35%, transparent); }
    .res-msg { margin: 0; font-size: calc(13px * var(--ui-font-scale)); font-weight: 600; }
    .req { display: block; }
    .items { width: 100%; border-collapse: collapse; font-size: calc(13px * var(--ui-font-scale)); font-variant-numeric: tabular-nums; }
    .items th { text-align: left; font-size: 12px; font-weight: 600; color: var(--ui-color-text-secondary); padding: 4px var(--ui-space-2); border-bottom: 1px solid var(--ui-color-border); }
    .items td { padding: 4px var(--ui-space-2); border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); overflow-wrap: anywhere; }
    details summary { cursor: pointer; font-size: 12px; color: var(--ui-color-text-secondary); }
    details pre { max-height: 240px; overflow: auto; margin: var(--ui-space-1) 0 0; padding: var(--ui-space-2); border-radius: var(--ui-radius-xs); background: var(--ui-color-bg); white-space: pre-wrap; }
  `],
})
export class UiFormGlobalSettingsEditor {
  private readonly http = inject(UI_FB_HTTP_SOURCES, { optional: true }) ?? {};
  private readonly registered = (inject(UI_FB_OPTION_SOURCES, { optional: true }) ?? []).flat();

  readonly settings = model<UiFormGlobalSettings>(createGlobalSettings());
  /** How many forms use each list, by key, e.g. `{ students: 3 }`. Used to warn before deleting or re-keying one. */
  readonly usage = input<Record<string, number>>({});

  protected readonly addIcon = FB_ICONS.Add01Icon;
  protected readonly deleteIcon = FB_ICONS.Delete02Icon;
  protected readonly backIcon = FB_ICONS.ArrowLeft01Icon;
  protected readonly sectionOptions = [{ value: 'sources', label: 'Data sources' }, { value: 'defaults', label: 'New form defaults' }];
  protected readonly pagingOptions = [{ value: 'page', label: 'Page numbers' }, { value: 'offset', label: 'Skip a number' }];

  protected readonly section = signal<Section>('sources');
  protected readonly open = signal<number | null>(null);
  protected readonly confirmDelete = signal(false);
  protected readonly testing = signal(false);
  protected readonly lastTest = signal<TestRun | null>(null);
  protected readonly testParams = signal<Record<string, string>>({});
  protected testQuery = '';
  /** Keys the admin typed themselves (so the name stops rewriting them). */
  private readonly keyTouched = new Set<number>();

  protected readonly sources = computed(() => this.settings().sources ?? []);
  protected readonly builtIn = computed(() => this.registered);
  protected readonly current = computed(() => { const i = this.open(); return i === null ? null : this.sources()[i] ?? null; });

  protected readonly keyProblem = computed(() => {
    const c = this.current();
    if (!c) return '';
    if (!c.type) return 'Give it a key, e.g. students.';
    if (!/^[a-z][a-z0-9_-]*$/i.test(c.type)) return 'Use letters, numbers, - and _ only, starting with a letter.';
    const others = [...this.sources().filter((_, i) => i !== this.open()).map((s) => s.type), ...this.registered.map((d) => d.type)];
    return others.includes(c.type) ? 'Another list already uses this key.' : '';
  });
  protected readonly urlProblem = computed(() => {
    const c = this.current();
    if (!c || !c.url) return c ? 'Add the address of the list.' : '';
    if (!originOf(c.url)) return 'That isn’t a web address (it should start with https://).';
    if (!originAllowed(c.url, this.http.allowedOrigins)) {
      const ok = this.http.allowedOrigins?.length ? ` Allowed: ${this.http.allowedOrigins.join(', ')}.` : '';
      return `This app doesn’t allow lists from ${originOf(c.url)}.${ok} A developer can add it.`;
    }
    return '';
  });
  protected readonly example = computed(() => {
    const c = this.current();
    if (!c?.url || !originOf(c.url)) return '…';
    const params: Record<string, unknown> = {};
    for (const p of c.params ?? []) params[p.key] = `{${p.key}}`;
    return decodeURIComponent(sourceUrl(c, { query: 'text', page: 1, pageSize: c.pageSize ?? 20, params }));
  });

  protected used(type: string): string {
    const n = this.usage()[type] ?? 0;
    return n ? `${n} form${n === 1 ? '' : 's'}` : '';
  }

  protected host(url: string): string {
    return originOf(url).replace(/^https?:\/\//, '');
  }

  protected problemOf(c: UiFbHttpSourceConfig): string {
    if (!c.type || !c.url || !c.valueField || !c.labelField) return 'Missing a key, address, saved value or what people see.';
    if (!originAllowed(c.url, this.http.allowedOrigins)) return 'This app doesn’t allow its address.';
    return '';
  }

  // ── Editing ───────────────────────────────────────────────────────────────

  private write(sources: UiFbHttpSourceConfig[]): void {
    this.settings.update((s) => ({ ...s, version: 1, sources }));
  }

  protected add(): void {
    const n = this.sources().length + 1;
    this.write([...this.sources(), { type: `list-${n}`, label: '', url: '', valueField: 'id', labelField: 'name' }]);
    this.open.set(this.sources().length - 1);
    this.lastTest.set(null);
    this.confirmDelete.set(false);
  }

  protected patch(p: Partial<UiFbHttpSourceConfig>): void {
    const i = this.open();
    if (i === null) return;
    if ('type' in p) this.keyTouched.add(i);
    this.write(this.sources().map((c, j) => (j === i ? clean({ ...c, ...p }) : c)));
  }

  /** The key follows the name until the admin edits it, or forms use it. */
  protected setLabel(label: string): void {
    const i = this.open();
    const c = this.current();
    if (i === null || !c) return;
    const follow = !this.keyTouched.has(i) && !this.usage()[c.type];
    this.write(this.sources().map((x, j) => (j === i ? { ...x, label, type: follow ? fbSlug(label) || x.type : x.type } : x)));
  }

  protected remove(confirmed = false): void {
    const i = this.open();
    const c = this.current();
    if (i === null || !c) return;
    if (!confirmed && this.usage()[c.type]) { this.confirmDelete.set(true); return; }
    this.write(this.sources().filter((_, j) => j !== i));
    this.open.set(null);
    this.confirmDelete.set(false);
    this.lastTest.set(null);
  }

  protected addParam(): void {
    const c = this.current();
    if (c) this.patch({ params: [...(c.params ?? []), { key: '', label: '' }] });
  }

  protected patchParam(i: number, p: Partial<UiFbSourceParamSpec>): void {
    const c = this.current();
    if (c) this.patch({ params: (c.params ?? []).map((x, j) => (j === i ? clean({ ...x, ...p }) : x)) });
  }

  protected removeParam(i: number): void {
    const c = this.current();
    if (c) this.patch({ params: (c.params ?? []).filter((_, j) => j !== i) });
  }

  protected choicesText(p: UiFbSourceParamSpec): string {
    return (p.options ?? []).map((o) => (o.label && o.label !== o.value ? `${o.value}: ${o.label}` : o.value)).join('\n');
  }

  protected setChoices(i: number, text: string): void {
    const options = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const at = l.indexOf(':');
      return at > 0 ? { value: l.slice(0, at).trim(), label: l.slice(at + 1).trim() } : { value: l, label: l };
    });
    this.patchParam(i, { options });
  }

  protected patchDefaults(p: Partial<UiFbSettings>): void {
    this.settings.update((s) => ({ ...s, version: 1, defaults: clean({ ...(s.defaults ?? {}), ...p }) }));
  }

  // ── Testing ───────────────────────────────────────────────────────────────

  protected setTestParam(key: string, value: string): void {
    this.testParams.update((t) => ({ ...t, [key]: value }));
  }

  /** Asks the list for its first page the same way forms will, and shows what came back. */
  async runTest(): Promise<void> {
    const c = this.current();
    if (!c) return;
    if (this.urlProblem()) { this.lastTest.set({ url: c.url, ok: false, message: this.urlProblem(), items: [], fields: [], raw: '' }); return; }
    const pageSize = c.pageSize ?? 20;
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this.testParams())) if (v) params[k] = v;
    const url = sourceUrl(c, { query: this.testQuery.trim(), page: 1, pageSize, params });
    this.testing.set(true);
    let reply: unknown;
    try {
      reply = await sourceFetch(this.http)(url, { signal: new AbortController().signal });
    } catch (e) {
      this.lastTest.set({ url, ok: false, message: `The request failed: ${e instanceof Error ? e.message : String(e)}`, items: [], fields: [], raw: '' });
      this.testing.set(false);
      return;
    }
    const raw = (() => { try { const t = JSON.stringify(reply, null, 2); return t.length > 4000 ? t.slice(0, 4000) + '\n…' : t; } catch { return String(reply); } })();
    const list = readPath(reply, c.itemsPath);
    const first = Array.isArray(list) ? list[0] : undefined;
    const fields = first && typeof first === 'object' ? Object.keys(first).slice(0, 16) : [];
    try {
      const page = readSourceReply(c, reply, pageSize);
      const n = page.total ?? page.items.length;
      const more = page.hasMore ? ' (more pages follow)' : '';
      this.lastTest.set({
        url, ok: true, raw, fields,
        message: page.items.length ? `Works: found ${n}${page.total == null && page.hasMore !== false ? '+' : ''}${more}.` : 'Works, but nothing matched.',
        items: page.items.slice(0, 8),
      });
    } catch (e) {
      this.lastTest.set({ url, ok: false, raw, fields, message: e instanceof Error ? e.message : String(e), items: [] });
    }
    this.testing.set(false);
  }
}

/** Drops empty optional fields so the stored JSON stays small. */
function clean<T extends object>(o: T): T {
  const out = { ...o } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out as T;
}
