import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { AutomationsController, AutomationsControllerError } from '../src/automations';
import { ConditionController } from '../src/conditions';
import { automationsSchema, FrigateCardError } from '../src/types';
import { frigateCardHandleAction } from '../src/utils/action.js';
import { createHASS } from './test-utils';

vi.mock('../src/utils/action.js');

describe('AutomationsController', () => {
  const actions = [
    {
      action: 'custom:frigate-card-action',
      frigate_card_action: 'clips',
    },
  ];
  const conditions = { fullscreen: true };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing without automations', () => {
    const automationController = new AutomationsController(undefined);
    automationController.execute(
      mock<HTMLElement>(),
      createHASS(),
      new ConditionController(),
    );
    expect(frigateCardHandleAction).not.toBeCalled();
  });

  it('should execute actions', () => {
    const automations = automationsSchema.parse([
      {
        conditions: conditions,
        actions: actions,
      },
    ]);

    const automationController = new AutomationsController(automations);
    const conditionController = new ConditionController();
    const element = mock<HTMLElement>();
    const hass = createHASS();

    automationController.execute(element, hass, conditionController);
    expect(frigateCardHandleAction).not.toBeCalled();

    conditionController.setState({ fullscreen: true });
    automationController.execute(element, hass, conditionController);
    expect(frigateCardHandleAction).toBeCalledTimes(1);

    // Automation will not re-fire when condition continues to evaluate the
    // same.
    automationController.execute(element, hass, conditionController);
    expect(frigateCardHandleAction).toBeCalledTimes(1);

    conditionController.setState({ fullscreen: false });
    automationController.execute(element, hass, conditionController);
    expect(frigateCardHandleAction).toBeCalledTimes(1);

    conditionController.setState({ fullscreen: true });
    automationController.execute(element, hass, conditionController);
    expect(frigateCardHandleAction).toBeCalledTimes(2);
  });

  it('should execute actions_not', () => {
    const automations = automationsSchema.parse([
      {
        conditions: conditions,
        actions_not: actions,
      },
    ]);

    const automationController = new AutomationsController(automations);
    automationController.execute(
      mock<HTMLElement>(),
      createHASS(),
      new ConditionController(),
    );
    expect(frigateCardHandleAction).toBeCalled();
  });

  it('should prevent automation loops', () => {
    const automations = automationsSchema.parse([
      {
        conditions: { fullscreen: true },
        actions: actions,
      },
      {
        conditions: { fullscreen: false },
        actions: actions,
      },
    ]);

    const automationController = new AutomationsController(automations);
    const conditionController = new ConditionController();
    const element = mock<HTMLElement>();
    const hass = createHASS();

    // Create a setup where one automation action causes another...
    let fullscreen = true;
    vi.mocked(frigateCardHandleAction).mockImplementation(() => {
      fullscreen = !fullscreen;
      conditionController.setState({ fullscreen: fullscreen });
      automationController.execute(element, hass, conditionController);
    });

    conditionController.setState({ fullscreen: fullscreen });

    expect(() =>
      automationController.execute(element, hass, conditionController),
    ).toThrowError(/Too many nested automation calls/);
    expect(frigateCardHandleAction).toBeCalledTimes(10);
  }); 

  it('should be able to construct error', () => {
    const error = new AutomationsControllerError('message');
    expect(error).toBeTruthy();
    expect(error instanceof FrigateCardError).toBeTruthy();
  });
});
