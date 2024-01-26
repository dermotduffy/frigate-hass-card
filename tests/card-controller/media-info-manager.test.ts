import { describe, expect, it } from 'vitest';
import { MediaLoadedInfoManager } from '../../src/card-controller/media-info-manager';
import { createCardAPI, createMediaLoadedInfo } from '../test-utils.js';

describe('MediaLoadedInfoManager', () => {
  it('should initialize', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);

    manager.initialize();
    expect(api.getConditionsManager().setState).toBeCalledWith({ media_loaded: false });
  });

  it('should set', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);
    const mediaInfo = createMediaLoadedInfo();

    manager.set(mediaInfo);

    expect(manager.has()).toBeTruthy();
    expect(manager.get()).toBe(mediaInfo);
    expect(api.getConditionsManager().setState).toBeCalledWith(
      expect.objectContaining({ media_loaded: true }),
    );
    expect(api.getStyleManager().setExpandedMode).toBeCalled();
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should not set invalid media info', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);
    const mediaInfo = createMediaLoadedInfo({ width: 0, height: 0 });

    manager.set(mediaInfo);

    expect(manager.has()).toBeFalsy();
    expect(manager.get()).toBeNull();
    expect(api.getConditionsManager().setState).not.toBeCalled();
  });

  it('should get last known', () => {
    const api = createCardAPI();
    const manager = new MediaLoadedInfoManager(api);
    const mediaInfo = createMediaLoadedInfo();

    manager.set(mediaInfo);

    expect(manager.has()).toBeTruthy();

    manager.clear();

    expect(manager.has()).toBeFalsy();
    expect(manager.getLastKnown()).toBe(mediaInfo);
    expect(api.getConditionsManager().setState).toBeCalledWith(
      expect.objectContaining({ media_loaded: false }),
    );
  });
});
