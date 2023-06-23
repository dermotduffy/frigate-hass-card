import { handleActionConfig, hasAction } from 'custom-card-helpers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  actionSchema,
  FrigateCardAction,
  FrigateCardCustomAction,
  frigateCardCustomActionSchema,
} from '../../src/types';
import {
  convertActionToFrigateCardCustomAction,
  createFrigateCardCustomAction,
  frigateCardHandleAction,
  frigateCardHandleActionConfig,
  frigateCardHasAction,
  getActionConfigGivenAction,
  isViewAction,
  stopEventFromActivatingCardWideActions,
} from '../../src/utils/action';
import { createHASS } from '../test-utils';

vi.mock('custom-card-helpers');

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

describe('createFrigateCardCustomAction', () => {
  it('should create camera_select', () => {
    expect(
      createFrigateCardCustomAction('camera_select', {
        camera: 'camera',
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      camera: 'camera',
      frigate_card_action: 'camera_select',
      card_id: 'card_id',
    });
  });

  it('should not create camera_select without camera', () => {
    expect(createFrigateCardCustomAction('camera_select')).toBeNull();
  });

  it('should create media_player', () => {
    expect(
      createFrigateCardCustomAction('media_player', {
        media_player: 'device',
        media_player_action: 'play',
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

  it('should not create media_player without player or action', () => {
    expect(
      createFrigateCardCustomAction('media_player', {
        media_player_action: 'play',
      }),
    ).toBeNull();

    expect(
      createFrigateCardCustomAction('media_player', {
        media_player: 'device',
      }),
    ).toBeNull();
  });

  it('should create general action', () => {
    expect(
      createFrigateCardCustomAction('clips', {
        cardID: 'card_id',
      }),
    ).toEqual({
      action: 'fire-dom-event',
      frigate_card_action: 'clips',
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
    expect(getActionConfigGivenAction()).toBeUndefined();
  });

  it('should not handle unknown interactions', () => {
    expect(
      getActionConfigGivenAction('triple_poke', { triple_poke_action: action }),
    ).toBeUndefined();
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
    frigateCardHandleActionConfig(element, createHASS(), {}, 'tap', action);
    expect(handleActionConfig).toBeCalled();
  });

  it('should handle array case', () => {
    frigateCardHandleActionConfig(element, createHASS(), {}, 'tap', [
      action,
      action,
      action,
    ]);
    expect(handleActionConfig).toBeCalledTimes(3);
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

describe('isViewAction', () => {
  const createAction = (action: FrigateCardAction): FrigateCardCustomAction => {
    return frigateCardCustomActionSchema.parse({
      action: 'fire-dom-event' as const,
      frigate_card_action: action,
    });
  };
  it('should return true for clip view ', () => {
    expect(isViewAction(createAction('clip'))).toBeTruthy();
  });
  it('should return true for clips view ', () => {
    expect(isViewAction(createAction('clips'))).toBeTruthy();
  });
  it('should return true for image view ', () => {
    expect(isViewAction(createAction('image'))).toBeTruthy();
  });
  it('should return true for live view ', () => {
    expect(isViewAction(createAction('live'))).toBeTruthy();
  });
  it('should return true for recording view ', () => {
    expect(isViewAction(createAction('recording'))).toBeTruthy();
  });
  it('should return true for live view ', () => {
    expect(isViewAction(createAction('live'))).toBeTruthy();
  });
  it('should return true for recordings view ', () => {
    expect(isViewAction(createAction('recordings'))).toBeTruthy();
  });
  it('should return true for snapshot view ', () => {
    expect(isViewAction(createAction('snapshot'))).toBeTruthy();
  });
  it('should return true for snapshots view ', () => {
    expect(isViewAction(createAction('snapshots'))).toBeTruthy();
  });
  it('should return true for timeline view ', () => {
    expect(isViewAction(createAction('timeline'))).toBeTruthy();
  });
  it('should return false for anything else', () => {
    expect(isViewAction(createAction('diagnostics'))).toBeFalsy();
  });
});
