import { Component, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import FolderAddIcon from '@hugeicons/core-free-icons/FolderAddIcon';
import { UiText } from '@zouriel/ui/text';
import { UiButton } from '@zouriel/ui/button';
import { UiAlert } from '@zouriel/ui/alert';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiSkeleton } from '@zouriel/ui/skeleton';
import { UiProgressBar } from '@zouriel/ui/progress';
import { UiEmptyState, UiResult, UiLoadingOverlay } from '@zouriel/ui/feedback';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const SIZE = "'sm' | 'md' | 'lg'";
const STATUS = "'neutral' | 'primary' | 'success' | 'warning' | 'danger'";

@Component({
  selector: 'page-feedback',
  imports: [HugeiconsIconComponent, 
    UiText, UiButton, UiAlert, UiSpinner, UiSkeleton, UiProgressBar, UiEmptyState, UiResult, UiLoadingOverlay,
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
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); }
    .items-center { align-items: center; }
    .grow { flex: 1; }
    .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-3); }
    @media (max-width: 640px) { .cols2 { grid-template-columns: 1fr; } }
    .lo-host { position: relative; display: flex; flex-direction: column; gap: var(--ui-space-2); padding: var(--ui-space-4);
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); min-height: 90px; }
  `,
})
export class FeedbackPage {
  protected readonly icons = { folder: FolderAddIcon };
  protected readonly loading = signal(false);
  protected readonly showWarning = signal(true);
  protected readonly RESULT = `type UiResultStatus = 'success' | 'error' | 'info' | 'warning' | '404' | '500';`;
  protected readonly ALERT = `type UiAlertTone = 'info' | 'success' | 'warning' | 'danger';`;
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
