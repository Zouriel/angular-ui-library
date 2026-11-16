import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiInput } from '@zouriel/ui/form';
import { FB_ICONS } from './builder-icons';
import { FbBuilderStore } from './builder-store';
import { FB_SHARED_STYLES } from './builder-styles';
import { fbDefaultDir, fbLocaleName } from './localize';

/** Languages offered when adding one (any other code can be typed). */
export const FB_SUGGESTED_LOCALES = ['dv', 'en', 'ar', 'hi', 'si', 'ta', 'bn', 'ur', 'fr', 'es', 'de', 'zh'];

/**
 * `ui-fb-languages` — the languages of the form: add one, remove one, pick the default (the language
 * everything is first written in) and set each language's writing direction.
 */
@Component({
  selector: 'ui-fb-languages',
  imports: [FormsModule, HugeiconsIconComponent, UiButton, UiSegmented, UiInput],
  template: `
    <p class="fb-hint">Write everything in the default language first, then switch to another language in the toolbar to translate side by side.
      A question with no translation shows in the default language.</p>
    <ul class="langs" role="list">
      @for (l of store.locales(); track l.code) {
        <li class="lang">
          <span class="name" [attr.dir]="l.dir" [attr.lang]="l.code">{{ l.label }}</span>
          <span class="code">{{ l.code }}</span>
          @if (l.code === store.defaultLocale()) { <span class="fb-chip">Default</span> }
          <ui-segmented class="dir" size="sm" [label]="'Direction of ' + l.label" [options]="dirs" [value]="l.dir" (valueChange)="store.setLocaleDir(l.code, $any($event))" />
          @if (l.code !== store.defaultLocale()) {
            <ui-button size="sm" variant="ghost" (click)="store.setDefaultLocale(l.code)">Make default</ui-button>
            <button type="button" class="fb-icon-btn danger" (click)="askRemove(l.code)" [attr.aria-label]="'Remove ' + l.label" title="Remove this language">
              <hugeicons-icon aria-hidden="true" [icon]="removeIcon" [size]="14" [strokeWidth]="1.8" />
            </button>
          }
        </li>
        @if (confirming() === l.code) {
          <li class="confirm" role="alert">
            <span>Remove {{ l.label }}? Its translations are deleted from every question. You can undo this.</span>
            <ui-button size="sm" variant="ghost" (click)="confirming.set(null)">Keep</ui-button>
            <ui-button size="sm" variant="destructive" (click)="remove(l.code)">Remove</ui-button>
          </li>
        }
      }
    </ul>
    <div class="add">
      <span class="fb-label">Add a language</span>
      <div class="chips">
        @for (c of suggestions(); track c) {
          <button type="button" class="chip" (click)="add(c)"><hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="12" [strokeWidth]="2" />{{ nameOf(c) }}</button>
        }
      </div>
      <div class="custom">
        <label class="lw"><span class="fb-sr">Language code</span>
          <ui-input size="sm" [ngModel]="code()" (ngModelChange)="code.set($event)" placeholder="Other code, e.g. pt-BR" (keydown.enter)="addCustom()" /></label>
        <ui-button size="sm" variant="outline" [disabled]="!code().trim()" (click)="addCustom()">Add</ui-button>
      </div>
      @if (error()) { <p class="fb-warn" role="alert">{{ error() }}</p> }
    </div>
  `,
  styles: [FB_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .langs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .lang { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); padding: var(--ui-space-2); border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius); }
    .name { font-weight: 600; font-size: calc(14px * var(--ui-font-scale)); }
    .code { font-size: 12px; color: var(--ui-color-text-muted); text-transform: uppercase; }
    .dir { margin-inline-start: auto; }
    .confirm { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); padding: var(--ui-space-2); font-size: calc(13px * var(--ui-font-scale)); color: var(--ui-color-danger); }
    .confirm span { flex: 1; min-width: 12ch; }
    .add { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .chips { display: flex; flex-wrap: wrap; gap: var(--ui-space-1); }
    .chip { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 var(--ui-space-3); border: 1px solid var(--ui-color-border); border-radius: 14px;
      background: transparent; color: var(--ui-color-text); font: inherit; font-size: calc(13px * var(--ui-font-scale)); cursor: pointer; }
    @media (hover: hover) { .chip:hover { background: var(--ui-color-surface-hover); } }
    .chip:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .custom { display: flex; align-items: center; gap: var(--ui-space-2); }
    .custom .lw { flex: 1; min-width: 0; }
  `],
})
export class FbLanguages {
  protected readonly store = inject(FbBuilderStore);
  protected readonly addIcon = FB_ICONS.Add01Icon;
  protected readonly removeIcon = FB_ICONS.Delete02Icon;
  protected readonly dirs = [{ value: 'ltr', label: 'Left to right' }, { value: 'rtl', label: 'Right to left' }];
  protected readonly code = signal('');
  protected readonly error = signal('');
  protected readonly confirming = signal<string | null>(null);
  protected readonly suggestions = computed(() => FB_SUGGESTED_LOCALES.filter((c) => !this.store.locales().some((l) => l.code === c)));

  protected nameOf(code: string): string {
    return `${fbLocaleName(code)} (${code})`;
  }

  protected add(code: string): void {
    this.error.set('');
    if (!this.store.addLocale(code, undefined, fbDefaultDir(code))) this.error.set('That language is already in the form.');
  }

  protected addCustom(): void {
    const c = this.code().trim();
    if (!c) return;
    if (!/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/.test(c)) { this.error.set('Use a language code like “dv”, “fr” or “pt-BR”.'); return; }
    this.add(c.replace('_', '-'));
    if (!this.error()) this.code.set('');
  }

  protected askRemove(code: string): void {
    this.confirming.set(code);
  }

  protected remove(code: string): void {
    this.confirming.set(null);
    this.store.removeLocale(code);
  }
}
