import { Component, signal } from '@angular/core';
import { UI_CONFIG, defaultUiConfig } from '@zouriel/ui';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import FolderAddIcon from '@hugeicons/core-free-icons/FolderAddIcon';
import { UiText } from '@zouriel/ui/text';
import { UiButton } from '@zouriel/ui/button';
import { UiAlert } from '@zouriel/ui/alert';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiShutterLoader } from '@zouriel/ui/shutter-loader';
import { UiSkeleton } from '@zouriel/ui/skeleton';
import { UiProgressBar, UiProgressCircle } from '@zouriel/ui/progress';
import { UiEmptyState, UiResult, UiLoadingOverlay } from '@zouriel/ui/feedback';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const SIZE = "'sm' | 'md' | 'lg'";

/** Demo only: gives its contents `spinner: 'shutter'`, as `provideUiConfig({ spinner: 'shutter' })` does app-wide. */
@Component({
  selector: 'shutter-config-scope',
  providers: [{ provide: UI_CONFIG, useValue: { ...defaultUiConfig, spinner: 'shutter' } }],
  template: `<ng-content />`,
  styles: `:host { display: contents; }`,
})
export class ShutterConfigScope {}
const STATUS = "'neutral' | 'primary' | 'success' | 'warning' | 'danger'";

@Component({
  selector: 'page-feedback',
  imports: [HugeiconsIconComponent, 
    UiText, UiButton, UiAlert, UiSpinner, UiShutterLoader, ShutterConfigScope, UiSkeleton, UiProgressBar, UiProgressCircle, UiEmptyState, UiResult, UiLoadingOverlay,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Feedback & status"
      lead="Communicate state: alerts, spinners, progress, skeletons, empty/result states, and a loading overlay.">

      <doc-section name="Alert" selector="ui-alert" [api]="alertApi" [outputs]="alertOut" [shapes]="ALERT"
        summary="Inline contextual message with an icon per tone. Project the body as content. danger and warning use role=alert, so screen readers announce them at once; info and success use role=status. dismissible adds a Dismiss button that only emits dismiss: the host hides the alert. The button's hit area grows to 44px on touch screens only.">
        <doc-demo code="<ui-alert tone=&quot;warning&quot; heading=&quot;Heads up&quot; [dismissible]=&quot;true&quot; (dismiss)=&quot;hide()&quot;>
  Message body
</ui-alert>">
          <div class="stack">
            <ui-alert tone="info" heading="Heads up">Inline informational message.</ui-alert>
            <ui-alert tone="success">Saved successfully.</ui-alert>
            @if (showWarning()) {
              <ui-alert tone="warning" [dismissible]="true" (dismiss)="showWarning.set(false)">Approaching your quota. Dismiss me.</ui-alert>
            } @else {
              <ui-button size="sm" variant="outline" (click)="showWarning.set(true)">Bring the warning back</ui-button>
            }
            <ui-alert tone="danger" heading="Error">Something went wrong.</ui-alert>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Spinner" selector="ui-spinner" [api]="spinnerApi"
        summary="Indeterminate activity indicator with role=status and label as its accessible name. Spins slower under reduced motion.">
        <doc-demo code="<ui-spinner size=&quot;lg&quot; label=&quot;Loading&quot; />">
          <div class="row items-center"><ui-spinner size="sm" /><ui-spinner /><ui-spinner size="lg" /></div>
        </doc-demo>
      </doc-section>

      <doc-section name="Shutter loader" selector="ui-shutter-loader" [api]="shutterApi"
        summary="A loading mark shaped like a camera shutter: six blades click shut three times, then rest open (a 2.1 s loop, under three flashes a second). Drawn in the current text colour, so inside a button it takes the label colour; color sets another. Announced like ui-spinner (role=status, 'Loading…' unless label says otherwise); decorative hides it when something nearby already says it is busy. Under reduced motion, and with animations off, the blades stay still and the mark gently fades in and out instead.">
        <doc-demo code="<ui-shutter-loader size=&quot;lg&quot; color=&quot;var(--ui-color-primary)&quot; />
<ui-shutter-loader [size]=&quot;48&quot; label=&quot;Loading photos&quot; />">
          <div class="row items-center">
            <ui-shutter-loader size="sm" color="var(--ui-color-primary)" />
            <ui-shutter-loader color="var(--ui-color-primary)" />
            <ui-shutter-loader size="lg" color="var(--ui-color-primary)" />
            <ui-shutter-loader [size]="48" color="var(--ui-color-primary)" />
            <ui-shutter-loader [size]="48" />
          </div>
        </doc-demo>
        <doc-demo code="<ui-button [loading]=&quot;true&quot;>Saving…</ui-button>
<div class=&quot;card&quot;><ui-shutter-loader [size]=&quot;28&quot; color=&quot;var(--ui-color-primary)&quot; decorative /> Loading photos…</div>">
          <div class="cols2">
            @for (t of shutterThemes; track t.theme) {
              <div class="shutter-panel" [attr.data-theme]="t.theme">
                <ui-text variant="label">{{ t.name }}</ui-text>
                <ui-shutter-loader [size]="72" color="var(--ui-color-primary)" />
                <shutter-config-scope>
                  <ui-button [loading]="true">Saving…</ui-button>
                </shutter-config-scope>
                <div class="shutter-card">
                  <ui-shutter-loader [size]="28" color="var(--ui-color-primary)" decorative />
                  <span>Loading photos…</span>
                </div>
              </div>
            }
          </div>
        </doc-demo>
        <ui-text variant="label" class="shutter-cap">App-wide: provideUiConfig({{ '{' }} spinner: 'shutter' {{ '}' }})</ui-text>
        <ui-text variant="body" class="shutter-note">Every ui-spinner and every busy mark the library draws (button loading, loading overlay, image picker, sign-in buttons, map locate, media lightbox, option-source picker) becomes the shutter, at the same size and colour. The default, 'ring', keeps the turning ring.</ui-text>
        <doc-demo lang="ts" code="// app.config.ts
providers: [provideUiConfig({ spinner: 'shutter' })]">
          <shutter-config-scope>
            <div class="stack">
              <div class="row items-center">
                <ui-spinner size="sm" /><ui-spinner /><ui-spinner size="lg" />
                <ui-button [loading]="true">Saving…</ui-button>
                <ui-button variant="outline" [loading]="true">Uploading</ui-button>
              </div>
              <div class="lo-host">
                <ui-loading-overlay [loading]="shutterOverlay()" />
                <ui-text variant="body">Content area</ui-text>
                <ui-button size="sm" variant="outline" (click)="runShutterOverlay()">Show overlay 2.1s</ui-button>
              </div>
            </div>
          </shutter-config-scope>
        </doc-demo>
        <ui-text variant="body" class="shutter-note">Flutter only: the shutter overscroll ball and UiPullToRefresh exist only in the Flutter library (zouriel_ui). Browsers own overscroll and pull-to-refresh on the web, so @zouriel/ui doesn't replace them.</ui-text>
      </doc-section>

      <doc-section name="Progress bar" selector="ui-progress-bar" [api]="progressApi"
        summary="Determinate (value 0–100, clamped) or indeterminate (value null). role=progressbar with label as its name; aria-valuenow, -min and -max are set only when determinate. For a value against a budget that turns warning and danger, use ui-meter from the same entry point (documented on the Design tools page).">
        <doc-demo code="<ui-progress-bar [value]=&quot;70&quot; tone=&quot;success&quot; />
<ui-progress-bar [value]=&quot;50&quot; tone=&quot;neutral&quot; label=&quot;Storage used&quot; />
<ui-progress-bar [value]=&quot;null&quot; label=&quot;Uploading&quot; />">
          <div class="stack">
            <ui-progress-bar [value]="35" />
            <ui-progress-bar [value]="70" tone="success" />
            <ui-progress-bar [value]="50" tone="neutral" label="Storage used" />
            <ui-progress-bar [value]="null" label="Uploading" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Progress circle" anchor="progress-circle" selector="ui-progress-circle" [api]="circleApi"
        summary="The round sibling of the progress bar: determinate with a value (0–100), a turning arc without one. showValue writes the percentage in the middle; projected content goes in the middle instead, such as a countdown's seconds. A progressbar named by label; under reduced motion the arc turns more slowly.">
        <doc-demo code="<ui-progress-circle [value]=&quot;65&quot; [showValue]=&quot;true&quot; label=&quot;Upload&quot; />
<ui-progress-circle [value]=&quot;left / 30 * 100&quot; [size]=&quot;96&quot; [strokeWidth]=&quot;6&quot; label=&quot;Seconds left&quot;>{{ '{{' }} left {{ '}}' }}</ui-progress-circle>">
          <div class="row">
            <ui-progress-circle [value]="65" [showValue]="true" label="Upload" />
            <ui-progress-circle label="Loading" />
            <ui-progress-circle [value]="countdown() / 30 * 100" [size]="96" [strokeWidth]="6" tone="success" label="Seconds left">{{ countdown() }}</ui-progress-circle>
            <ui-button size="sm" variant="outline" (click)="startCountdown()">Count down</ui-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Skeleton" selector="ui-skeleton" [api]="skeletonApi"
        summary="Content placeholder shown while data loads. It is aria-hidden, so pair it with something a screen reader hears (aria-busy on the region, or a status message). text is one line high (0.85em); rect and circle take their size from width and height. The shimmer stops under reduced motion.">
        <doc-demo code="<ui-skeleton shape=&quot;circle&quot; width=&quot;40px&quot; height=&quot;40px&quot; />
<ui-skeleton shape=&quot;text&quot; width=&quot;60%&quot; />
<ui-skeleton width=&quot;100%&quot; height=&quot;80px&quot; />">
          <div class="row items-center">
            <ui-skeleton shape="circle" width="40px" height="40px" />
            <div class="stack grow"><ui-skeleton shape="text" width="60%" /><ui-skeleton shape="text" width="90%" /></div>
          </div>
          <ui-skeleton width="100%" height="80px" />
        </doc-demo>
      </doc-section>

      <doc-section name="Loading overlay" selector="ui-loading-overlay" [api]="loadingApi"
        summary="Veils its positioned parent (place it inside a position:relative container) with a spinner and label while loading is true, which blocks clicks on the content beneath. The veil has role=status and fades in and out.">
        <doc-demo code="<div style=&quot;position:relative&quot;>
  <ui-loading-overlay [loading]=&quot;busy()&quot; label=&quot;Saving…&quot; />
  …content…
</div>">
          <div class="lo-host">
            <ui-loading-overlay [loading]="loading()" />
            <ui-text variant="body">Content area</ui-text>
            <ui-button size="sm" variant="outline" (click)="runLoading()">Show overlay 1.5s</ui-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Empty state" selector="ui-empty-state" [api]="emptyApi"
        summary="Placeholder for no content: heading, optional description, and two slots, [empty-icon] and [empty-actions]; empty slots collapse.">
        <doc-demo code="<ui-empty-state heading=&quot;No projects&quot; description=&quot;Create one to start.&quot;>
  <hugeicons-icon empty-icon [icon]=&quot;FolderAddIcon&quot; [size]=&quot;32&quot; />
  <ui-button empty-actions>New project</ui-button>
</ui-empty-state>">
          <ui-empty-state heading="No projects yet" description="Create your first project.">
            <hugeicons-icon empty-icon aria-hidden="true" [icon]="icons.folder" [size]="32" [strokeWidth]="1.5" /><ui-button empty-actions size="sm">New project</ui-button>
          </ui-empty-state>
        </doc-demo>
      </doc-section>

      <doc-section name="Result" selector="ui-result" [api]="resultApi"
        summary="Full outcome state: an icon per status, a title, an optional subtitle, and projected action buttons. 404 shows a question mark and 500 an exclamation mark. The icon is decorative; the title carries the meaning."
        [shapes]="RESULT">
        <doc-demo code="<ui-result status=&quot;success&quot; title=&quot;All done!&quot; subtitle=&quot;Published.&quot;>
  <ui-button>View</ui-button>
</ui-result>">
          <div class="cols2">
            <ui-result status="success" title="All done!" subtitle="Your changes were published.">
              <ui-button size="sm" variant="outline">View</ui-button>
            </ui-result>
            <ui-result status="404" title="Page not found" subtitle="The link may be old or mistyped.">
              <ui-button size="sm" variant="outline">Go home</ui-button>
            </ui-result>
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .stack { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .stack > ui-button { align-self: flex-start; }
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); }
    .items-center { align-items: center; }
    .grow { flex: 1; }
    .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-3); }
    @media (max-width: 640px) { .cols2 { grid-template-columns: 1fr; } }
    .shutter-panel { display: flex; flex-direction: column; align-items: center; gap: var(--ui-space-4); padding: var(--ui-space-6) var(--ui-space-4);
      border-radius: var(--ui-radius); background: var(--ui-color-bg); color: var(--ui-color-text); border: 1px solid var(--ui-color-border); }
    .shutter-card { display: flex; align-items: center; gap: var(--ui-space-3); align-self: stretch; padding: var(--ui-space-3) var(--ui-space-4);
      border-radius: var(--ui-radius); background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); color: var(--ui-color-text-muted); }
    .shutter-cap { display: block; margin: var(--ui-space-4) 0 var(--ui-space-1); }
    .shutter-note { display: block; color: var(--ui-color-text-muted); max-width: 66ch; margin: var(--ui-space-2) 0 var(--ui-space-3); }
    .lo-host { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: var(--ui-space-2); padding: var(--ui-space-4);
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); }
  `,
})
export class FeedbackPage {
  protected readonly icons = { folder: FolderAddIcon };
  protected readonly loading = signal(false);
  protected readonly showWarning = signal(true);
  protected readonly RESULT = `type UiResultStatus = 'success' | 'error' | 'info' | 'warning' | '404' | '500';`;
  protected readonly ALERT = `type UiAlertTone = 'info' | 'success' | 'warning' | 'danger';`;
  protected readonly shutterOverlay = signal(false);
  protected runShutterOverlay(): void { this.shutterOverlay.set(true); setTimeout(() => this.shutterOverlay.set(false), 2100); }
  protected readonly shutterThemes = [{ name: 'Light', theme: 'oxblood' }, { name: 'Dark', theme: 'oxblood-dark' }];
  protected readonly shutterApi: ApiRow[] = [
    { name: 'size', type: "'sm' | 'md' | 'lg' | number", default: "'md'", desc: "The spinner's boxes (14, 20, 32px) or a number of pixels. Every stroke scales with it." },
    { name: 'color', type: 'string', default: 'currentColor', desc: 'Any CSS colour; by default the text colour around it.' },
    { name: 'label', type: 'string', default: "'Loading…'", desc: 'Accessible name (aria-label); not shown.' },
    { name: 'decorative', type: 'boolean', default: 'false', desc: 'Hidden from screen readers, for when something nearby already says it is busy.' },
  ];
  protected runLoading(): void { this.loading.set(true); setTimeout(() => this.loading.set(false), 1500); }

  protected readonly alertApi: ApiRow[] = [
    { name: 'tone', type: 'UiAlertTone', default: "'info'", desc: 'Colour, ARIA role and icon.' },
    { name: 'heading', type: 'string', default: '—', desc: 'Optional bold title.' },
    { name: 'dismissible', type: 'boolean', default: 'false', desc: 'Show a Dismiss button.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly alertOut: ApiRow[] = [{ name: 'dismiss', type: 'void', default: '—', desc: 'Dismiss button pressed. The host decides whether to hide the alert.' }];
  protected readonly spinnerApi: ApiRow[] = [
    { name: 'size', type: SIZE, default: "'md'", desc: 'Diameter.' },
    { name: 'label', type: 'string', default: "'Loading'", desc: 'Accessible name (aria-label); not shown.' },
  ];
  protected readonly countdown = signal(30);
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  protected startCountdown(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdown.set(30);
    this.countdownTimer = setInterval(() => {
      this.countdown.update((v) => Math.max(0, v - 1));
      if (this.countdown() === 0 && this.countdownTimer) clearInterval(this.countdownTimer);
    }, 1000);
  }
  protected readonly circleApi: ApiRow[] = [
    { name: 'value', type: 'number | null', default: 'null', desc: '0–100 (clamped); null turns an indeterminate arc.' },
    { name: 'size / strokeWidth', type: 'number (px)', default: '40 / 4', desc: 'Diameter and ring thickness.' },
    { name: 'tone', type: 'UiStatus', default: "'primary'", desc: 'Arc colour.' },
    { name: 'label', type: 'string', default: "'Progress'", desc: 'Accessible name.' },
    { name: 'showValue', type: 'boolean', default: 'false', desc: 'Write the percentage in the middle.' },
    { name: '(content)', type: 'slot', default: '—', desc: 'Shown in the middle instead (countdown seconds).' },
  ];
  protected readonly progressApi: ApiRow[] = [
    { name: 'value', type: 'number | null', default: 'null', desc: '0–100, determinate; null, indeterminate.' },
    { name: 'tone', type: STATUS, default: "'primary'", desc: "Fill colour. 'neutral' is a grey fill (the muted text colour) for progress that is not a status." },
    { name: 'label', type: 'string', default: "'Progress'", desc: 'Accessible name (aria-label); not shown.' },
  ];
  protected readonly skeletonApi: ApiRow[] = [
    { name: 'shape', type: "'rect' | 'circle' | 'text'", default: "'rect'", desc: 'Placeholder shape.' },
    { name: 'width', type: 'string', default: '—', desc: "CSS width, e.g. '60%' or '40px'." },
    { name: 'height', type: 'string', default: '—', desc: "CSS height. Needed for rect and circle; text sets its own." },
  ];
  protected readonly loadingApi: ApiRow[] = [
    { name: 'loading', type: 'boolean', default: 'false', desc: 'Show the veil.' },
    { name: 'label', type: 'string', default: "'Loading…'", desc: 'Text under the spinner and the aria-label. Empty hides the text.' },
  ];
  protected readonly emptyApi: ApiRow[] = [
    { name: 'heading', type: 'string', default: "'Nothing here yet'", desc: 'Title.' },
    { name: 'description', type: 'string', default: '—', desc: 'Supporting text.' },
    { name: '[empty-icon] / [empty-actions]', type: 'slot', default: '—', desc: 'Icon above the heading; buttons below the text.' },
  ];
  protected readonly resultApi: ApiRow[] = [
    { name: 'status', type: 'UiResultStatus', default: "'info'", desc: 'Icon and colour.' },
    { name: 'title', type: 'string', default: "''", desc: 'Headline.' },
    { name: 'subtitle', type: 'string', default: '—', desc: 'Supporting text.' },
    { name: '<ng-content>', type: 'slot', default: '—', desc: 'Action buttons, centred below.' },
  ];
}
