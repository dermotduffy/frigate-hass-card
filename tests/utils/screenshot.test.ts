import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { generateScreenshotTitle, screenshotMedia } from '../../src/utils/screenshot';
import { MediaQueriesResults } from '../../src/view/media-queries-results';
import { View } from '../../src/view/view';
import { TestViewMedia, createView } from '../test-utils';

// @vitest-environment jsdom
describe('screenshotMedia', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not screenshot without context', () => {
    const video = document.createElement('video');

    const canvas = document.createElement('canvas');
    const getContext = vi.fn().mockReturnValue(null);
    canvas.getContext = getContext;
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);

    expect(screenshotMedia(video)).toBeNull();
  });

  it('should screenshot', () => {
    const video = document.createElement('video');

    const canvas = document.createElement('canvas');
    const getContext = vi.fn().mockReturnValue(mock<CanvasRenderingContext2D>());
    canvas.getContext = getContext;
    canvas.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64');
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);

    expect(screenshotMedia(video)).toBe('data:image/jpeg;base64');
  });
});

describe('generateScreenshotTitle', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-06-13T21:54:01'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should get title without view', () => {
    expect(generateScreenshotTitle()).toBe('screenshot.jpg');
  });

  it('should get title for live view', () => {
    expect(generateScreenshotTitle(new View({ view: 'live', camera: 'camera-1' }))).toBe(
      'live-camera-1-2023-06-13-21-54-01.jpg',
    );
  });

  it('should get title for image view', () => {
    expect(
      generateScreenshotTitle(new View({ view: 'image', camera: 'camera-1' })),
    ).toBe('image-camera-1-2023-06-13-21-54-01.jpg');
  });

  it('should get title for media viewer view with id', () => {
    const media = new TestViewMedia(
      'id1',
      new Date('2023-06-16T18:52'),
      'clip',
      'camera-1',
    );
    const view = createView({
      view: 'media',
      camera: 'camera-1',
      queryResults: new MediaQueriesResults([media], 0),
    });

    expect(generateScreenshotTitle(view)).toBe('media-camera-1-id1.jpg');
  });

  it('should get title for media viewer view without id', () => {
    const media = new TestViewMedia(
      null,
      new Date('2023-06-16T18:52'),
      'clip',
      'camera-1',
    );
    const view = createView({
      view: 'media',
      camera: 'camera-1',
      queryResults: new MediaQueriesResults([media], 0),
    });

    expect(generateScreenshotTitle(view)).toBe('media-camera-1.jpg');
  });
});
