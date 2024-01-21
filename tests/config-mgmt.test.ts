import { describe, expect, it } from 'vitest';
import {
  copyConfig,
  createRangedTransform,
  deleteConfigValue,
  deleteTransform,
  getArrayConfigPath,
  getConfigValue,
  isConfigUpgradeable,
  moveConfigValue,
  setConfigValue,
  upgradeArrayOfObjects,
  upgradeConfig,
  upgradeMoveTo,
  upgradeMoveToWithOverrides,
  upgradeObjectRecursively,
  upgradeWithOverrides,
} from '../src/config-mgmt';
import { RawFrigateCardConfig } from '../src/config/types';

describe('general functions', () => {
  it('should set value', () => {
    const target = {};
    setConfigValue(target, 'a', 10);
    expect(target).toEqual({
      a: 10,
    });
  });

  describe('should get value', () => {
    it('present', () => {
      expect(getConfigValue({ b: 11 }, 'b')).toEqual(11);
    });
    it('absent', () => {
      expect(getConfigValue({ b: 11 }, 'c')).toBeUndefined();
    });
    it('absent with default', () => {
      expect(getConfigValue({ b: 11 }, 'c', 12)).toBe(12);
    });
  });

  describe('should unset value', () => {
    it('nested', () => {
      const target = {
        moo: {
          foo: {
            a: 10,
          },
          bar: {
            b: 11,
          },
        },
      };
      deleteConfigValue(target, 'moo.foo');
      expect(target).toEqual({ moo: { bar: { b: 11 } } });
    });

    it('top-level', () => {
      const target = {
        a: 10,
        b: 11,
      };
      deleteConfigValue(target, 'a');
      expect(target).toEqual({ b: 11 });
    });
  });

  it('should copy config', () => {
    const target = {
      a: {
        b: {
          c: 10,
        },
      },
    };
    const copy = copyConfig(target);

    expect(copy).toEqual(target);
    expect(copy).not.toBe(target);
  });

  it('should get array config path', () => {
    expect(getArrayConfigPath('a.#.b', 10)).toBe('a.[10].b');
  });
});

