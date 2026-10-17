import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/overview.page').then((m) => m.OverviewPage), title: 'Overview · @zouriel/ui' },
  { path: 'foundation', loadComponent: () => import('./pages/foundation.page').then((m) => m.FoundationPage), title: 'Foundation · @zouriel/ui' },
  { path: 'typography', loadComponent: () => import('./pages/typography.page').then((m) => m.TypographyPage), title: 'Typography · @zouriel/ui' },
  { path: 'layout', loadComponent: () => import('./pages/layout.page').then((m) => m.LayoutPage), title: 'Layout & grid · @zouriel/ui' },
  { path: 'buttons', loadComponent: () => import('./pages/buttons.page').then((m) => m.ButtonsPage), title: 'Buttons & actions · @zouriel/ui' },
  { path: 'forms', loadComponent: () => import('./pages/forms.page').then((m) => m.FormsPage), title: 'Form controls · @zouriel/ui' },
  { path: 'overlays', loadComponent: () => import('./pages/overlays.page').then((m) => m.OverlaysPage), title: 'Overlays & dialogs · @zouriel/ui' },
  { path: 'feedback', loadComponent: () => import('./pages/feedback.page').then((m) => m.FeedbackPage), title: 'Feedback & status · @zouriel/ui' },
  { path: 'navigation', loadComponent: () => import('./pages/navigation.page').then((m) => m.NavigationPage), title: 'Navigation · @zouriel/ui' },
  { path: 'data', loadComponent: () => import('./pages/data.page').then((m) => m.DataPage), title: 'Data display · @zouriel/ui' },
  { path: 'media', loadComponent: () => import('./pages/media.page').then((m) => m.MediaPage), title: 'Media · @zouriel/ui' },
  { path: 'window', loadComponent: () => import('./pages/window.page').then((m) => m.WindowPage), title: 'Window system · @zouriel/ui' },
  { path: 'design-tools', loadComponent: () => import('./pages/design-tools.page').then((m) => m.DesignToolsPage), title: 'Design tools · @zouriel/ui' },
  { path: 'form-builder', loadComponent: () => import('./pages/form-builder.page').then((m) => m.FormBuilderPage), title: 'Form builder · @zouriel/ui' },
  { path: 'workflow-builder', loadComponent: () => import('./pages/workflow-builder.page').then((m) => m.WorkflowBuilderPage), title: 'Workflow builder · @zouriel/ui' },
  { path: 'workflow-studio', loadComponent: () => import('./pages/workflow-studio.page').then((m) => m.WorkflowStudioPage), title: 'Workflow studio (playground) · @zouriel/ui' },
  { path: 'form-studio', loadComponent: () => import('./pages/form-studio.page').then((m) => m.FormStudioPage), title: 'Form studio (playground) · @zouriel/ui' },
  { path: 'file-viewer', loadComponent: () => import('./pages/file-viewer.page').then((m) => m.FileViewerPage), title: 'File viewer · @zouriel/ui' },
  { path: 'fx', loadComponent: () => import('./pages/fx.page').then((m) => m.FxPage), title: 'Motion & FX · @zouriel/ui' },
  { path: 'behaviors', loadComponent: () => import('./pages/behaviors.page').then((m) => m.BehaviorsPage), title: 'Behavior directives · @zouriel/ui' },
  { path: '**', redirectTo: '' },
];

/** Sidebar structure (label + route), shared by the shell. */
export const NAV = [
  {
    label: 'Getting started',
    items: [
      { label: 'Overview', value: '' },
      { label: 'Foundation', value: 'foundation' },
      { label: 'Typography', value: 'typography' },
    ],
  },
  {
    label: 'Layout',
    items: [{ label: 'Layout & grid', value: 'layout' }],
  },
  {
    label: 'Components',
    items: [
      { label: 'Buttons & actions', value: 'buttons' },
      { label: 'Form controls', value: 'forms' },
      { label: 'Overlays & dialogs', value: 'overlays' },
      { label: 'Feedback & status', value: 'feedback' },
      { label: 'Navigation', value: 'navigation' },
      { label: 'Data display', value: 'data' },
      { label: 'Media', value: 'media' },
    ],
  },
  {
    label: 'Flagship',
    items: [
      { label: 'Window system', value: 'window' },
      { label: 'File viewer', value: 'file-viewer' },
      { label: 'Design tools', value: 'design-tools' },
      { label: 'Form builder', value: 'form-builder' },
      { label: 'Form studio (playground)', value: 'form-studio' },
      { label: 'Workflow builder', value: 'workflow-builder' },
      { label: 'Workflow studio (playground)', value: 'workflow-studio' },
    ],
  },
  {
    label: 'Motion',
    items: [
      { label: 'Motion & FX', value: 'fx' },
      { label: 'Behavior directives', value: 'behaviors' },
    ],
  },
];
