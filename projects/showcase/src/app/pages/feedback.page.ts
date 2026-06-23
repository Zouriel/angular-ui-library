import { Component, signal } from '@angular/core';
import { UiText } from 'ui/text';
import { UiButton } from 'ui/button';
import { UiAlert } from 'ui/alert';
import { UiSpinner } from 'ui/spinner';
import { UiSkeleton } from 'ui/skeleton';
import { UiProgressBar } from 'ui/progress';
import { UiEmptyState, UiResult, UiLoadingOverlay } from 'ui/feedback';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const SIZE = "'sm' | 'md' | 'lg'";
const STATUS = "'neutral' | 'primary' | 'success' | 'warning' | 'danger'";

@Component({
  selector: 'page-feedback',
  imports: [
    UiText, UiButton, UiAlert, UiSpinner, UiSkeleton, UiProgressBar, UiEmptyState, UiResult, UiLoadingOverlay,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Feedback & status"
      lead="Communicate state: alerts, spinners, progress, skeletons, empty/result states, and a loading overlay.">

      <doc-section name="Alert" selector="ui-alert" [api]="alertApi" [outputs]="alertOut"
        summary="Inline contextual message. Project the body as content; danger/warning use role=alert, others role=status.">
        <doc-demo code="<ui-alert tone=&quot;warning&quot; heading=&quot;Heads up&quot; [dismissible]=&quot;true&quot; (dismiss)=&quot;hide()&quot;>
  Message body
</ui-alert>">
          <div class="stack">
            <ui-alert tone="info" heading="Heads up">Inline informational message.</ui-alert>
            <ui-alert tone="success">Saved successfully.</ui-alert>
            <ui-alert tone="warning" [dismissible]="true">Approaching your quota.</ui-alert>
            <ui-alert tone="danger" heading="Error">Something went wrong.</ui-alert>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Spinner" selector="ui-spinner" [api]="spinnerApi"
        summary="Indeterminate activity indicator (role=status).">
        <doc-demo code="<ui-spinner size=&quot;lg&quot; label=&quot;Loading&quot; />">
          <div class="row items-center"><ui-spinner size="sm" /><ui-spinner /><ui-spinner size="lg" /></div>
        </doc-demo>
      </doc-section>

      <doc-section name="Progress bar" selector="ui-progress-bar" [api]="progressApi"
        summary="Determinate (value 0–100) or indeterminate (value null). Sets aria-valuenow when determinate.">
        <doc-demo code="<ui-progress-bar [value]=&quot;70&quot; tone=&quot;success&quot; />
<ui-progress-bar [value]=&quot;null&quot; />   // null = indeterminate">
          <div class="stack">
            <ui-progress-bar [value]="35" />
            <ui-progress-bar [value]="70" tone="success" />
            <ui-progress-bar [value]="null" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Skeleton" selector="ui-skeleton" [api]="skeletonApi"
        summary="Content placeholder shown while data loads (aria-hidden).">
        <doc-demo code="<ui-skeleton shape=&quot;circle&quot; width=&quot;40px&quot; height=&quot;40px&quot; />
<ui-skeleton shape=&quot;text&quot; width=&quot;60%&quot; />">
          <div class="row items-center">
            <ui-skeleton shape="circle" width="40px" height="40px" />
            <div class="stack grow"><ui-skeleton shape="text" width="60%" /><ui-skeleton shape="text" width="90%" /></div>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Loading overlay" selector="ui-loading-overlay" [api]="loadingApi"
        summary="Veils its positioned parent (place inside a position:relative container) while loading is true.">
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
        summary="Placeholder for no-content. Project [empty-icon] and [empty-actions].">
        <doc-demo code="<ui-empty-state heading=&quot;No projects&quot; description=&quot;Create one to start.&quot;>
  <span empty-icon>📁</span>
  <ui-button empty-actions>New project</ui-button>
</ui-empty-state>">
          <ui-empty-state heading="No projects yet" description="Create your first project.">
            <span empty-icon>📁</span><ui-button empty-actions size="sm">New project</ui-button>
          </ui-empty-state>
        </doc-demo>
      </doc-section>

      <doc-section name="Result" selector="ui-result" [api]="resultApi"
        summary="Full outcome state. Project action buttons as content.">
        <doc-demo code="<ui-result status=&quot;success&quot; title=&quot;All done!&quot; subtitle=&quot;Published.&quot;>
  <ui-button>View</ui-button>
</ui-result>">
          <ui-result status="success" title="All done!" subtitle="Your changes were published.">
            <ui-button size="sm" variant="outline">View</ui-button>
          </ui-result>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .stack { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); }
    .items-center { align-items: center; }
    .grow { flex: 1; }
    .lo-host { position: relative; display: flex; flex-direction: column; gap: var(--ui-space-2); padding: var(--ui-space-4);
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); min-height: 90px; }
  `,
})
export class FeedbackPage {
  protected readonly loading = signal(false);
  protected runLoading(): void { this.loading.set(true); setTimeout(() => this.loading.set(false), 1500); }

  protected readonly alertApi: ApiRow[] = [
    { name: 'tone', type: "'info' | 'success' | 'warning' | 'danger'", default: "'info'", desc: 'Color + role + glyph.' },
    { name: 'heading', type: 'string', default: '—', desc: 'Optional bold title.' },
    { name: 'dismissible', type: 'boolean', default: 'false', desc: 'Show close button.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly alertOut: ApiRow[] = [{ name: 'dismiss', type: 'void', default: '—', desc: 'Close button pressed.' }];
  protected readonly spinnerApi: ApiRow[] = [
    { name: 'size', type: SIZE, default: "'md'", desc: 'Diameter.' },
    { name: 'label', type: 'string', default: "'Loading'", desc: 'aria-label.' },
  ];
  protected readonly progressApi: ApiRow[] = [
    { name: 'value', type: 'number | null', default: 'null', desc: '0–100 determinate; null = indeterminate.' },
    { name: 'tone', type: STATUS, default: "'primary'", desc: 'Fill color.' },
    { name: 'label', type: 'string', default: "'Progress'", desc: 'aria-label.' },
  ];
  protected readonly skeletonApi: ApiRow[] = [
    { name: 'shape', type: "'rect' | 'circle' | 'text'", default: "'rect'", desc: 'Placeholder shape.' },
    { name: 'width', type: 'string', default: '—', desc: 'CSS width.' },
    { name: 'height', type: 'string', default: '—', desc: 'CSS height.' },
  ];
  protected readonly loadingApi: ApiRow[] = [
    { name: 'loading', type: 'boolean', default: 'false', desc: 'Show the veil.' },
    { name: 'label', type: 'string', default: "'Loading…'", desc: 'Status text.' },
  ];
  protected readonly emptyApi: ApiRow[] = [
    { name: 'heading', type: 'string', default: "'Nothing here yet'", desc: 'Title.' },
    { name: 'description', type: 'string', default: '—', desc: 'Supporting text.' },
  ];
  protected readonly resultApi: ApiRow[] = [
    { name: 'status', type: "'success'|'error'|'info'|'warning'|'404'|'500'", default: "'info'", desc: 'Glyph + color.' },
    { name: 'title', type: 'string', default: "''", desc: 'Headline.' },
    { name: 'subtitle', type: 'string', default: '—', desc: 'Supporting text.' },
  ];
}
