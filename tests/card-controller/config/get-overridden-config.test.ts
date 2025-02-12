import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { z } from 'zod';
import { ConditionsManagerReadonlyInterface } from '../../../src/card-controller/conditions/types';
import { getOverriddenConfig } from '../../../src/card-controller/config/get-overridden-config';

describe('getOverriddenConfig', () => {
  const config = {
    menu: {
      style: 'none',
    },
  };

  it('should not override without overrides', () => {
    const manager = mock<ConditionsManagerReadonlyInterface>();
    manager.getEvaluation.mockReturnValue({ result: true });

    expect(getOverriddenConfig(manager, config)).toBe(config);
  });

  it('should not override when conditions do not match', () => {
    const manager = mock<ConditionsManagerReadonlyInterface>();
    manager.getEvaluation.mockReturnValue({ result: false });

    expect(
      getOverriddenConfig(manager, config, {
        configOverrides: [
          {
            merge: {
              menu: {
                style: 'hidden',
              },
            },
            delete: ['menu.style'],
            set: {
              'menu.style': 'overlay',
            },
            conditions: [
              {
                condition: 'fullscreen' as const,
                fullscreen: true,
              },
            ],
          },
        ],
      }),
    ).toBe(config);
  });

  describe('should merge', () => {
    it('with path', () => {
      const manager = mock<ConditionsManagerReadonlyInterface>();
      manager.getEvaluation.mockReturnValue({ result: true });

      expect(
        getOverriddenConfig(manager, config, {
          configOverrides: [
            {
              merge: {
                'live.controls.thumbnails': {
                  mode: 'none',
                },
              },
              conditions: [
                {
                  condition: 'fullscreen' as const,
                  fullscreen: true,
                },
              ],
            },
          ],
        }),
      ).toEqual({
        menu: {
          style: 'none',
        },
        live: {
          controls: {
            thumbnails: {
              mode: 'none',
            },
          },
        },
      });
    });

    it('without path', () => {
      const manager = mock<ConditionsManagerReadonlyInterface>();
      manager.getEvaluation.mockReturnValue({ result: true });

      expect(
        getOverriddenConfig(manager, config, {
          configOverrides: [
            {
              merge: {
                menu: {
                  style: 'hidden',
                },
              },
              conditions: [
                {
                  condition: 'fullscreen' as const,
                  fullscreen: true,
                },
              ],
            },
          ],
        }),
      ).toEqual({
        menu: {
          style: 'hidden',
        },
      });
    });

    it('with invalid merge', () => {
      const manager = mock<ConditionsManagerReadonlyInterface>();
      manager.getEvaluation.mockReturnValue({ result: true });

      expect(
        getOverriddenConfig(manager, config, {
          configOverrides: [
            {
              merge: 6 as unknown as Record<string, unknown>,
              conditions: [
                {
                  condition: 'fullscreen' as const,
                  fullscreen: true,
                },
              ],
            },
          ],
        }),
      ).toEqual({
        menu: {
          style: 'none',
        },
      });
    });
  });

  describe('should set', () => {
    it('leaf node', () => {
      const manager = mock<ConditionsManagerReadonlyInterface>();
      manager.getEvaluation.mockReturnValue({ result: true });

      expect(
        getOverriddenConfig(manager, config, {
          configOverrides: [
            {
              set: {
                'menu.style': 'hidden',
              },
              conditions: [
                {
                  condition: 'fullscreen' as const,
                  fullscreen: true,
                },
              ],
            },
          ],
        }),
      ).toEqual({
        menu: {
          style: 'hidden',
        },
      });
    });

    it('root node', () => {
      const manager = mock<ConditionsManagerReadonlyInterface>();
      manager.getEvaluation.mockReturnValue({ result: true });

      expect(
        getOverriddenConfig(manager, config, {
          configOverrides: [
            {
              set: {
                menu: {
                  style: 'hidden',
                },
              },
              conditions: [
                {
                  condition: 'fullscreen' as const,
                  fullscreen: true,
                },
              ],
            },
          ],
        }),
      ).toEqual({
        menu: {
          style: 'hidden',
        },
      });
    });
  });

  describe('should delete', () => {
    it('leaf node', () => {
      const manager = mock<ConditionsManagerReadonlyInterface>();
      manager.getEvaluation.mockReturnValue({ result: true });

      expect(
        getOverriddenConfig(manager, config, {
          configOverrides: [
            {
              delete: ['menu.style' as const],
              conditions: [
                {
                  condition: 'fullscreen' as const,
                  fullscreen: true,
                },
              ],
            },
          ],
        }),
      ).toEqual({
        menu: {},
      });
    });

    it('root node', () => {
      const manager = mock<ConditionsManagerReadonlyInterface>();
      manager.getEvaluation.mockReturnValue({ result: true });

      expect(
        getOverriddenConfig(manager, config, {
          configOverrides: [
            {
              delete: ['menu' as const],
              conditions: [
                {
                  condition: 'fullscreen' as const,
                  fullscreen: true,
                },
              ],
            },
          ],
        }),
      ).toEqual({});
    });
  });

  describe('should validate schema', () => {
    const testSchema = z.object({
      menu: z.object({
        style: z.enum(['none', 'hidden']),
      }),
    });

    it('passing', () => {
      const manager = mock<ConditionsManagerReadonlyInterface>();
      manager.getEvaluation.mockReturnValue({ result: true });

      expect(
        getOverriddenConfig(manager, config, {
          configOverrides: [
            {
              conditions: [
                {
                  condition: 'fullscreen' as const,
                  fullscreen: true,
                },
              ],
              set: {
                'menu.style': 'hidden',
              },
            },
          ],
          schema: testSchema,
        }),
      ).toEqual({
        menu: {
          style: 'hidden',
        },
      });
    });

    it('failing', () => {
      const manager = mock<ConditionsManagerReadonlyInterface>();
      manager.getEvaluation.mockReturnValue({ result: true });

      expect(() =>
        getOverriddenConfig(manager, config, {
          configOverrides: [
            {
              conditions: [
                {
                  condition: 'fullscreen' as const,
                  fullscreen: true,
                },
              ],
              set: {
                'menu.style': 'NOT_A_STYLE',
              },
            },
          ],
          schema: testSchema,
        }),
      ).toThrowError(/Invalid override configuration/);
    });
  });
});
