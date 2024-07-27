import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MergeContextViewModifier } from '../../../src/card-controller/view/modifiers/merge-context';
import { ViewManager } from '../../../src/card-controller/view/view-manager';
import {
  generateViewContextForZoom,
  handleZoomSettingsObservedEvent,
} from '../../../src/components-lib/zoom/zoom-view-context';

vi.mock('../../../src/card-controller/view/modifiers/merge-context');

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
  const viewManager = mock<ViewManager>();

  handleZoomSettingsObservedEvent(
    new CustomEvent('frigate-card:zoom:change', {
      detail: {
        pan: { x: 1, y: 2 },
        zoom: 3,
        isDefault: true,
        unzoomed: true,
      },
    }),
    viewManager,
    'target',
  );
  expect(viewManager.setViewByParameters).toBeCalledWith(
    expect.objectContaining({
      modifiers: [expect.any(MergeContextViewModifier)],
    }),
  );

  expect(MergeContextViewModifier).toBeCalledWith({
    zoom: {
      target: {
        observed: { pan: { x: 1, y: 2 }, zoom: 3, isDefault: true, unzoomed: true },
        requested: null,
      },
    },
  });
});
