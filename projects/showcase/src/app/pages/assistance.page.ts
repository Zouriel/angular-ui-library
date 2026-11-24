import { Component, inject, signal } from '@angular/core';
import { uiStringsDv } from '@zouriel/ui';
import { UiAssistanceBar, UiAssistanceService, UiReadAloud, UiReadAloudService } from '@zouriel/ui/assistance';
import { UiButton } from '@zouriel/ui/button';
import type { UiLanguage } from '@zouriel/ui/navigation';
import { UiText } from '@zouriel/ui/text';
import { DocDemo, DocPage, DocSection, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-assistance',
  imports: [UiAssistanceBar, UiReadAloud, UiButton, UiText, DocPage, DocSection, DocDemo],
  template: `
    <doc-page
      eyebrow="Components"
      title="Assistance"
      lead="Accessibility toolbar and services from @zouriel/ui/assistance: live text scaling (default / large / larger on <html>), language switching, read-aloud with a pluggable engine, and a help trigger.">

      <doc-section
        name="Assistance bar"
        selector="ui-assistance-bar"
        [api]="barApi"
        [outputs]="barOut"
        anchor="assistance-bar"
        summary="A single-row toolbar (role='toolbar' with arrow-key navigation) that scrolls sideways under 600px with uiScrollFade while keeping every label visible. Text size cycles default → large → larger and updates data-text-size on <html> live. Read aloud uses the browser's speechSynthesis by default (or a custom engine via provideUiReadAloud) and hides automatically when no voice exists for the active language (such as Dhivehi).">
        <doc-demo
          lang="ts + html"
          code="import { UiAssistanceBar } from '@zouriel/ui/assistance';
import { uiStringsDv } from '@zouriel/ui';

<ui-assistance-bar
  [languages]=&quot;[
    { code: 'en', label: 'English', dir: 'ltr', strings: {} },
    { code: 'dv', label: 'ދިވެހި', dir: 'rtl', strings: uiStringsDv }
  ]&quot;
  (help)=&quot;openHelp()&quot;
  (languageChange)=&quot;onLang($event)&quot; />">
          <div class="demo-box">
            <ui-assistance-bar
              [languages]="langs"
              [readTarget]="sampleEl"
              (help)="helpCount.set(helpCount() + 1)"
              (languageChange)="lastLang.set($event)" />
            <div #sampleEl class="sample">
              <ui-text variant="h3">Live preview block</ui-text>
              <ui-text variant="body">
                Toggle Text size above to scale typography across the page (currently
                <strong>{{ assistance.textSize() }}</strong>).
                Help clicked: {{ helpCount() }} · Last language: {{ lastLang() || 'en' }}.
              </ui-text>
            </div>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section
        name="Read aloud directive"
        selector="[uiReadAloud]"
        [api]="readDirectiveApi"
        anchor="read-aloud"
        summary="Attach uiReadAloud to any button with [for] pointing to an element or CSS selector to toggle reading that block aloud. Reads text in document order, skipping aria-hidden and nav elements without modifying the DOM.">
        <doc-demo
          lang="html"
          code="<div #question>
  <h3>What is your district?</h3>
  <p>Select your home district in Harbourside City.</p>
</div>
<button type=&quot;button&quot; uiReadAloud [for]=&quot;question&quot;>Read this question aloud</button>">
          <div class="demo-box">
            <div #questionBlock class="sample">
              <ui-text variant="h4">Sample question</ui-text>
              <ui-text variant="body">Select your home district in Harbourside City to continue your permit application.</ui-text>
            </div>
            <div class="row">
              <ui-button variant="outline" size="sm" uiReadAloud [for]="questionBlock">
                {{ readAloud.speaking() ? 'Stop reading' : 'Read this question aloud' }}
              </ui-button>
              <ui-text variant="caption">
                Browser speechSynthesis supported: {{ readAloud.supported() ? 'yes' : 'no' }}
              </ui-text>
            </div>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section
        name="Services & providers"
        selector="UiAssistanceService · UiReadAloudService"
        [api]="serviceApi"
        anchor="assistance-services"
        summary="UiAssistanceService holds textSize as a signal, persists it via provideUiAssistance({ storage }) (defaulting to try/catch localStorage), and provides toQueryParams() / fromQueryParams() for shareable links. UiReadAloudService exposes speak(), pause(), resume(), stop(), canSpeak(lang), and speaking/paused/supported signals, with provideUiReadAloud({ engine }) for custom TTS backends.">
      </doc-section>
    </doc-page>
  `,
  styles: `
    .demo-box { display: flex; flex-direction: column; gap: var(--ui-space-4); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .sample { padding: var(--ui-space-4); display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-3); padding: 0 var(--ui-space-4) var(--ui-space-4); }
  `,
})
export class AssistancePage {
  protected readonly assistance = inject(UiAssistanceService);
  protected readonly readAloud = inject(UiReadAloudService);
  protected readonly helpCount = signal(0);
  protected readonly lastLang = signal('');

