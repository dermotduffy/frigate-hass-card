import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StyleManager } from '../../src/card-controller/style-manager';
import { FrigateCardView } from '../../src/config/types';
import irisLogo from '../../src/images/camera-iris.svg';
import { createCardAPI, createConfig, createHASS, createView } from '../test-utils';

// @vitest-environment jsdom
describe('StyleManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('initialize should set common properties', () => {
    it('should set media background', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const manager = new StyleManager(api);

      manager.initialize();

      expect(
        element.style.getPropertyValue('--frigate-card-media-background-image'),
      ).toEqual(`url("${irisLogo}")`);
    });
  });

  describe('setLightOrDarkMode', () => {
    it('dark mode unspecified', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const manager = new StyleManager(api);

      manager.setLightOrDarkMode();

      expect(element.getAttribute('dark')).toBeNull();
    });

    it('dark mode explicitly off', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            dark_mode: 'off',
          },
        }),
      );
      const manager = new StyleManager(api);

      manager.setLightOrDarkMode();

      expect(element.getAttribute('dark')).toBeNull();
    });

    it('dark mode explicitly set', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            dark_mode: 'on',
          },
        }),
      );
      const manager = new StyleManager(api);

      manager.setLightOrDarkMode();

      expect(element.getAttribute('dark')).not.toBeNull();
    });

    it('dark mode auto without interaction', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            dark_mode: 'auto',
          },
        }),
      );
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);
      const manager = new StyleManager(api);

      manager.setLightOrDarkMode();

      expect(element.getAttribute('dark')).not.toBeNull();
    });

    it('dark mode auto with HA dark mode', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            dark_mode: 'auto',
          },
        }),
      );
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(true);
      const hass = createHASS();
      hass.themes.darkMode = true;
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
      const manager = new StyleManager(api);

      manager.setLightOrDarkMode();

      expect(element.getAttribute('dark')).not.toBeNull();
    });
  });

  describe('setExpandedMode', () => {
    it('with no view or known media', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getMediaLoadedInfoManager().getLastKnown).mockReturnValue(null);
      const manager = new StyleManager(api);

      manager.setExpandedMode();

      expect(element.style.getPropertyValue('--frigate-card-expand-aspect-ratio')).toBe(
        'unset',
      );
      expect(element.style.getPropertyValue('--frigate-card-expand-width')).toBe(
        'var(--frigate-card-expand-max-width)',
      );
      expect(element.style.getPropertyValue('--frigate-card-expand-height')).toBe(
        'var(--frigate-card-expand-max-height)',
      );
    });

    it('with view but without media', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const view = createView({ view: 'media', displayMode: 'single' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getMediaLoadedInfoManager().getLastKnown).mockReturnValue(null);
      const manager = new StyleManager(api);

      manager.setExpandedMode();

      expect(element.style.getPropertyValue('--frigate-card-expand-aspect-ratio')).toBe(
        'unset',
      );
      expect(element.style.getPropertyValue('--frigate-card-expand-width')).toBe('none');
      expect(element.style.getPropertyValue('--frigate-card-expand-height')).toBe(
        'none',
      );
    });

    it('with view and media', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const view = createView({ view: 'media', displayMode: 'single' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getMediaLoadedInfoManager().getLastKnown).mockReturnValue({
        width: 800,
        height: 600,
      });
      const manager = new StyleManager(api);

      manager.setExpandedMode();

      expect(element.style.getPropertyValue('--frigate-card-expand-aspect-ratio')).toBe(
        '800 / 600',
      );
      expect(element.style.getPropertyValue('--frigate-card-expand-width')).toBe('none');
      expect(element.style.getPropertyValue('--frigate-card-expand-height')).toBe(
        'none',
      );
    });

    it('with view and grid display mode', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const view = createView({ view: 'media', displayMode: 'grid' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getMediaLoadedInfoManager().getLastKnown).mockReturnValue({
        width: 800,
        height: 600,
      });
      const manager = new StyleManager(api);

      manager.setExpandedMode();

      expect(element.style.getPropertyValue('--frigate-card-expand-aspect-ratio')).toBe(
        '800 / 600',
      );
      expect(element.style.getPropertyValue('--frigate-card-expand-width')).toBe(
        'var(--frigate-card-expand-max-width)',
      );
      expect(element.style.getPropertyValue('--frigate-card-expand-height')).toBe(
        'var(--frigate-card-expand-max-height)',
      );
    });
  });

  describe('setMinMaxHeight', () => {
    it('without a config', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      const manager = new StyleManager(api);

      manager.setMinMaxHeight();

      expect(element.style.getPropertyValue('--frigate-card-max-height')).toBeFalsy();
      expect(element.style.getPropertyValue('--frigate-card-expand-height')).toBeFalsy();
    });

    it('with a config', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          dimensions: {
            height: '800px',
          },
        }),
      );
      const manager = new StyleManager(api);

      manager.setMinMaxHeight();

      expect(element.style.getPropertyValue('--frigate-card-height')).toBe('800px');
    });
  });

  describe('setPerformance', () => {
    it('no styles set', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getCardWideConfig).mockReturnValue({});
      const manager = new StyleManager(api);

      manager.setPerformance();

      expect(
        element.style.getPropertyValue('--frigate-card-css-box-shadow'),
      ).toBeFalsy();
      expect(
        element.style.getPropertyValue('--frigate-card-css-border-radius'),
      ).toBeFalsy();
    });

    it('valid styles set', () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getConfigManager().getCardWideConfig).mockReturnValue(
        createConfig({
          performance: {
            style: {
              box_shadow: false,
              border_radius: true,
            },
          },
        }),
      );
      const manager = new StyleManager(api);

      manager.setPerformance();

      expect(element.style.getPropertyValue('--frigate-card-css-box-shadow')).toEqual(
        'none',
      );
      expect(
        element.style.getPropertyValue('--frigate-card-css-border-radius'),
      ).toBeFalsy();
    });
  });

  describe('getAspectRatioStyle', () => {
    it('without config or view', () => {
      const api = createCardAPI();
      const manager = new StyleManager(api);
      expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': '16 / 9' });
    });

    it('should be auto with unconstrained aspect ratio', () => {
      const api = createCardAPI();
      const view = createView({ view: 'media' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          dimensions: {
            aspect_ratio_mode: 'unconstrained',
          },
        }),
      );
      const manager = new StyleManager(api);
      expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': 'auto' });
    });

    it('should be auto in fullscreen', () => {
      const api = createCardAPI();
      const view = createView({ view: 'media' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getFullscreenManager().isInFullscreen).mockReturnValue(true);
      const manager = new StyleManager(api);

      expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': 'auto' });
    });

    it('should be auto when expanded', () => {
      const api = createCardAPI();
      const view = createView({ view: 'media' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getExpandManager().isExpanded).mockReturnValue(true);
      const manager = new StyleManager(api);

      expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': 'auto' });
    });

    it('should be auto when there is yet to be a view', () => {
      const api = createCardAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(null);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      const manager = new StyleManager(api);

      expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': 'auto' });
    });

    describe('should be auto when dynamic in certain views', () => {
      it.each([
        ['clip' as const],
        ['diagnostics' as const],
        ['image' as const],
        ['media' as const],
        ['live' as const],
        ['recording' as const],
        ['snapshot' as const],
        ['timeline' as const],
      ])('%s', (viewName: FrigateCardView) => {
        const api = createCardAPI();
        const view = createView({ view: viewName });
        vi.mocked(api.getViewManager().getView).mockReturnValue(view);
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
          createConfig({
            dimensions: {
              aspect_ratio_mode: 'dynamic',
            },
          }),
        );
        const manager = new StyleManager(api);

        expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': 'auto' });
      });
    });

    describe('should be enforced when dynamic in certain views', () => {
      it.each([['clips' as const], ['recordings' as const], ['snapshots' as const]])(
        '%s',
        (viewName: FrigateCardView) => {
          const api = createCardAPI();
          const view = createView({ view: viewName });
          vi.mocked(api.getViewManager().getView).mockReturnValue(view);
          vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
            createConfig({
              dimensions: {
                aspect_ratio_mode: 'dynamic',
              },
            }),
          );
          const manager = new StyleManager(api);

          expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': '16 / 9' });
        },
      );
    });

    describe('should use media dimensions in dynamic', () => {
      it.each([['clips' as const], ['recordings' as const], ['snapshots' as const]])(
        '%s',
        (viewName: FrigateCardView) => {
          const api = createCardAPI();
          const view = createView({ view: viewName });
          vi.mocked(api.getViewManager().getView).mockReturnValue(view);
          vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
            createConfig({
              dimensions: {
                aspect_ratio_mode: 'dynamic',
              },
            }),
          );
          vi.mocked(api.getMediaLoadedInfoManager().getLastKnown).mockReturnValue({
            width: 800,
            height: 600,
          });
          const manager = new StyleManager(api);

          expect(manager.getAspectRatioStyle()).toEqual({
            'aspect-ratio': '800 / 600',
          });
        },
      );
    });

    it('should respect default aspect ratio', () => {
      const api = createCardAPI();
      const view = createView({ view: 'clips' });
      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          dimensions: {
            aspect_ratio_mode: 'dynamic',
            aspect_ratio: '4:3',
          },
        }),
      );
      const manager = new StyleManager(api);

      expect(manager.getAspectRatioStyle()).toEqual({ 'aspect-ratio': '4 / 3' });
    });
  });
});
