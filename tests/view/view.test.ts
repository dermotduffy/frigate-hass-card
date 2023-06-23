import { describe, expect, it, test, vi } from 'vitest';
import { QueryType } from '../../src/camera-manager/types';
import { ViewMedia } from '../../src/view/media';
import { EventMediaQueries, RecordingMediaQueries } from '../../src/view/media-queries';
import { MediaQueriesResults } from '../../src/view/media-queries-results';
import { View, dispatchViewContextChangeEvent } from '../../src/view/view';
import { createView } from '../test-utils';

// @vitest-environment jsdom
describe('View Basics', () => {
  it('should construct from parameters', () => {
    const query = new EventMediaQueries();
    const queryResults = new MediaQueriesResults();
    const context = {};

    const view = createView({
      view: 'live',
      camera: 'camera',
      query: query,
      queryResults: queryResults,
      context: context,
    });
    expect(view.is('live')).toBeTruthy();
    expect(view.view).toBe('live');
    expect(view.camera).toBe('camera');
    expect(view.query).toBe(query);
    expect(view.queryResults).toBe(queryResults);
    expect(view.context).toBe(context);
  });

  it('should clone', () => {
    const query = new EventMediaQueries();
    const queryResults = new MediaQueriesResults();
    const context = {};

    const view = createView({
      view: 'live',
      camera: 'camera',
      query: query,
      queryResults: queryResults,
      context: context,
    });

    const clone = view.clone();
    expect(clone).toEqual(view);
  });

  it('should evolve with everything set', () => {
    const view = createView({
      view: 'live',
      camera: 'camera-1',
      query: new EventMediaQueries(),
      queryResults: new MediaQueriesResults(),
      context: {},
    });

    const evolved = view.evolve({
      view: 'clips',
      camera: 'camera-2',
      query: new EventMediaQueries(),
      queryResults: new MediaQueriesResults(),
      context: {},
    });
    expect(evolved.view).not.toBe(view.view);
    expect(evolved.camera).not.toBe(view.camera);
    expect(evolved.query).not.toBe(view.query);
    expect(evolved.queryResults).not.toBe(view.queryResults);
    expect(evolved.context).not.toBe(view.context);
  });

  it('should evolve with nothing set', () => {
    const view = createView({
      view: 'live',
      camera: 'camera-1',
      query: new EventMediaQueries(),
      queryResults: new MediaQueriesResults(),
      context: {},
    });

    const evolved = view.evolve({});

    expect(evolved.view).toBe(view.view);
    expect(evolved.camera).toBe(view.camera);
    expect(evolved.context).toBe(view.context);

    // Query and QueryResults are cloned if not set.
    expect(evolved.query).not.toBe(view.query);
    expect(evolved.query).toEqual(view.query);
    expect(evolved.queryResults).not.toBe(view.queryResults);
    expect(evolved.queryResults).toEqual(view.queryResults);
  });

  it('should not clone query and queryResults with nothing set', () => {
    const view = createView();
    const evolved = view.evolve({});

    // Query and QueryResults are cloned if not set.
    expect(evolved.query).toBeNull();
    expect(evolved.queryResults).toBeNull();
  });

  it('should merge in context', () => {
    const view = createView();
    const liveContext = { overrides: new Map() };
    const timelineContext = { window: { start: new Date(), end: new Date() } };

    view.mergeInContext({ live: liveContext });
    expect(view.context?.live).toEqual(liveContext);

    view.mergeInContext({ timeline: timelineContext });
    expect(view.context?.live).toEqual(liveContext);
    expect(view.context?.timeline).toEqual(timelineContext);
  });

  it('should remove context', () => {
    const view = createView({ context: { live: { overrides: new Map() } } });

    view.removeContext('live');
    expect(view.context).toEqual({});
  });

  it('should detect gallery views', () => {
    expect(createView({ view: 'clips' }).isGalleryView()).toBeTruthy();
    expect(createView({ view: 'snapshots' }).isGalleryView()).toBeTruthy();
    expect(createView({ view: 'recordings' }).isGalleryView()).toBeTruthy();
  });

  it('should not detect gallery view', () => {
    expect(createView({ view: 'live' }).isGalleryView()).toBeFalsy();
    expect(createView({ view: 'timeline' }).isGalleryView()).toBeFalsy();
  });

  it('should detect any media views', () => {
    expect(createView({ view: 'clip' }).isAnyMediaView()).toBeTruthy();
    expect(createView({ view: 'snapshot' }).isAnyMediaView()).toBeTruthy();
    expect(createView({ view: 'media' }).isAnyMediaView()).toBeTruthy();
    expect(createView({ view: 'recording' }).isAnyMediaView()).toBeTruthy();
    expect(createView({ view: 'live' }).isAnyMediaView()).toBeTruthy();
    expect(createView({ view: 'image' }).isAnyMediaView()).toBeTruthy();
  });

  it('should not detect any media view', () => {
    expect(createView({ view: 'timeline' }).isAnyMediaView()).toBeFalsy();
  });

  it('should detect viewer views', () => {
    expect(createView({ view: 'clip' }).isViewerView()).toBeTruthy();
    expect(createView({ view: 'snapshot' }).isViewerView()).toBeTruthy();
    expect(createView({ view: 'media' }).isViewerView()).toBeTruthy();
    expect(createView({ view: 'recording' }).isViewerView()).toBeTruthy();
  });

  it('should not detect viewer views', () => {
    expect(createView({ view: 'live' }).isViewerView()).toBeFalsy();
    expect(createView({ view: 'live' }).isViewerView()).toBeFalsy();
    expect(createView({ view: 'timeline' }).isViewerView()).toBeFalsy();
  });

  it('should get default media type', () => {
    expect(createView({ view: 'clip' }).getDefaultMediaType()).toBe('clips');
    expect(createView({ view: 'clips' }).getDefaultMediaType()).toBe('clips');
    expect(createView({ view: 'snapshot' }).getDefaultMediaType()).toBe('snapshots');
    expect(createView({ view: 'snapshots' }).getDefaultMediaType()).toBe('snapshots');
    expect(createView({ view: 'recording' }).getDefaultMediaType()).toBe('recordings');
    expect(createView({ view: 'recordings' }).getDefaultMediaType()).toBe('recordings');
  });

  it('should not get default media type', () => {
    expect(createView({ view: 'live' }).getDefaultMediaType()).toBeNull();
    expect(createView({ view: 'timeline' }).getDefaultMediaType()).toBeNull();
  });

  it('should dispatch view', () => {
    const element = document.createElement('div');
    const view = createView();
    const handler = vi.fn((ev) => {
      expect(ev.detail).toBe(view);
    });

    element.addEventListener('frigate-card:view:change', handler);
    view.dispatchChangeEvent(element);
    expect(handler).toBeCalled();
  });
});