  protected readonly langs: UiLanguage[] = [
    { code: 'en', label: 'English', dir: 'ltr', strings: {} },
    { code: 'dv', label: 'ދިވެހި', dir: 'rtl', strings: uiStringsDv },
  ];

  protected readonly barApi: ApiRow[] = [
    { name: 'controls', type: "('textSize' | 'language' | 'readAloud' | 'help')[]", default: 'all four', desc: 'Which controls render, in order.' },
    { name: 'languages', type: 'UiLanguage[]', default: '[]', desc: 'Language options passed to the embedded ui-language-switch.' },
    { name: 'readTarget', type: 'HTMLElement | string', default: "'main'", desc: 'Element or selector read by the Read this page aloud button.' },
    { name: 'label', type: 'string', default: 'strings.assistance', desc: 'Accessible name of the toolbar.' },
  ];

  protected readonly barOut: ApiRow[] = [
    { name: 'help', type: 'void', default: '—', desc: 'Emitted when the Get help control is activated.' },
    { name: 'languageChange', type: 'string', default: '—', desc: 'Emitted with the selected language code.' },
  ];

  protected readonly readDirectiveApi: ApiRow[] = [
    { name: 'for', type: 'HTMLElement | string | null', default: 'null', desc: 'Target element or selector to read when toggled.' },
    { name: 'lang', type: 'string', default: 'undefined', desc: 'Optional language code override (defaults to <html lang>).' },
  ];

  protected readonly serviceApi: ApiRow[] = [
    { name: 'UiAssistanceService.textSize', type: "Signal<'default' | 'large' | 'larger'>", default: "'default'", desc: 'Current text size; reflected as data-text-size on <html>.' },
    { name: 'UiAssistanceService.setTextSize(size)', type: '(UiTextSize) => void', default: '—', desc: 'Set text size directly and persist it.' },
    { name: 'UiAssistanceService.cycleTextSize()', type: '() => UiTextSize', default: '—', desc: 'Cycles default → large → larger → default.' },
    { name: 'UiAssistanceService.toQueryParams() / fromQueryParams()', type: 'methods', default: '—', desc: 'Serialize/restore textSize in URL query parameters.' },
    { name: 'UiReadAloudService.speaking / paused / supported', type: 'Signal<boolean>', default: 'false', desc: 'Live playback state and whether an engine is available.' },
    { name: 'UiReadAloudService.canSpeak(lang?)', type: '(string?) => boolean', default: '—', desc: 'Whether the engine has a voice for the given (or <html lang>) language.' },
    { name: 'UiReadAloudService.speak(target, lang?) / pause() / resume() / stop()', type: 'methods', default: '—', desc: 'Control reading an element or CSS selector aloud.' },
    { name: 'provideUiAssistance({ storage }) / UI_ASSISTANCE_STORAGE', type: 'Provider / Token', default: 'localStorage', desc: 'Custom storage adapter ({ get, set }) for textSize persistence.' },
    { name: 'provideUiReadAloud({ engine }) / UI_READ_ALOUD_ENGINE', type: 'Provider / Token', default: 'speechSynthesis', desc: 'Pluggable TTS engine implementing UiReadAloudEngine.' },
  ];
}
