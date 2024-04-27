import { describe, expect, it, vi } from 'vitest';
import {
  generateViewContextForZoomChange,
  handleZoomDefaultEvent,
} from '../../../src/components-lib/zoom/zoom-view-context';

describe('generateViewContextForZoomChangeRequest', () => {
  it('with config', () => {
    expect(
      generateViewContextForZoomChange('target', {
        zoom: {
          pan: { x: 1, y: 2 },
          zoom: 3,
        },
      }),
    ).toEqual({
      zoom: {
        target: {
          zoom: {
            pan: { x: 1, y: 2 },
            zoom: 3,
          },
        },
      },
    });
  });

  it('without config', () => {
    expect(generateViewContextForZoomChange('target')).toEqual({
      zoom: {
        target: {
          zoom: null,
        },
      },
    });
  });
});

describe('generateViewContextForZoomDefault', () => {
  it('default', () => {
    expect(generateViewContextForZoomChange('target', { isDefault: true })).toEqual({
      zoom: {
        target: {
          isDefault: true,
          zoom: null,
        },
      },
    });
  });

  it('not default', () => {
    expect(generateViewContextForZoomChange('target', { isDefault: false })).toEqual({
      zoom: {
        target: {
          isDefault: false,
          zoom: null,
        },
      },
    });
  });
});

// @vitest-environment jsdom
it('handleZoomDefaultEvent', () => {
  const element = document.createElement('div');
  const callback = vi.fn();
  element.addEventListener('frigate-card:view:change-context', callback);
  handleZoomDefaultEvent(
    element,
    new CustomEvent('frigate-card:zoom:default', { detail: { isDefault: true } }),
    'target',
  );
  expect(callback).toBeCalledWith(
    expect.objectContaining({
      detail: {
        zoom: {
          target: {
            zoom: null,
            isDefault: true,
          },
        },
      },
    }),
  );
});
