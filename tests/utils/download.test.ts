import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { downloadMedia, downloadURL } from '../../src/utils/download';
import { homeAssistantSignPath } from '../../src/utils/ha';
import { ViewMedia } from '../../src/view/media';
import { createCameraManager, createHASS } from '../test-utils';

vi.mock('../../src/utils/ha');

const media = new ViewMedia('clip', 'camera-1');

// @vitest-environment jsdom
describe('downloadURL', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    global.window.location = mock<Location>();
  });

  it('should download same origin via link', () => {
    const location: Location & { origin: string } = mock<Location>();
    location.origin = 'http://foo';
    global.window.location = location;

    const link = document.createElement('a');
    link.click = vi.fn();
    link.setAttribute = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue(link);

    downloadURL('http://foo/url.mp4');

    expect(link.href).toBe('http://foo/url.mp4');
    expect(link.setAttribute).toBeCalledWith('download', 'download');
    expect(link.click).toBeCalled();
  });

  it('should download data URL via link', () => {
    const link = document.createElement('a');
    link.click = vi.fn();
    link.setAttribute = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue(link);

    downloadURL('data:text/plain;charset=utf-8;base64,VEhJUyBJUyBEQVRB');

    expect(link.href).toBe('data:text/plain;charset=utf-8;base64,VEhJUyBJUyBEQVRB');
    expect(link.setAttribute).toBeCalledWith('download', 'download');
    expect(link.click).toBeCalled();
  });

  it('should download in apps via window.open', () => {
    // Set the origin to the same.
    const location: Location & { origin: string } = mock<Location>();
    location.origin = 'http://foo';
    global.window.location = location;

    vi.stubGlobal('navigator', {
      userAgent: 'Home Assistant/2023.3.0-3260 (Android 13; Pixel 7 Pro)',
    });

    const windowSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    downloadURL('http://foo/url.mp4');
    expect(windowSpy).toBeCalledWith('http://foo/url.mp4', '_blank');
  });
});

describe('downloadMedia', () => {
  afterEach(() => {
    vi.resetAllMocks();
    global.window.location = mock<Location>();
  });

  it('should throw error when no media', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getMediaDownloadPath).mockResolvedValue(null);

    expect(downloadMedia(createHASS(), cameraManager, media)).rejects.toThrow(
      /No media to download/,
    );
  });

  it('should throw error when signing fails', () => {
    vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    const cameraManager = createCameraManager();
    vi.mocked(cameraManager).getMediaDownloadPath.mockResolvedValue({
      sign: true,
      endpoint: 'foo',
    });
    const signError = new Error('sign-error');
    vi.mocked(homeAssistantSignPath).mockRejectedValue(signError);

    expect(downloadMedia(createHASS(), cameraManager, media)).rejects.toThrow(
      /Could not sign media URL for download/,
    );
  });

  it('should download media', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager).getMediaDownloadPath.mockResolvedValue({
      sign: true,
      endpoint: 'foo',
    });
    vi.mocked(homeAssistantSignPath).mockResolvedValue('http://foo/signed-url');
    const windowSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    await downloadMedia(createHASS(), cameraManager, media);
    expect(windowSpy).toBeCalledWith('http://foo/signed-url', '_blank');
  });

  it('should download media without signing', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager).getMediaDownloadPath.mockResolvedValue({
      sign: false,
      endpoint: 'https://foo/',
    });
    const windowSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    await downloadMedia(createHASS(), cameraManager, media);
    expect(windowSpy).toBeCalledWith('https://foo/', '_blank');
  });
});
