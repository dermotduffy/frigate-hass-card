import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEndpointAddressOrDispatchError } from '../../src/utils/endpoint';
import { homeAssistantSignPath } from '../../src/utils/ha';
import { createHASS } from '../test-utils';

vi.mock('../../src/utils/ha');

// @vitest-environment jsdom
describe('getEndpointAddressOrDispatchError', () => {
  it('without signing', async () => {
    expect(
      await getEndpointAddressOrDispatchError(
        document.createElement('div'),
        createHASS(),
        {
          endpoint: 'http://example.com',
          sign: false,
        },
      ),
    ).toBe('http://example.com');
  });

  describe('with signing', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('successful', async () => {
      vi.mocked(homeAssistantSignPath).mockResolvedValue('http://signed.com');

      expect(
        await getEndpointAddressOrDispatchError(
          document.createElement('div'),
          createHASS(),
          {
            endpoint: 'http://example.com',
            sign: true,
          },
        ),
      ).toBe('ws://signed.com');
    });

    it('with null response', async () => {
      const element = document.createElement('div');
      const listener = vi.fn();
      element.addEventListener('frigate-card:message', listener);

      vi.mocked(homeAssistantSignPath).mockResolvedValue(null);

      expect(
        await getEndpointAddressOrDispatchError(element, createHASS(), {
          endpoint: 'http://example.com',
          sign: true,
        }),
      ).toBeNull();

      expect(listener).toBeCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            message: 'Could not sign Home Assistant URL',
          }),
        }),
      );
    });

    it('with exception on signing', async () => {
      const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

      const element = document.createElement('div');
      const listener = vi.fn();
      element.addEventListener('frigate-card:message', listener);

      vi.mocked(homeAssistantSignPath).mockRejectedValue(new Error());

      expect(
        await getEndpointAddressOrDispatchError(element, createHASS(), {
          endpoint: 'http://example.com',
          sign: true,
        }),
      ).toBeNull();

      expect(consoleSpy).toBeCalled();
    });
  });
});
