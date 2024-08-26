import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutomationsManager } from '../../src/card-controller/automations-manager.js';
import { createCardAPI } from '../test-utils.js';
import { ActionType } from '../../src/config/types.js';
import { AuxillaryActionConfig } from '../../src/card-controller/actions/types.js';

describe('AutomationsManager', () => {
  const actions = [
    {
      action: 'fire-dom-event' as const,
      frigate_card_action: 'clips',
    },
  ];
  const conditions = [{ condition: 'fullscreen' as const, fullscreen: true }];
  const automation = {
    conditions: conditions,
    actions: actions,
  };
  const not_automation = {
    conditions: conditions,
    actions_not: actions,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing without hass', () => {
    const api = createCardAPI();

    const automationsManager = new AutomationsManager(api);
    automationsManager.execute();

    expect(api.getActionsManager().executeActions).not.toBeCalled();
  });

  it('should do nothing without being initialized', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      false,
    );

    const automationsManager = new AutomationsManager(api);
    automationsManager.execute();

    expect(api.getActionsManager().executeActions).not.toBeCalled();
  });

  it('should do nothing without automations', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );

    const automationsManager = new AutomationsManager(api);
    automationsManager.execute();

    expect(api.getActionsManager().executeActions).not.toBeCalled();
  });

  it('should execute actions', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );

    const automationsManager = new AutomationsManager(api);
    automationsManager.addAutomations([automation]);

    automationsManager.execute();
    expect(api.getActionsManager().executeActions).not.toBeCalled();

    vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(true);

    automationsManager.execute();
    expect(api.getActionsManager().executeActions).toBeCalledTimes(1);

    // Automation will not re-fire when condition continues to evaluate the
    // same.
    automationsManager.execute();
    expect(api.getActionsManager().executeActions).toBeCalledTimes(1);

    vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(false);

    automationsManager.execute();
    expect(api.getActionsManager().executeActions).toBeCalledTimes(1);

    vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(true);

    automationsManager.execute();
    expect(api.getActionsManager().executeActions).toBeCalledTimes(2);
  });

  it('should execute actions_not', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );

    vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(false);

    const automationsManager = new AutomationsManager(api);
    automationsManager.addAutomations([not_automation]);

    automationsManager.execute();

    expect(api.getActionsManager().executeActions).toBeCalled();
  });

  it('should prevent automation loops', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );

    const automationsManager = new AutomationsManager(api);
    automationsManager.addAutomations([automation, not_automation]);

    // Create a setup where one automation action causes another...
    let evaluation = true;

    vi.mocked(api.getActionsManager().executeActions).mockImplementation(
      async (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _action: ActionType | ActionType[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _config?: AuxillaryActionConfig,
      ): Promise<void> => {
        evaluation = !evaluation;
        vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(
          evaluation,
        );
        automationsManager.execute();
      },
    );

    vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(evaluation);

    automationsManager.execute();

    expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
      expect.objectContaining({
        type: 'error',
        message:
          'Too many nested automation calls, please check your configuration for loops',
      }),
    );

    expect(api.getActionsManager().executeActions).toBeCalledTimes(10);
  });

  it('should delete automations', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );

    const automationsManager = new AutomationsManager(api);
    automationsManager.addAutomations([automation]);

    vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(true);

    automationsManager.execute();
    expect(api.getActionsManager().executeActions).toBeCalledTimes(1);

    automationsManager.deleteAutomations();

    automationsManager.execute();
    expect(api.getActionsManager().executeActions).toBeCalledTimes(1);
  });
});
