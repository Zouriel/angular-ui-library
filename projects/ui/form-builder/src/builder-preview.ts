import { JsonPipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiSwitch, UiTextarea } from '@zouriel/ui/form';
import { UiDeviceFrame } from '@zouriel/ui/media';
import { FbBuilderStore } from './builder-store';
import { FB_SHARED_STYLES } from './builder-styles';
import { UiFormRenderer } from './form-renderer';
import type { UiFormSubmission } from './schema';
import { FB_ICONS } from './builder-icons';

/**
 * `ui-fb-preview` — fill the form in as people will, on a desktop or phone
 * width, with the saved JSON alongside. Paste saved answers to try editing.
 */
@Component({
  selector: 'ui-fb-preview',
  imports: [JsonPipe, FormsModule, HugeiconsIconComponent, UiButton, UiSegmented, UiSwitch, UiTextarea, UiDeviceFrame, UiFormRenderer],
  template: `
    <div class="bar">
      <ui-segmented size="sm" label="Screen size" [options]="devices" [value]="device()" (valueChange)="device.set($any($event))" />
      <ui-segmented size="sm" label="Try it as" [options]="modes" [value]="mode()" (valueChange)="setMode($any($event))" />
      <ui-button size="sm" variant="ghost" (click)="restart()"><hugeicons-icon aria-hidden="true" [icon]="resetIcon" [size]="14" [strokeWidth]="1.8" />Start again</ui-button>
      <ui-switch class="data-toggle" [ngModel]="showData()" (ngModelChange)="showData.set($event)">Show saved data</ui-switch>
    </div>
    @if (mode() !== 'create') {
      <div class="paste">
        <label class="paste-lbl">
          <span class="fb-label">Saved answers (JSON)</span>
          <ui-textarea [ngModel]="dataText()" (ngModelChange)="dataText.set($event)" [rows]="3" [autosize]="true" [maxRows]="10" />
        </label>
        <p class="fb-hint" [class.bad]="!!dataError()" aria-live="polite">{{ dataError() || 'Answers saved earlier, to see how the form opens them.' }}</p>
      </div>
    }
    <div class="stage" [class.split]="showData()">
      <div class="screen">
          @if (device() === 'phone') {
            <ui-device-frame [width]="390" [height]="760" class="phone">
              <div class="phone-scroll">
                <ui-form-renderer [definition]="store.def()" [data]="data()" [mode]="mode()" [validators]="store.validatorDefs()" [optionSources]="store.optionSourceDefs()"
                  (submitted)="submitted($event)" />
              </div>
            </ui-device-frame>
          } @else {
            <div class="desktop">
              <ui-form-renderer [definition]="store.def()" [data]="data()" [mode]="mode()" [validators]="store.validatorDefs()" [optionSources]="store.optionSourceDefs()"
                (submitted)="submitted($event)" />
            </div>
          }
      </div>
      @if (showData()) {
        <aside class="data" aria-label="Saved data">
          @if (last(); as s) {
            <p class="ok">Submitted. This is what would be saved:</p>
            <pre>{{ s | json }}</pre>
          } @else {
            <p class="fb-hint">Answers so far, as they would be saved:</p>
            <pre>{{ live() | json }}</pre>
          }
        </aside>
      }
    </div>
  `,
  styles: [FB_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; min-height: 0; background: var(--ui-color-bg); }
    .bar { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2) var(--ui-space-3); padding: var(--ui-space-2) var(--ui-space-3);
      border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); background: var(--ui-color-surface); flex: none; }
    .data-toggle { margin-left: auto; font-size: 13px; }
    .paste { padding: var(--ui-space-2) var(--ui-space-3); border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); flex: none; }
    .paste ui-textarea { font-family: var(--ui-font-mono); }
    .fb-hint.bad { color: var(--ui-color-danger); }
    .stage { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr; overflow: hidden; }
    .stage.split { grid-template-columns: minmax(0, 1fr) minmax(260px, 34%); }
    .screen { overflow: auto; padding: var(--ui-space-4) var(--ui-space-3); min-width: 0; }
    .desktop { max-width: 760px; margin: 0 auto; padding: var(--ui-space-4); border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border));
      border-radius: var(--ui-radius); background: var(--ui-color-surface); }
    .phone { display: block; margin: 0 auto; }
    .phone-scroll { height: 100%; overflow: auto; padding: 48px var(--ui-space-3) var(--ui-space-6); box-sizing: border-box; background: var(--ui-color-surface); }
    .data { overflow: auto; padding: var(--ui-space-3); border-left: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); background: var(--ui-color-surface); }
    .data pre { margin: var(--ui-space-2) 0 0; font-family: var(--ui-font-mono); font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; color: var(--ui-color-text-secondary); }
    .ok { margin: 0; font-size: 13px; color: var(--ui-color-success); }
    @media (max-width: 720px) { .stage.split { grid-template-columns: 1fr; grid-template-rows: auto auto; overflow: auto; } .data { border-left: 0; border-top: 1px solid var(--ui-color-border); } .screen { overflow: visible; } }
  `],
})
export class FbPreview {
  protected readonly store = inject(FbBuilderStore);

  protected readonly resetIcon = FB_ICONS.RefreshIcon;
  protected readonly devices = [{ value: 'desktop', label: 'Desktop' }, { value: 'phone', label: 'Phone' }];
  protected readonly modes = [{ value: 'create', label: 'New answers' }, { value: 'edit', label: 'Edit saved' }, { value: 'view', label: 'View saved' }];

  protected readonly device = signal<'desktop' | 'phone'>(typeof matchMedia !== 'undefined' && matchMedia('(max-width: 720px)').matches ? 'phone' : 'desktop');
  protected readonly mode = signal<'create' | 'edit' | 'view'>('create');
  protected readonly showData = signal(true);
  private readonly renderer = viewChild(UiFormRenderer);
  /** The answers as they'd be saved right now, straight from the running form. */
  protected readonly live = computed(() => this.renderer()?.engine()?.data() ?? {});
  protected readonly last = signal<UiFormSubmission | null>(null);
  protected readonly dataText = signal('{}');

  private readonly parsed = computed(() => {
    try {
      const v = JSON.parse(this.dataText() || '{}');
      return v && typeof v === 'object' && !Array.isArray(v) ? { ok: v as Record<string, unknown> } : { error: 'Saved answers must be a JSON object, like { "name": "Ada" }.' };
    } catch {
      return { error: 'That isn’t valid JSON yet.' };
    }
  });
  protected readonly dataError = computed(() => this.parsed().error ?? '');
  protected readonly data = computed(() => (this.mode() === 'create' ? null : this.parsed().ok ?? {}));

  protected setMode(m: 'create' | 'edit' | 'view'): void {
    // Moving to edit/view starts from what was just filled in, which is the natural thing to test.
    if (m !== 'create' && this.mode() === 'create') this.dataText.set(JSON.stringify(this.last()?.data ?? this.live(), null, 2));
    this.mode.set(m);
    this.restart();
  }

  protected restart(): void {
    this.last.set(null);
    this.renderer()?.reset();
  }

  protected submitted(s: UiFormSubmission): void {
    this.last.set(s);
    this.showData.set(true);
  }
}