describe('upgrade functions', () => {
  it('should determine if config is upgradeable', () => {
    expect(
      // Upgrade example: rename of service_data to data.
      isConfigUpgradeable({
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:cow',
            style: {
              right: '20px',
              top: '20px',
              color: 'white',
            },
            tap_action: {
              action: 'call-service',
              service: 'notify.persistent_notification',
              service_data: {
                message: 'Hello 1',
              },
            },
          },
        ],
      }),
    ).toBeTruthy();
  });

  describe('should create ranged transform', () => {
    describe('with numbers', () => {
      it('inside range', () => {
        expect(createRangedTransform((val) => val, 10, 20)(11)).toBe(11);
      });
      it('outside range', () => {
        expect(createRangedTransform((val) => val, 10, 20)(1)).toBe(10);
      });
      it('with a range', () => {
        expect(createRangedTransform((val) => val)(100)).toBe(100);
      });
    });
    it('with non-number', () => {
      expect(createRangedTransform((_val) => 'foo')(1)).toBe('foo');
    });
  });

  it('should return null from delete property transform', () => {
    expect(deleteTransform(10)).toBeNull();
  });

  describe('should move config value', () => {
    it('simple', () => {
      const config = {
        foo: {
          c: 10,
        },
      };
      expect(moveConfigValue(config, 'foo', 'bar')).toBeTruthy();
      expect(config).toEqual({
        bar: {
          c: 10,
        },
      });
    });

    describe('in place', () => {
      it('non-transformed', () => {
        const config = {
          foo: {
            c: 10,
          },
        };
        expect(moveConfigValue(config, 'foo', 'foo')).toBeFalsy();
        expect(config).toEqual({
          foo: {
            c: 10,
          },
        });
      });

      it('transformed', () => {
        const config = {
          foo: {
            c: 10,
          },
        };
        expect(
          moveConfigValue(config, 'foo.c', 'foo.c', { transform: (val) => String(val) }),
        ).toBeTruthy();
        expect(config).toEqual({
          foo: {
            c: '10',
          },
        });
      });
    });

    describe('with transform result', () => {
      it('move', () => {
        const config = {
          c: 10,
        };
        expect(
          moveConfigValue(config, 'c', 'd', { transform: (val) => String(val) }),
        ).toBeTruthy();
        expect(config).toEqual({ d: '10' });
      });

      it('keep original', () => {
        const config = {
          c: 10,
        };
        expect(
          moveConfigValue(config, 'c', 'd', {
            transform: (val) => String(val),
            keepOriginal: true,
          }),
        ).toBeTruthy();
        expect(config).toEqual({ c: 10, d: '10' });
      });
    });

    describe('with transform null result', () => {
      it('remove', () => {
        const config = {
          c: 10,
        };
        expect(
          moveConfigValue(config, 'c', 'd', { transform: (_val) => null }),
        ).toBeTruthy();
        expect(config).toEqual({});
      });

      it('keep', () => {
        const config = {
          c: 10,
        };
        expect(
          moveConfigValue(config, 'c', 'd', {
            transform: (_val) => null,
            keepOriginal: true,
          }),
        ).toBeFalsy();
        expect(config).toEqual({ c: 10 });
      });
    });

    it('with transform undefined result', () => {
      const config = {
        c: 10,
      };
      expect(
        moveConfigValue(config, 'c', 'd', { transform: (_val) => undefined }),
      ).toBeFalsy();
      expect(config).toEqual({ c: 10 });
    });
  });

  it('should upgrade with a move', () => {
    const config = {
      c: 10,
    };

    expect(upgradeMoveTo('c', 'd')(config)).toBeTruthy();
    expect(config).toEqual({ d: 10 });
  });

  it('should upgrade config and overrides with a move', () => {
    const config = {
      c: 10,
      overrides: [
        {
          overrides: {
            c: 10,
          },
        },
      ],
    };

    expect(upgradeMoveToWithOverrides('c', 'd')(config)).toBeTruthy();
    expect(config).toEqual({ d: 10, overrides: [{ overrides: { d: 10 } }] });
  });

  it('should upgrade config and overrides in-place', () => {
    const config = {
      c: 10,
      overrides: [
        {
          overrides: {
            c: 10,
          },
        },
      ],
    };

    expect(upgradeWithOverrides('c', (val) => String(val))(config)).toBeTruthy();
    expect(config).toEqual({ c: '10', overrides: [{ overrides: { c: '10' } }] });
  });

  describe('should upgrade array', () => {
    it('in case of non-array', () => {
      const config = { c: 10 };
      expect(upgradeArrayOfObjects('c', (_val) => false)(config)).toBeFalsy();
    });

    it('in case of non-object items', () => {
      const config = { c: [10, 11] };
      expect(upgradeArrayOfObjects('c', (_val) => false)(config)).toBeFalsy();
    });

    it('in case of array', () => {
      const config = { c: [{ d: 10 }, { d: 11 }] };
      expect(
        upgradeArrayOfObjects('c', (val) => {
          val['e'] = 12;
          return true;
        })(config),
      ).toBeTruthy();
      expect(config).toEqual({
        c: [
          {
            d: 10,
            e: 12,
          },
          {
            d: 11,
            e: 12,
          },
        ],
      });
    });
  });

  describe('should recursively upgrade', () => {
    it('ignoring simple objects', () => {
      const config = { c: 10, d: 10 };
      expect(upgradeObjectRecursively((_val) => false)(config)).toBeFalsy();
      expect(config).toEqual({ c: 10, d: 10 });
    });
    it('iterating into arrays', () => {
      const config = { values: [{ c: 10 }, { d: 10 }, 'random'] };
      expect(
        upgradeObjectRecursively((val) => {
          if (!Array.isArray(val)) {
            val['e'] = 11;
          }
          return true;
        })(config),
      ).toBeTruthy();

      expect(config).toEqual({
        e: 11,
        values: [{ c: 10, e: 11 }, { d: 10, e: 11 }, 'random'],
      });
    });
  });

  it('should have upgrades with bad input data', () => {
    expect(upgradeConfig(3 as unknown as RawFrigateCardConfig)).toBeFalsy();
  });
});

