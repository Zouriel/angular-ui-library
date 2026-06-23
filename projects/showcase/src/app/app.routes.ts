import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/overview.page').then((m) => m.OverviewPage), title: 'UI — Overview' },
  { path: 'foundation', loadComponent: () => import('./pages/foundation.page').then((m) => m.FoundationPage), title: 'UI — Foundation' },
  { path: 'typography', loadComponent: () => import('./pages/typography.page').then((m) => m.TypographyPage), title: 'UI — Typography' },
  { path: 'layout', loadComponent: () => import('./pages/layout.page').then((m) => m.LayoutPage), title: 'UI — Layout' },
  { path: 'buttons', loadComponent: () => import('./pages/buttons.page').then((m) => m.ButtonsPage), title: 'UI — Buttons' },
  { path: 'forms', loadComponent: () => import('./pages/forms.page').then((m) => m.FormsPage), title: 'UI — Forms' },
  { path: 'overlays', loadComponent: () => import('./pages/overlays.page').then((m) => m.OverlaysPage), title: 'UI — Overlays' },
  { path: 'feedback', loadComponent: () => import('./pages/feedback.page').then((m) => m.FeedbackPage), title: 'UI — Feedback' },
  { path: 'navigation', loadComponent: () => import('./pages/navigation.page').then((m) => m.NavigationPage), title: 'UI — Navigation' },
  { path: 'data', loadComponent: () => import('./pages/data.page').then((m) => m.DataPage), title: 'UI — Data' },
  { path: 'media', loadComponent: () => import('./pages/media.page').then((m) => m.MediaPage), title: 'UI — Media' },
  { path: 'window', loadComponent: () => import('./pages/window.page').then((m) => m.WindowPage), title: 'UI — Window' },
  { path: 'file-viewer', loadComponent: () => import('./pages/file-viewer.page').then((m) => m.FileViewerPage), title: 'UI — File Viewer' },
  { path: 'fx', loadComponent: () => import('./pages/fx.page').then((m) => m.FxPage), title: 'UI — Motion & FX' },
  { path: 'behaviors', loadComponent: () => import('./pages/behaviors.page').then((m) => m.BehaviorsPage), title: 'UI — Behaviors' },
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
