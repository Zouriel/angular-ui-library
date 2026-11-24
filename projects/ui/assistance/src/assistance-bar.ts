import { DOCUMENT } from '@angular/common';
import { Component, computed, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import HelpCircleIcon from '@hugeicons/core-free-icons/HelpCircleIcon';
import TextFontIcon from '@hugeicons/core-free-icons/TextFontIcon';
import VolumeHighIcon from '@hugeicons/core-free-icons/VolumeHighIcon';
import VolumeOffIcon from '@hugeicons/core-free-icons/VolumeOffIcon';
import { injectUiStrings, UiDirectionService, uiLogicalKey } from '@zouriel/ui';
import { UiScrollFade } from '@zouriel/ui/behaviors';
import { UiLanguageSwitch, type UiLanguage } from '@zouriel/ui/navigation';
import { UiAssistanceService } from './assistance.service';
import { UiReadAloudService } from './read-aloud.service';

export type UiAssistanceControl = 'textSize' | 'language' | 'readAloud' | 'help';

/**
 * `ui-assistance-bar` — accessibility and help toolbar (`role="toolbar"` with arrow-key navigation):
 * text size (cycles default/large/larger), language switch, read aloud (hidden when no voice exists
 * for the page language), and get help. Scrolls sideways under 600px with `uiScrollFade` while
 * keeping every control label visible.
 */
@Component({
  selector: 'ui-assistance-bar',
  imports: [HugeiconsIconComponent, UiScrollFade, UiLanguageSwitch],
  template: `
    <div
      #toolbar
      class="bar"
      role="toolbar"
      [attr.aria-label]="labelText()"
      uiScrollFade
      (keydown)="onKey($event)">
      @for (ctrl of controls(); track ctrl) {
        @switch (ctrl) {
          @case ('textSize') {
            <button
              type="button"
              class="ctrl"
              data-ctrl="textSize"
              [attr.aria-pressed]="assistance.textSize() !== 'default'"
              (click)="assistance.cycleTextSize()">
              <hugeicons-icon aria-hidden="true" [icon]="textIcon" [size]="16" [strokeWidth]="1.8" />
              <span>{{ strings.textSize }}: {{ textSizeLabel() }}</span>
            </button>
          }
          @case ('language') {
            @if (languages().length) {
              <div class="lang-wrap" data-ctrl="language">
                <ui-language-switch
                  [languages]="languages()"
                  appearance="link"
                  (valueChange)="onLanguageChange($event)" />
              </div>
            }
          }
          @case ('readAloud') {
            @if (canSpeakPage()) {
              <button
                type="button"
                class="ctrl"
                data-ctrl="readAloud"
                [attr.aria-pressed]="readAloud.speaking()"
                (click)="toggleReadAloud()">
                <hugeicons-icon aria-hidden="true" [icon]="readAloud.speaking() ? stopIcon : speakIcon" [size]="16" [strokeWidth]="1.8" />
                <span>{{ readAloud.speaking() ? strings.stopReading : strings.readPageAloud }}</span>
              </button>
            }
          }
          @case ('help') {
            <button
              type="button"
              class="ctrl"
              data-ctrl="help"
              (click)="help.emit()">
              <hugeicons-icon aria-hidden="true" [icon]="helpIcon" [size]="16" [strokeWidth]="1.8" />
              <span>{{ strings.getHelp }}</span>
            </button>
          }
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      background: var(--ui-color-surface-subtle);
      color: var(--ui-color-text);
      border-bottom: 1px solid var(--ui-color-border);
      font-family: var(--ui-font-default);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: var(--ui-space-2);
      min-height: var(--ui-assistance-bar-height, 44px);
      padding-inline: var(--ui-space-4);
      overflow-x: auto;
      scrollbar-width: none;
      box-sizing: border-box;
    }
    .bar::-webkit-scrollbar { display: none; }

    .ctrl {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      height: var(--ui-size-sm);
      padding: 0 var(--ui-space-3);
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--ui-button-radius, var(--ui-radius));
      color: var(--ui-color-text-secondary);
      font: inherit;
      font-size: var(--ui-font-size-sm);
      font-weight: var(--ui-font-weight-control);
      white-space: nowrap;
      cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ctrl:hover {
      background: var(--ui-color-surface-hover);
      color: var(--ui-color-text);
    }
    .ctrl[aria-pressed='true'] {
      background: var(--ui-color-selected);
      color: var(--ui-color-text);
    }
    .ctrl:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
    }
    .lang-wrap {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
    }

    @media (pointer: coarse) {
      .ctrl { min-height: var(--ui-size-touch); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ctrl { transition: none; }
    }
  `,
})
export class UiAssistanceBar {
  protected readonly strings = injectUiStrings();
  protected readonly assistance = inject(UiAssistanceService);
  protected readonly readAloud = inject(UiReadAloudService);
  private readonly direction = inject(UiDirectionService);
  private readonly doc = inject(DOCUMENT);

  controls = input<UiAssistanceControl[]>(['textSize', 'language', 'readAloud', 'help']);
  languages = input<UiLanguage[]>([]);
  readTarget = input<HTMLElement | string>('main');
  label = input<string | undefined>(undefined);

  help = output<void>();
  languageChange = output<string>();

  protected readonly textIcon = TextFontIcon;
  protected readonly speakIcon = VolumeHighIcon;
  protected readonly stopIcon = VolumeOffIcon;
  protected readonly helpIcon = HelpCircleIcon;

  private readonly toolbarRef = viewChild.required<ElementRef<HTMLElement>>('toolbar');

  protected readonly labelText = computed(() => this.label() ?? this.strings.assistance);

  protected readonly textSizeLabel = computed(() => {
    const size = this.assistance.textSize();
    if (size === 'large') return this.strings.textSizeLarge;
    if (size === 'larger') return this.strings.textSizeLarger;
    return this.strings.textSizeDefault;
  });

  protected readonly canSpeakPage = computed(() => {
    this.direction.dir();
    const lang = this.doc.documentElement?.getAttribute('lang') || 'en';
    return this.readAloud.canSpeak(lang);
  });

  protected toggleReadAloud(): void {
    if (this.readAloud.speaking()) this.readAloud.stop();
    else this.readAloud.speak(this.readTarget());
  }

  protected onLanguageChange(code: string): void {
    this.languageChange.emit(code);
  }

  protected onKey(e: KeyboardEvent): void {
    const key = uiLogicalKey(e);
    if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return;
    const bar = this.toolbarRef().nativeElement;
    const items = Array.from(bar.querySelectorAll<HTMLElement>('button:not(:disabled), [href]'));
    if (!items.length) return;
    const idx = items.indexOf(this.doc.activeElement as HTMLElement);
    if (idx === -1) return;
    e.preventDefault();
    if (key === 'Home') items[0].focus();
    else if (key === 'End') items[items.length - 1].focus();
    else if (key === 'ArrowRight') items[(idx + 1) % items.length].focus();
    else items[(idx - 1 + items.length) % items.length].focus();
  }
}
