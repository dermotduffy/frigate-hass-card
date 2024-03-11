import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutomationsManager } from '../../src/card-controller/automations-manager.js';
import { frigateCardHandleAction } from '../../src/utils/action.js';
import { createCardAPI, createConfig, createHASS } from '../test-utils.js';

vi.mock('../../src/utils/action.js');

describe('AutomationsManager', () => {
  const actions = [
    {
      action: 'custom:frigate-card-action',
      frigate_card_action: 'clips',
    },
  ];
  const conditions = [{ condition: 'fullscreen', fullscreen: true }];

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing without hass', () => {
    const api = createCardAPI();

    const automationsManager = new AutomationsManager(api);
    automationsManager.execute();
    expect(frigateCardHandleAction).not.toBeCalled();
  });

  it('should do nothing without automations', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

    const automationsManager = new AutomationsManager(api);
    automationsManager.setAutomationsFromConfig();
    automationsManager.execute();
    expect(frigateCardHandleAction).not.toBeCalled();
  });

  it('should execute actions', () => {
    const config = createConfig({
      automations: [
        {
          conditions: conditions,
          actions: actions,
        },
      ],
    });

    const api = createCardAPI();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    vi.mocked(api.getConfigManager().getNonOverriddenConfig).mockReturnValue(config);

    const automationsManager = new AutomationsManager(api);
    automationsManager.setAutomationsFromConfig();

    automationsManager.execute();
    expect(frigateCardHandleAction).not.toBeCalled();

    vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(true);

    automationsManager.execute();
    expect(frigateCardHandleAction).toBeCalledTimes(1);

    // Automation will not re-fire when condition continues to evaluate the
    // same.
    automationsManager.execute();
    expect(frigateCardHandleAction).toBeCalledTimes(1);

    vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(false);

    automationsManager.execute();
    expect(frigateCardHandleAction).toBeCalledTimes(1);

    vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(true);

    automationsManager.execute();
    expect(frigateCardHandleAction).toBeCalledTimes(2);
  });

  it('should execute actions_not', () => {
    const config = createConfig({
      automations: [
        {
          conditions: conditions,
          actions_not: actions,
        },
      ],
    });

    const api = createCardAPI();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    vi.mocked(api.getConfigManager().getNonOverriddenConfig).mockReturnValue(config);
    vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(false);

    const automationsManager = new AutomationsManager(api);
    automationsManager.setAutomationsFromConfig();

    automationsManager.execute();

    expect(frigateCardHandleAction).toBeCalled();
  });

  it('should prevent automation loops', () => {
    const config = createConfig({
      automations: [
        {
          conditions: [{ condition: 'fullscreen' as const, fullscreen: true }],
          actions: actions,
        },
        {
          conditions: [{ condition: 'fullscreen' as const, fullscreen: true }],
          actions_not: actions,
        },
      ],
    });

    const api = createCardAPI();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    vi.mocked(api.getConfigManager().getNonOverriddenConfig).mockReturnValue(config);

    const automationsManager = new AutomationsManager(api);
    automationsManager.setAutomationsFromConfig();

    // Create a setup where one automation action causes another...
    let evaluation = true;
    vi.mocked(frigateCardHandleAction).mockImplementation(() => {
      evaluation = !evaluation;
      vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(
        evaluation,
      );
      automationsManager.execute();
    });

    vi.mocked(api.getConditionsManager().evaluateConditions).mockReturnValue(evaluation);

    automationsManager.execute();

    expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
      expect.objectContaining({
        type: 'error',
        message:
          'Too many nested automation calls, please check your configuration for loops',
      }),
    );

    expect(frigateCardHandleAction).toBeCalledTimes(10);
  });
});