describe('should handle version specific upgrades', () => {
  describe('v4.1.0', () => {
    describe('should rename mediaLoaded to media_loaded', () => {
      it('elements', () => {
        const config = {
          type: 'custom:frigate-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              conditions: {
                mediaLoaded: true,
              },
            },
            {
              conditions: 'not an object',
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:frigate-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              conditions: {
                media_loaded: true,
              },
            },
            {
              conditions: 'not an object',
            },
          ],
        });
      });

      it('overrides', () => {
        const config = {
          type: 'custom:frigate-card',
          cameras: [{ camera_entity: 'camera.office' }],
          overrides: [
            {
              conditions: {
                mediaLoaded: true,
              },
              overrides: {
                view: {
                  default: 'clips',
                },
              },
            },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:frigate-card',
          cameras: [{ camera_entity: 'camera.office' }],
          overrides: [
            {
              conditions: {
                media_loaded: true,
              },
              overrides: {
                view: {
                  default: 'clips',
                },
              },
            },
          ],
        });
      });
    });

    it('should rename event_gallery to media_gallery', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        event_gallery: {
          foo: 'bar',
        },
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        media_gallery: {
          foo: 'bar',
        },
      });
    });

    it('should rename menu.buttons.frigate_ui to menu.buttons.camera_ui', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        menu: {
          buttons: {
            frigate_ui: {
              foo: 'bar',
            },
          },
        },
        overrides: [
          {
            conditions: {},
            overrides: {
              menu: {
                buttons: {
                  frigate_ui: {
                    foo: 'bar',
                  },
                },
              },
            },
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        menu: {
          buttons: {
            camera_ui: {
              foo: 'bar',
            },
          },
        },
        overrides: [
          {
            conditions: {},
            overrides: {
              menu: {
                buttons: {
                  camera_ui: {
                    foo: 'bar',
                  },
                },
              },
            },
          },
        ],
      });
    });

    it('should rename frigate ui actions', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:cow',
            tap_action: {
              action: 'custom:frigate-card-action',
              frigate_card_action: 'frigate_ui',
            },
          },
        ],
        view: {
          actions: {
            double_tap_action: {
              action: 'custom:frigate-card-action',
              frigate_card_action: 'frigate_ui',
            },
          },
        },
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:cow',
            tap_action: {
              action: 'custom:frigate-card-action',
              frigate_card_action: 'camera_ui',
            },
          },
        ],
        view: {
          actions: {
            double_tap_action: {
              action: 'custom:frigate-card-action',
              frigate_card_action: 'camera_ui',
            },
          },
        },
      });
    });

    describe('should rename frigate-jsmpeg provider to jsmpeg', () => {
      it('in cameras', () => {
        const config = {
          type: 'custom:frigate-card',
          cameras: [{ live_provider: 'ha' }, { live_provider: 'frigate-jsmpeg' }],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:frigate-card',
          cameras: [{ live_provider: 'ha' }, { live_provider: 'jsmpeg' }],
        });
      });
    });

    describe('should move live object into cameras_global', () => {
      it.each([['image' as const], ['jsmpeg' as const], ['webrtc_card' as const]])(
        '%s',
        (objName: string) => {
          const config = {
            type: 'custom:frigate-card',
            live: {
              [objName]: {
                foo: 'bar',
              },
            },
          };
          expect(upgradeConfig(config)).toBeTruthy();
          expect(config).toEqual({
            type: 'custom:frigate-card',
            cameras_global: {
              [objName]: {
                foo: 'bar',
              },
            },
            live: {},
          });
        },
      );
    });

    describe('should convert to array and rename', () => {
      it.each([['zone' as const], ['label' as const]])(`%s`, (objName: string) => {
        const config = {
          type: 'custom:frigate-card',
          cameras: [
            { live_provider: 'ha', frigate: { [objName]: 'foo' } },
            { live_provider: 'jsmpeg' },
          ],
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:frigate-card',
          cameras: [
            { live_provider: 'ha', frigate: { [objName + 's']: ['foo'] } },
            { live_provider: 'jsmpeg' },
          ],
        });
      });
    });

    it('should convert and rename frigate.label to frigate.labels', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [
          { live_provider: 'ha', frigate: { zone: 'foo' } },
          { live_provider: 'jsmpeg' },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:frigate-card',
        cameras: [
          { live_provider: 'ha', frigate: { zones: ['foo'] } },
          { live_provider: 'jsmpeg' },
        ],
      });
    });
  });

  describe('v5.2.0', () => {
    describe('should rename service_data to data', () => {
      it('positive case', () => {
        const config = {
          type: 'custom:frigate-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'icon',
              icon: 'mdi:cow',
              style: {
                right: '20px',
                top: '20px',
                color: 'white',
              },
              tap_action: {
                action: 'call-service',
                service: 'notify.persistent_notification',
                service_data: {
                  message: 'Hello 1',
                },
              },
            },
            {
              type: 'service-button',
              title: 'title',
              service: 'service',
              service_data: {
                message: "It's a trick",
              },
            },
          ],
          view: {
            actions: {
              double_tap_action: {
                action: 'call-service',
                service: 'notify.persistent_notification',
                service_data: {
                  message: 'Hello 2',
                },
              },
              hold_action: {
                action: 'call-service',
                service: 'notify.persistent_notification',
                data: {
                  message: 'Hello 3',
                },
              },
            },
          },
        };
        expect(upgradeConfig(config)).toBeTruthy();
        expect(config).toEqual({
          type: 'custom:frigate-card',
          cameras: [{ camera_entity: 'camera.office' }],
          elements: [
            {
              type: 'icon',
              icon: 'mdi:cow',
              style: {
                right: '20px',
                top: '20px',
                color: 'white',
              },
              tap_action: {
                action: 'call-service',
                service: 'notify.persistent_notification',
                data: {
                  message: 'Hello 1',
                },
              },
            },
            {
              type: 'service-button',
              title: 'title',
              service: 'service',
              // Trick: This *is* still called service_data in HA, so should not
              // be modified.
              service_data: {
                message: "It's a trick",
              },
            },
          ],
          view: {
            actions: {
              double_tap_action: {
                action: 'call-service',
                service: 'notify.persistent_notification',
                data: {
                  message: 'Hello 2',
                },
              },
              hold_action: {
                action: 'call-service',
                service: 'notify.persistent_notification',
                data: {
                  message: 'Hello 3',
                },
              },
            },
          },
        });
      });
      it('negative case', () => {
        const config = {
          type: 'custom:frigate-card',
          cameras: [{ camera_entity: 'camera.office' }],
          view: {
            default: 'live',
          },
        };
        expect(upgradeConfig(config)).toBeFalsy();
        expect(config).toEqual({
          type: 'custom:frigate-card',
          cameras: [{ camera_entity: 'camera.office' }],
          view: {
            default: 'live',
          },
        });
      });
    });
  });

  describe('should move PTZ elements to live', () => {
    it('case with 1 element', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:frigate-card-ptz',
            orientation: 'vertical',
            style: {
              right: '20px',
              top: '20px',
              color: 'white',
            },
            actions_up: {
              tap_action: {
                action: 'call-service',
                service: 'notify.persistent_notification',
                service_data: {
                  message: 'Hello 1',
                },
              },
            },
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        cameras: [{ camera_entity: 'camera.office' }],
        live: {
          controls: {
            ptz: {
              actions_up: {
                tap_action: {
                  action: 'call-service',
                  data: {
                    message: 'Hello 1',
                  },
                  service: 'notify.persistent_notification',
                },
              },
              orientation: 'vertical',
              style: {
                color: 'white',
                right: '20px',
                top: '20px',
              },
            },
          },
        },
        type: 'custom:frigate-card',
      });
    });

    it('case with >1 element', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:frigate-card-ptz',
            orientation: 'vertical',
            style: {
              right: '20px',
              top: '20px',
              color: 'white',
            },
            actions_up: {
              tap_action: {
                action: 'call-service',
                service: 'notify.persistent_notification',
                service_data: {
                  message: 'Hello 1',
                },
              },
            },
          },
          {
            type: 'service-button',
            title: 'title',
            service: 'service',
            service_data: {
              message: "It's a trick",
            },
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            service: 'service',
            service_data: {
              message: "It's a trick",
            },
            title: 'title',
            type: 'service-button',
          },
        ],
        live: {
          controls: {
            ptz: {
              actions_up: {
                tap_action: {
                  action: 'call-service',
                  data: {
                    message: 'Hello 1',
                  },
                  service: 'notify.persistent_notification',
                },
              },
              orientation: 'vertical',
              style: {
                color: 'white',
                right: '20px',
                top: '20px',
              },
            },
          },
        },
        type: 'custom:frigate-card',
      });
    });

    it('case with custom conditional element with 2 PTZ but nothing else', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:frigate-card-conditional',
            conditions: {
              fullscreen: true,
              media_loaded: true,
            },
            elements: [
              {
                type: 'custom:frigate-card-ptz',
                orientation: 'vertical',
                style: {
                  right: '20px',
                  top: '20px',
                  color: 'white',
                },
                actions_up: {
                  tap_action: {
                    action: 'call-service',
                    service: 'notify.persistent_notification',
                    service_data: {
                      message: 'Hello 1',
                    },
                  },
                },
              },
              {
                type: 'custom:frigate-card-ptz',
                orientation: 'vertical',
                style: {
                  right: '20px',
                  top: '20px',
                  color: 'white',
                },
                actions_up: {
                  tap_action: {
                    action: 'call-service',
                    service: 'notify.persistent_notification',
                    service_data: {
                      message: 'Hello 2',
                    },
                  },
                },
              },
            ],
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        cameras: [{ camera_entity: 'camera.office' }],
        live: {
          controls: {
            ptz: {
              actions_up: {
                tap_action: {
                  action: 'call-service',
                  data: {
                    message: 'Hello 1',
                  },
                  service: 'notify.persistent_notification',
                },
              },
              orientation: 'vertical',
              style: {
                color: 'white',
                right: '20px',
                top: '20px',
              },
            },
          },
        },
        type: 'custom:frigate-card',
      });
    });

    it('case with custom conditional element with 1 PTZ and another element', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'custom:frigate-card-conditional',
            conditions: {
              fullscreen: true,
              media_loaded: true,
            },
            elements: [
              {
                type: 'service-button',
                title: 'title',
                service: 'service',
                service_data: {
                  message: "It's a trick",
                },
              },
              {
                type: 'custom:frigate-card-ptz',
                orientation: 'vertical',
                style: {
                  right: '20px',
                  top: '20px',
                  color: 'white',
                },
                actions_up: {
                  tap_action: {
                    action: 'call-service',
                    service: 'notify.persistent_notification',
                    service_data: {
                      message: 'Hello 1',
                    },
                  },
                },
              },
            ],
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        cameras: [{ camera_entity: 'camera.office' }],
        live: {
          controls: {
            ptz: {
              actions_up: {
                tap_action: {
                  action: 'call-service',
                  data: {
                    message: 'Hello 1',
                  },
                  service: 'notify.persistent_notification',
                },
              },
              orientation: 'vertical',
              style: {
                color: 'white',
                right: '20px',
                top: '20px',
              },
            },
          },
        },
        elements: [
          {
            type: 'custom:frigate-card-conditional',
            conditions: {
              fullscreen: true,
              media_loaded: true,
            },
            elements: [
              {
                type: 'service-button',
                title: 'title',
                service: 'service',
                service_data: {
                  message: "It's a trick",
                },
              },
            ],
          },
        ],
        type: 'custom:frigate-card',
      });
    });

    it('case with stock conditional element with 1 PTZ', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        elements: [
          {
            type: 'conditional',
            conditions: [{ entity: 'light.office', state: 'on' }],
            elements: [
              {
                type: 'custom:frigate-card-ptz',
                orientation: 'vertical',
                style: {
                  right: '20px',
                  top: '20px',
                  color: 'white',
                },
                actions_up: {
                  tap_action: {
                    action: 'call-service',
                    service: 'notify.persistent_notification',
                    service_data: {
                      message: 'Hello 1',
                    },
                  },
                },
              },
            ],
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        cameras: [{ camera_entity: 'camera.office' }],
        live: {
          controls: {
            ptz: {
              actions_up: {
                tap_action: {
                  action: 'call-service',
                  data: {
                    message: 'Hello 1',
                  },
                  service: 'notify.persistent_notification',
                },
              },
              orientation: 'vertical',
              style: {
                color: 'white',
                right: '20px',
                top: '20px',
              },
            },
          },
        },
        type: 'custom:frigate-card',
      });
    });

    it('case when live.controls.ptz already exists', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        live: {
          controls: {
            ptz: {
              actions_up: {
                tap_action: {
                  action: 'call-service',
                  data: {
                    message: 'Original',
                  },
                  service: 'notify.persistent_notification',
                },
              },
              orientation: 'vertical',
              style: {
                color: 'white',
                right: '20px',
                top: '20px',
              },
            },
          },
        },
        elements: [
          {
            type: 'custom:frigate-card-ptz',
            orientation: 'vertical',
            style: {
              right: '20px',
              top: '20px',
              color: 'white',
            },
            actions_up: {
              tap_action: {
                action: 'call-service',
                service: 'notify.persistent_notification',
                service_data: {
                  message: 'Replacement that should be ignored',
                },
              },
            },
          },
        ],
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        cameras: [{ camera_entity: 'camera.office' }],
        live: {
          controls: {
            ptz: {
              actions_up: {
                tap_action: {
                  action: 'call-service',
                  data: {
                    message: 'Original',
                  },
                  service: 'notify.persistent_notification',
                },
              },
              orientation: 'vertical',
              style: {
                color: 'white',
                right: '20px',
                top: '20px',
              },
            },
          },
        },
        type: 'custom:frigate-card',
      });
    });
  });

  describe('should move and transform untrigger_reset', () => {
    it('when true', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        view: {
          scan: {
            untrigger_reset: true,
          },
        },
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        view: {
          scan: {
            actions: {
              untrigger: 'default',
            },
          },
        },
      });
    });

    it('when false', () => {
      const config = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        view: {
          scan: {
            untrigger_reset: false,
          },
        },
      };
      expect(upgradeConfig(config)).toBeTruthy();
      expect(config).toEqual({
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        view: {
          scan: {},
        },
      });
    });
  });
});
