import { handleActionConfig, hasAction } from '@dermotduffy/custom-card-helpers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { actionSchema } from '../../src/config/types';
import {
  convertActionToFrigateCardCustomAction,
  createFrigateCardCameraAction,
  createFrigateCardDisplayModeAction,
  createFrigateCardMediaPlayerAction,
  createFrigateCardShowPTZAction,
  createFrigateCardSimpleAction,
  frigateCardHandleAction,
  frigateCardHandleActionConfig,
  frigateCardHasAction,
  getActionConfigGivenAction,
  stopEventFromActivatingCardWideActions,
} from '../../src/utils/action';
import { createHASS } from '../test-utils';

vi.mock('@dermotduffy/custom-card-helpers');

describe('convertActionToFrigateCardCustomAction', () => {
  it('should skip null action', () => {
    expect(convertActionToFrigateCardCustomAction(null)).toBeFalsy();
  });

  it('should parse valid', () => {
    expect(
      convertActionToFrigateCardCustomAction({
        action: 'custom:frigate-card-action',
        frigate_card_action: 'download',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      frigate_card_action: 'download',
    });
  });

  it('should not parse invalid', () => {
    expect(convertActionToFrigateCardCustomAction('this is garbage')).toBeNull();
  });
});

describe('createFrigateCardSimpleAction', () => {
  it('should create general action', () => {
    expect(
      createFrigateCardSimpleAction('clips', {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      frigate_card_action: 'clips',
      card_id: 'card_id',
    });
  });
});

describe('createFrigateCardCameraAction', () => {
  it('should create camera_select', () => {
    expect(
      createFrigateCardCameraAction('camera_select', 'camera', { cardID: 'card_id' }),
    ).toEqual({
      action: 'fire-dom-event',
      camera: 'camera',
      frigate_card_action: 'camera_select',
      card_id: 'card_id',
    });
  });
});

describe('createFrigateCardMediaPlayerAction', () => {
  it('should create media_player', () => {
    expect(
      createFrigateCardMediaPlayerAction('device', 'play', {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      frigate_card_action: 'media_player',
      media_player: 'device',
      media_player_action: 'play',
      card_id: 'card_id',
    });
  });
});

describe('createFrigateCardDisplayModeAction', () => {
  it('should create display mode action', () => {
    expect(
      createFrigateCardDisplayModeAction('grid', {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      frigate_card_action: 'display_mode_select',
      display_mode: 'grid',
      card_id: 'card_id',
    });
  });
});

describe('createFrigateCardShowPTZAction', () => {
  it('should create show PTZ action', () => {
    expect(
      createFrigateCardShowPTZAction(true, {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      frigate_card_action: 'show_ptz',
      show_ptz: true,
      card_id: 'card_id',
    });
  });
});

describe('getActionConfigGivenAction', () => {
  const action = actionSchema.parse({
    action: 'fire-dom-event',
    frigate_card_action: 'clips',
  });

  it('should not handle undefined arguments', () => {
    expect(getActionConfigGivenAction()).toBeNull();
  });

  it('should not handle unknown interactions', () => {
    expect(
      getActionConfigGivenAction('triple_poke', { triple_poke_action: action }),
    ).toBeNull();
  });

  it('should handle tap actions', () => {
    expect(getActionConfigGivenAction('tap', { tap_action: action })).toBe(action);
  });

  it('should handle hold actions', () => {
    expect(getActionConfigGivenAction('hold', { hold_action: action })).toBe(action);
  });

  it('should handle double_tap actions', () => {
    expect(getActionConfigGivenAction('double_tap', { double_tap_action: action })).toBe(
      action,
    );
  });

  it('should handle end_tap actions', () => {
    expect(getActionConfigGivenAction('end_tap', { end_tap_action: action })).toBe(
      action,
    );
  });

  it('should handle start_tap actions', () => {
    expect(getActionConfigGivenAction('start_tap', { start_tap_action: action })).toBe(
      action,
    );
  });
});

// @vitest-environment jsdom
describe('frigateCardHandleActionConfig', () => {
  const element = document.createElement('div');
  const action = actionSchema.parse({
    action: 'none',
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not handle missing arguments', () => {
    expect(
      frigateCardHandleActionConfig(element, createHASS(), {}, 'triple_poke'),
    ).toBeFalsy();
  });

  it('should handle simple case', () => {
    const hass = createHASS();
    frigateCardHandleActionConfig(element, hass, {}, 'tap', action);
    expect(handleActionConfig).toBeCalled();
    expect(handleActionConfig).toBeCalledWith(element, hass, {}, action);
  });

  it('should handle array case', () => {
    const hass = createHASS();
    frigateCardHandleActionConfig(element, hass, {}, 'tap', [action, action, action]);
    expect(handleActionConfig).toBeCalledTimes(3);
    expect(handleActionConfig).toBeCalledWith(element, hass, {}, action);
  });

  it('should handle null case', () => {
    const hass = createHASS();
    frigateCardHandleActionConfig(element, hass, {}, 'tap', null);
    expect(handleActionConfig).toBeCalledWith(element, hass, {}, undefined);
  });
});

// @vitest-environment jsdom
describe('frigateCardHandleAction', () => {
  const element = document.createElement('div');
  const action = actionSchema.parse({
    action: 'none',
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call action handler', () => {
    frigateCardHandleAction(element, createHASS(), {}, action);
    expect(handleActionConfig).toBeCalled();
  });
});

describe('frigateCardHasAction', () => {
  const action = actionSchema.parse({
    action: 'toggle',
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle non-array case', () => {
    expect(frigateCardHasAction(action)).toBeFalsy();
    expect(hasAction).toBeCalledTimes(1);
  });
  it('should handle array case', () => {
    expect(frigateCardHasAction([action, action, action])).toBeFalsy();
    expect(hasAction).toBeCalledTimes(3);
  });
});

// @vitest-environment jsdom
describe('stopEventFromActivatingCardWideActions', () => {
  it('should stop event from propogating', () => {
    const event = mock<Event>();
    stopEventFromActivatingCardWideActions(event);
    expect(event.stopPropagation).toBeCalled();
  });
});
