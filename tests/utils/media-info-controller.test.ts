import { beforeEach, describe, expect, it } from 'vitest';
import { MediaLoadedInfoController } from '../../src/utils/media-info-controller';
import { createMediaLoadedInfo } from '../test-utils.js';

describe('MediaLoadedInfoController', () => {
  let controller: MediaLoadedInfoController;
  beforeEach(() => {
    controller = new MediaLoadedInfoController();
  });

  it('should set', () => {
    const info = createMediaLoadedInfo();
    controller.set(info);
    expect(controller.has());
    expect(controller.get()).toBe(info);
  });

  it('should get last known', () => {
    const info = createMediaLoadedInfo();
    controller.set(info);
    expect(controller.has()).toBeTruthy();
    controller.clear();
    expect(controller.has()).toBeFalsy();
    expect(controller.getLastKnown()).toBe(info);
  });
});