describe('View.isMajorMediaChange', () => {
  it('should consider undefined views as major', () => {
    expect(View.isMajorMediaChange(createView(), undefined)).toBeTruthy();
    expect(View.isMajorMediaChange(undefined, createView())).toBeTruthy();
    expect(View.isMajorMediaChange()).toBeTruthy();
  });

  it('should consider view change as major', () => {
    expect(
      View.isMajorMediaChange(
        createView({ view: 'live' }),
        createView({ view: 'snapshots' }),
      ),
    ).toBeTruthy();
  });

  it('should consider camera change as major', () => {
    expect(
      View.isMajorMediaChange(
        createView({ camera: 'camera-1' }),
        createView({ camera: 'camera-2' }),
      ),
    ).toBeTruthy();
  });

  it('should consider live substream change as major in live view', () => {
    const overrides_1: Map<string, string> = new Map();
    overrides_1.set('camera', 'camera-2');

    const overrides_2: Map<string, string> = new Map();
    overrides_2.set('camera', 'camera-3');

    expect(
      View.isMajorMediaChange(
        createView({ context: { live: { overrides: overrides_1 } } }),
        createView({ context: { live: { overrides: overrides_2 } } }),
      ),
    ).toBeTruthy();
  });

  it('should not consider live substream change as major in other view', () => {
    const overrides_1: Map<string, string> = new Map();
    overrides_1.set('camera', 'camera-2');

    const overrides_2: Map<string, string> = new Map();
    overrides_2.set('camera', 'camera-3');

    expect(
      View.isMajorMediaChange(
        createView({ view: 'clips', context: { live: { overrides: overrides_1 } } }),
        createView({ view: 'clips', context: { live: { overrides: overrides_2 } } }),
      ),
    ).toBeFalsy();
  });

  it('should consider result change as major in other view', () => {
    const media = [new ViewMedia('clip', 'camera-1'), new ViewMedia('clip', 'camera-2')];
    const queryResults_1 = new MediaQueriesResults(media, 0);
    const queryResults_2 = new MediaQueriesResults(media, 1);
    expect(
      View.isMajorMediaChange(
        createView({ view: 'media', queryResults: queryResults_1 }),
        createView({ view: 'media', queryResults: queryResults_2 }),
      ),
    ).toBeTruthy();
  });

  it('should not consider selected result change as major in live view', () => {
    const media = [new ViewMedia('clip', 'camera-1'), new ViewMedia('clip', 'camera-2')];
    const queryResults_1 = new MediaQueriesResults(media, 0);
    const queryResults_2 = new MediaQueriesResults(media, 1);
    expect(
      View.isMajorMediaChange(
        createView({ queryResults: queryResults_1 }),
        createView({ queryResults: queryResults_2 }),
      ),
    ).toBeFalsy();
  });
});

