import { describe, expect, it } from 'vitest';
import * as api from './public-api';

describe('public API', () => {
  it('exports the components and helpers apps use', () => {
    for (const name of [
      'UiWorkflowBuilder', 'UiWorkflowPanel', 'UiWorkflowAudit', 'UiWorkflowStateBadge', 'UiWorkflowTasksDrawer', 'UiWorkflowPermissions',
      'UiWorkflowGlobalSettings', 'UiWorkflowHttpApi', 'provideUiWorkflow', 'UI_WORKFLOW_API', 'UI_WORKFLOW_CLOCK', 'createWorkflow', 'createStep',
      'insertStep', 'moveStep', 'removeStep', 'indexSteps', 'listSteps', 'tokensAt', 'describeTrigger', 'describeStep', 'autoLayout', 'wfStatesFrom',
      'wfDescribeHistory',
    ]) expect(api, name).toHaveProperty(name);
  });

  it('keeps the runtime views\' inner parts internal', () => {
    for (const name of ['WfDecideDialog', 'WfRecordActions', 'WfTaskInbox', 'WfRunView', 'wfRemarksFor', 'wfPanelPath', 'permissionRows', 'emptyWhoText', 'sameWho', 'wfFormAnswers', 'wfSkipValue']) {
      expect(api, name).not.toHaveProperty(name);
    }
  });
});
