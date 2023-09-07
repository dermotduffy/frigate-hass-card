import { afterEach, describe, expect, it, vi } from 'vitest';
import { getActionsFromQueryString } from '../../src/utils/querystring';

// @vitest-environment jsdom
describe('getActionsFromQueryString', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should reject malformed query string', () => {
    expect(getActionsFromQueryString(`?BOGUS_KEY=BOGUS_VALUE`)).toEqual([]);
  });

  it('should accept colon as delimiter', () => {
    expect(getActionsFromQueryString(`?frigate-card-action:id:clips=`)).toEqual([
      {
        action: 'fire-dom-event',
        card_id: 'id',
        frigate_card_action: 'clips',
      },
    ]);
  });

  describe('should get simple action from query string', () => {
    it.each([
      ['camera_ui' as const],
      ['clip' as const],
      ['clips' as const],
      ['default' as const],
      ['diagnostics' as const],
      ['download' as const],
      ['expand' as const],
      ['image' as const],
      ['live' as const],
      ['menu_toggle' as const],
      ['recording' as const],
      ['recordings' as const],
      ['snapshot' as const],
      ['snapshots' as const],
      ['timeline' as const],
    ])('%s', (action: string) => {
      expect(getActionsFromQueryString(`?frigate-card-action.id.${action}=`)).toEqual([
        {
          action: 'fire-dom-event',
          card_id: 'id',
          frigate_card_action: action,
        },
      ]);
    });
  });

  it('should get camera_select action', () => {
    expect(
      getActionsFromQueryString(`?frigate-card-action.id.camera_select=camera.foo`),
    ).toEqual([
      {
        action: 'fire-dom-event',
        card_id: 'id',
        frigate_card_action: 'camera_select',
        camera: 'camera.foo',
      },
    ]);
  });

  it('should get live_substream_select action', () => {
    expect(
      getActionsFromQueryString(
        `?frigate-card-action.id.live_substream_select=camera.bar`,
      ),
    ).toEqual([
      {
        action: 'fire-dom-event',
        card_id: 'id',
        frigate_card_action: 'live_substream_select',
        camera: 'camera.bar',
      },
    ]);
  });

  describe('should reject value-based actions without value', () => {
    it.each([['camera_select' as const], ['live_substream_select' as const]])(
      '%s',
      (action: string) => {
        expect(getActionsFromQueryString(`?frigate-card-action.id.${action}=`)).toEqual(
          [],
        );
      },
    );
  });

  it('should log unknown but correctly formed action', () => {
    const spy = vi.spyOn(global.console, 'warn').mockImplementation(() => true);

    expect(
      getActionsFromQueryString(`?frigate-card-action.id.not_a_real_action}=`),
    ).toEqual([]);

    expect(spy).toBeCalledWith(
      'Frigate card received unknown card action in query string: not_a_real_action',
    );
  });
});
