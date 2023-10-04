import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCardAPI } from '../test-utils';
import { QueryStringManager } from '../../src/card-controller/query-string-manager';
import { mock } from 'vitest-mock-extended';

const setQueryString = (qs: string): void => {
  const location: Location = mock<Location>();
  location.search = qs;
  global.window.location = location;
};

// @vitest-environment jsdom
describe('QueryStringManager', () => {
  beforeEach(() => {
    global.window.location = mock<Location>();
  });

  it('should reject malformed query string', () => {
    setQueryString('BOGUS_KEY=BOGUS_VALUE');
    const api = createCardAPI();
    vi.mocked(api.getMessageManager().hasMessage).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    manager.executeAll();

    expect(manager.hasViewRelatedActions()).toBeFalsy();
    expect(api.getActionsManager().executeAction).not.toBeCalled();
    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  describe('should execute view name action from query string', () => {
    it.each([
      ['clip' as const],
      ['clips' as const],
      ['diagnostics' as const],
      ['image' as const],
      ['live' as const],
      ['recording' as const],
      ['recordings' as const],
      ['snapshot' as const],
      ['snapshots' as const],
      ['timeline' as const],
    ])('%s', (viewName: string) => {
      setQueryString(`?frigate-card-action.id.${viewName}=`);
      const api = createCardAPI();

      // View actions do not need the card to have been updated.
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);
      const manager = new QueryStringManager(api);

      manager.executeAll();

      expect(manager.hasViewRelatedActions()).toBeTruthy();
      expect(api.getViewManager().setViewByParameters).toBeCalledWith({
        viewName: viewName,
      });
    });
  });

  describe('should execute non-view action from query string', () => {
    it.each([
      ['camera_ui' as const],
      ['download' as const],
      ['expand' as const],
      ['menu_toggle' as const],
    ])('%s', (action: string) => {
      setQueryString(`?frigate-card-action.id.${action}=`);
      const api = createCardAPI();
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      manager.executeAll();

      expect(manager.hasViewRelatedActions()).toBeFalsy();
      expect(api.getActionsManager().executeAction).toBeCalledWith({
        action: 'fire-dom-event',
        card_id: 'id',
        frigate_card_action: action,
      });
    });
  });

  it('should execute view default action', () => {
    setQueryString('?frigate-card-action.id.default=');
    const api = createCardAPI();
    // View actions do not need the card to have been updated.
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);

    const manager = new QueryStringManager(api);

    manager.executeAll();

    expect(api.getViewManager().setViewDefault).toBeCalled();

    expect(manager.hasViewRelatedActions()).toBeTruthy();
    expect(api.getActionsManager().executeAction).not.toBeCalled();
    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  it('should execute camera_select action', () => {
    setQueryString('?frigate-card-action.id.camera_select=camera.office');
    const api = createCardAPI();
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    manager.executeAll();

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      cameraID: 'camera.office',
    });

    expect(manager.hasViewRelatedActions()).toBeTruthy();
    expect(api.getActionsManager().executeAction).not.toBeCalled();
    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });

  it('should execute live_substream_select action', () => {
    setQueryString('?frigate-card-action.id.live_substream_select=camera.office_hd');
    const api = createCardAPI();
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    manager.executeAll();

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      substream: 'camera.office_hd',
    });

    expect(manager.hasViewRelatedActions()).toBeTruthy();
    expect(api.getActionsManager().executeAction).not.toBeCalled();
    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });

  describe('should ignore action without value', () => {
    it.each([['camera_select' as const], ['live_substream_select' as const]])(
      '%s',
      (action: string) => {
        setQueryString(`?frigate-card-action.id.${action}=`);
        const api = createCardAPI();
        vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
        const manager = new QueryStringManager(api);

        manager.executeAll();

        expect(manager.hasViewRelatedActions()).toBeFalsy();
        expect(api.getActionsManager().executeAction).not.toBeCalled();
        expect(api.getViewManager().setViewDefault).not.toBeCalled();
        expect(api.getViewManager().setViewByParameters).not.toBeCalled();
      },
    );
  });

  it('should handle unknown action', () => {
    const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    setQueryString('?frigate-card-action.id.not_an_action=value');
    const api = createCardAPI();
    vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
    const manager = new QueryStringManager(api);

    manager.executeAll();

    expect(manager.hasViewRelatedActions()).toBeFalsy();
    expect(api.getActionsManager().executeAction).not.toBeCalled();
    expect(api.getViewManager().setViewDefault).not.toBeCalled();
    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(consoleSpy).toBeCalled();
  });

  describe('should execute view name action from query string', () => {
    it.each([
      ['clip' as const],
      ['clips' as const],
      ['diagnostics' as const],
      ['image' as const],
      ['live' as const],
      ['recording' as const],
      ['recordings' as const],
      ['snapshot' as const],
      ['snapshots' as const],
      ['timeline' as const],
    ])('%s', (viewName: string) => {
      setQueryString(`?frigate-card-action.id.${viewName}=`);
      const api = createCardAPI();
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      manager.executeAll();

      expect(manager.hasViewRelatedActions()).toBeTruthy();
      expect(api.getViewManager().setViewByParameters).toBeCalledWith({
        viewName: viewName,
      });
    });
  });

  describe('should not execute non-view actions without an initial update', () => {
    it.each([
      ['camera_ui' as const],
      ['download' as const],
      ['expand' as const],
      ['menu_toggle' as const],
    ])('%s', (action: string) => {
      setQueryString(`?frigate-card-action.id.${action}=value`);
      const api = createCardAPI();
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(false);
      const manager = new QueryStringManager(api);

      manager.executeAll();

      expect(api.getActionsManager().executeAction).not.toBeCalled();
      expect(api.getViewManager().setViewDefault).not.toBeCalled();
      expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    });
  });

  describe('should handle conflicting but valid actions', () => {
    it('view and default with camera and substream specified', () => {
      setQueryString(
        '?frigate-card-action.id.clips=' +
          '&frigate-card-action.id.live_substream_select=camera.kitchen_hd' +
          '&frigate-card-action.id.default=' +
          '&frigate-card-action.id.camera_select=camera.kitchen',
      );
      const api = createCardAPI();
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      manager.executeAll();

      expect(api.getViewManager().setViewDefault).toBeCalledWith({
        cameraID: 'camera.kitchen',
        substream: 'camera.kitchen_hd',
      });
      expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    });

    it('multiple cameras specified', () => {
      setQueryString(
        '?frigate-card-action.id.camera_select=camera.kitchen' +
          '&frigate-card-action.id.camera_select=camera.office',
      );
      const api = createCardAPI();
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      manager.executeAll();

      expect(api.getViewManager().setViewByParameters).toBeCalledWith({
        cameraID: 'camera.office',
      });
    });
  });

  describe('should not execute view related actions', () => {
    it.each([
      ['clip' as const],
      ['clips' as const],
      ['default' as const],
      ['diagnostics' as const],
      ['image' as const],
      ['live' as const],
      ['recording' as const],
      ['recordings' as const],
      ['snapshot' as const],
      ['snapshots' as const],
      ['timeline' as const],
    ])('%s', (viewName: string) => {
      setQueryString(`?frigate-card-action.id.${viewName}=`);
      const api = createCardAPI();
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      manager.executeNonViewRelated();

      expect(api.getViewManager().setViewByParameters).not.toBeCalled();
      expect(api.getViewManager().setViewDefault).not.toBeCalled();
    });
  });

  describe('should not execute non-view related actions', () => {
    it.each([
      ['camera_ui' as const],
      ['download' as const],
      ['expand' as const],
      ['menu_toggle' as const],
    ])('%s', (viewName: string) => {
      setQueryString(`?frigate-card-action.id.${viewName}=`);
      const api = createCardAPI();
      vi.mocked(api.getCardElementManager().hasUpdated).mockReturnValue(true);
      const manager = new QueryStringManager(api);

      manager.executeViewRelated();

      expect(api.getActionsManager().executeAction).not.toBeCalled();
    });
  });
});