describe('View.adoptFromViewIfAppropriate', () => {
  it('should adopt for gallery case', () => {
    const query = new EventMediaQueries([
      { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
    ]);
    const queryResults = new MediaQueriesResults();

    const current = createView({
      view: 'clip',
      query: query,
      queryResults: queryResults,
    });
    const next = createView({ view: 'clips' });
    View.adoptFromViewIfAppropriate(next, current);
    expect(next.view).toBe('clips');
    expect(next.query).toBe(query);
    expect(next.queryResults).toBe(queryResults);
  });

  test.each([
    [
      new EventMediaQueries([
        { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
      ]),
      'clip',
    ],
    [
      new EventMediaQueries([
        { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
      ]),
      'snapshot',
    ],
    [
      new RecordingMediaQueries([
        { type: QueryType.Recording, cameraIDs: new Set(['camera']) },
      ]),
      'recording',
    ],
  ])('should adopt for media case', (mediaQueries, expectedView) => {
    const current = createView({
      view: 'media',
      query: mediaQueries,
      queryResults: new MediaQueriesResults(),
    });
    const next = createView({ view: 'media' });
    View.adoptFromViewIfAppropriate(next, current);
    expect(next.view).toBe(expectedView);
    expect(next.query).toBeFalsy();
    expect(next.queryResults).toBeFalsy();
  });

  it('should not adopt for other case', () => {
    const query = new EventMediaQueries([
      { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
    ]);
    const queryResults = new MediaQueriesResults();

    const current = createView({
      view: 'media',
      query: query,
      queryResults: queryResults,
    });
    const next = createView({ view: 'live' });
    View.adoptFromViewIfAppropriate(next, current);
    expect(next.view).toBe('live');
    expect(next.query).toBeFalsy();
    expect(next.queryResults).toBeFalsy();
  });

  it('should do nothing with undefined next view', () => {
    const view_1 = createView();
    const view_2 = view_1.clone();
    View.adoptFromViewIfAppropriate(view_1);
    expect(view_1).toEqual(view_2);
  });

  it('should adopt with query but no queryResults', () => {
    const query = new EventMediaQueries([
      { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
    ]);

    const current = createView({
      view: 'media',
      query: query,
    });
    const next = createView({
      view: 'media',
      query: query,
    });
    View.adoptFromViewIfAppropriate(next, current);
    expect(next.view).toBe('clip');
  });

  it('should adopt live context overrides for substreams', () => {
    const current = createView({
      view: 'live',
      context: {
        live: {
          overrides: new Map([['camera', 'camera2']]),
        },
      },
    });
    const next = createView({
      view: 'live',
    });
    View.adoptFromViewIfAppropriate(next, current);
    expect(next.context?.live).toEqual(current.context?.live);
  });

  it('should not adopt live context overrides if there are new overrides', () => {
    const current = createView({
      view: 'live',
      context: {
        live: {
          overrides: new Map([['camera', 'camera2']]),
        },
      },
    });
    const next = createView({
      view: 'live',
      context: {
        live: {
          overrides: new Map([['camera', 'camera3']]),
        },
      },
    });
    View.adoptFromViewIfAppropriate(next, current);
    expect(next.context?.live?.overrides).toEqual(new Map([['camera', 'camera3']]));
  });

  it('should adopt live context overrides even if there is new context', () => {
    const current = createView({
      view: 'live',
      context: {
        live: {
          overrides: new Map([['camera', 'camera2']]),
        },
      },
    });
    const next = createView({
      view: 'live',
      context: {},
    });
    View.adoptFromViewIfAppropriate(next, current);
    expect(next.context?.live).toEqual(current.context?.live);
  });
});

// @vitest-environment jsdom
describe('dispatchViewContextChangeEvent', () => {
  it('should dispatch event', () => {
    const context = {};
    const handler = vi.fn((ev) => {
      expect(ev.detail).toBe(context);
    });

    const element = document.createElement('div');
    element.addEventListener('frigate-card:view:change-context', handler);

    dispatchViewContextChangeEvent(element, context);
    expect(handler).toBeCalled();
  });
});
