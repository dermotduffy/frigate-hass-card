import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { MicrophoneController } from '../../src/utils/microphone';
import { mock } from 'vitest-mock-extended';

const navigatorMock = {
  mediaDevices: {
    getUserMedia: vi.fn(),
  },
};

// @vitest-environment jsdom
describe('MicrophoneController', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', navigatorMock);
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
    const controller = new MicrophoneController();
    expect(controller).toBeTruthy();
    expect(controller.isMuted()).toBeTruthy();
  });

  it('should be undefined without creation', () => {
    const controller = new MicrophoneController();
    expect(controller.getStream()).toBeUndefined();
  });

  it('should connect', async () => {
    const controller = new MicrophoneController();
    const stream = createMockStream();
    navigatorMock.mediaDevices.getUserMedia.mockReturnValue(stream);
    await controller.connect();
    expect(controller.isConnected()).toBeTruthy();
    expect(controller.getStream()).toBe(stream);
    expect(controller.isMuted()).toBeTruthy();
  });

  it('should be forbidden when permission denied', async () => {
    // Don't actually log messages to the console during the test.
    vi.spyOn(global.console, 'warn').mockReturnValue(undefined);
    const controller = new MicrophoneController();
    navigatorMock.mediaDevices.getUserMedia.mockRejectedValue(new Error());
    await controller.connect();
    expect(controller.isConnected()).toBeFalsy();
    expect(controller.isForbidden()).toBeTruthy();
  });

  it('should mute', async () => {
    const controller = new MicrophoneController();
    navigatorMock.mediaDevices.getUserMedia.mockReturnValue(createMockStream());
    await controller.connect();
    controller.mute();
    expect(controller.isMuted()).toBeTruthy();

    controller.unmute();
    expect(controller.isMuted()).toBeFalsy();
  });

  it('should be unmuted on creation if unmute called first', async () => {
    const controller = new MicrophoneController();
    controller.unmute();
    navigatorMock.mediaDevices.getUserMedia.mockReturnValue(createMockStream());
    await controller.connect();
    expect(controller.isMuted()).toBeFalsy();
  });

  it('should disconnect', async () => {
    const controller = new MicrophoneController();
    navigatorMock.mediaDevices.getUserMedia.mockReturnValue(createMockStream());
    await controller.connect();
    expect(controller.isConnected()).toBeTruthy();

    await controller.disconnect();
    expect(controller.isConnected()).toBeFalsy();
  });

  it('should automatically disconnect', async () => {
    const seconds = 10;
    vi.useFakeTimers();

    const controller = new MicrophoneController(seconds);
    navigatorMock.mediaDevices.getUserMedia.mockReturnValue(createMockStream());

    await controller.connect();
    expect(controller.isConnected()).toBeTruthy();

    vi.advanceTimersByTime(seconds * 1000);

    expect(controller.isConnected()).toBeFalsy();
    vi.useRealTimers();
  });
});
