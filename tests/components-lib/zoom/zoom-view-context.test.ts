import { describe, expect, it, vi } from 'vitest';
import {
  generateViewContextForZoom,
  handleZoomSettingsObservedEvent,
} from '../../../src/components-lib/zoom/zoom-view-context';

describe('generateViewContextForZoom', () => {
  it('with observed', () => {
    expect(
      generateViewContextForZoom('target', {
        observed: {
          pan: { x: 1, y: 2 },
          zoom: 3,
          isDefault: true,
          unzoomed: true,
        },
      }),
    ).toEqual({
      zoom: {
        target: {
          observed: {
            pan: { x: 1, y: 2 },
            zoom: 3,
            isDefault: true,
            unzoomed: true,
          },
          requested: null,
        },
      },
    });
  });

  it('with requested', () => {
    expect(
      generateViewContextForZoom('target', {
        requested: {
          pan: { x: 1, y: 2 },
          zoom: 3,
        },
      }),
    ).toEqual({
      zoom: {
        target: {
          requested: {
            pan: { x: 1, y: 2 },
            zoom: 3,
          },
        },
      },
    });
  });
});

// @vitest-environment jsdom
it('handleZoomSettingsObservedEvent', () => {
  const element = document.createElement('div');
  const callback = vi.fn();
  element.addEventListener('frigate-card:view:change-context', callback);
  handleZoomSettingsObservedEvent(
    element,
    new CustomEvent('frigate-card:zoom:change', {
      detail: {
        pan: { x: 1, y: 2 },
        zoom: 3,
        isDefault: true,
        unzoomed: true,
      },
    }),
    'target',
  );
  expect(callback).toBeCalledWith(
    expect.objectContaining({
      detail: {
        zoom: {
          target: {
            observed: { pan: { x: 1, y: 2 }, zoom: 3, isDefault: true, unzoomed: true },
            requested: null,
          },
        },
      },
    }),
  );
});
