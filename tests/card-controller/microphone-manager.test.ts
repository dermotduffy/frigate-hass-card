import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MicrophoneManager } from '../../src/card-controller/microphone-manager';
import { createCardAPI, createConfig } from '../test-utils';

const navigatorMock = {
  mediaDevices: {
    getUserMedia: vi.fn(),
  },
};

// @vitest-environment jsdom
describe('MicrophoneManager', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', navigatorMock);
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals;
  });

  const createMockStream = (mute?: boolean): MediaStream => {
    const stream = mock<MediaStream>();
    const track = mock<MediaStreamTrack>();
    track.enabled = !mute;
    stream.getTracks.mockImplementation(() => [track]);
    return stream;
  };

  it('should be muted on creation', () => {
    const manager = new MicrophoneManager(createCardAPI());
    expect(manager).toBeTruthy();
    expect(manager.isMuted()).toBeTruthy();
  });

  it('should be undefined without creation', () => {
    const manager = new MicrophoneManager(createCardAPI());
    expect(manager.getStream()).toBeUndefined();
  });

  it('should connect', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);

    const stream = createMockStream();
    navigatorMock.mediaDevices.getUserMedia.mockReturnValue(stream);

    await manager.connect();

    expect(manager.isConnected()).toBeTruthy();
    expect(manager.getStream()).toBe(stream);
    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should be forbidden when permission denied', async () => {
    // Don't actually log messages to the console during the test.
    vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    navigatorMock.mediaDevices.getUserMedia.mockRejectedValue(new Error());

    await manager.connect();

    expect(manager.isConnected()).toBeFalsy();
    expect(manager.isForbidden()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should mute and unmute', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    navigatorMock.mediaDevices.getUserMedia.mockReturnValue(createMockStream());

    await manager.connect();
    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);

    manager.mute();
    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(2);

    await manager.unmute();
    expect(manager.isMuted()).toBeFalsy();
    expect(api.getCardElementManager().update).toBeCalledTimes(3);
  });

  it('should not unmute when microphone forbidden', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    navigatorMock.mediaDevices.getUserMedia.mockReturnValue(null);

    await manager.connect();

    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);

    await manager.unmute();
    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);
  });

  it('should connect on unmute', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    navigatorMock.mediaDevices.getUserMedia.mockReturnValue(createMockStream());

    expect(manager.isConnected()).toBeFalsy();

    await manager.unmute();

    expect(manager.isConnected()).toBeTruthy();
    expect(manager.isMuted()).toBeFalsy();

    expect(api.getCardElementManager().update).toBeCalledTimes(2);
  });

  it('should disconnect', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);

    navigatorMock.mediaDevices.getUserMedia.mockReturnValue(createMockStream());

    await manager.connect();
    expect(manager.isConnected()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);

    await manager.disconnect();
    expect(manager.isConnected()).toBeFalsy();
    expect(api.getCardElementManager().update).toBeCalledTimes(2);
  });

  it('should automatically disconnect', async () => {
    vi.useFakeTimers();

    const disconnectSeconds = 10;
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    navigatorMock.mediaDevices.getUserMedia.mockReturnValue(createMockStream());

    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        live: {
          microphone: {
            always_connected: false,
            disconnect_seconds: disconnectSeconds,
          },
        },
      }),
    );

    await manager.connect();
    expect(manager.isConnected()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);

    vi.advanceTimersByTime(disconnectSeconds * 1000);

    expect(manager.isConnected()).toBeFalsy();
    expect(api.getCardElementManager().update).toBeCalledTimes(2);
  });

  it('should not automatically disconnect when always connected', async () => {
    vi.useFakeTimers();

    const disconnectSeconds = 10;
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    navigatorMock.mediaDevices.getUserMedia.mockReturnValue(createMockStream());

    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        live: {
          microphone: {
            always_connected: true,
            disconnect_seconds: disconnectSeconds,
          },
        },
      }),
    );

    await manager.connect();
    expect(manager.isConnected()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);

    vi.advanceTimersByTime(disconnectSeconds * 1000);

    expect(manager.isConnected()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);
  });
});
