import { HassConfig } from 'home-assistant-js-websocket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLanguage } from '../../src/localize/localize';
import { getDiagnostics } from '../../src/utils/diagnostics.js';
import { getAllDevices } from '../../src/utils/ha/device-registry.js';
import { createHASS } from '../test-utils';

vi.mock('../../package.json', () => ({
  default: {
    version: '5.2.0',
    gitVersion: '5.2.0-dev+g4cf13b1',
    buildDate: 'Tue, 19 Sep 2023 04:59:27 GMT',
    gitDate: 'Wed, 6 Sep 2023 21:27:28 -0700',
  },
}));
vi.mock('../../src/utils/ha');
vi.mock('../../src/localize/localize.js');
vi.mock('../../src/utils/ha/device-registry');

// @vitest-environment jsdom
describe('getDiagnostics', () => {
  const now = new Date('2023-10-01T21:53Z');
  const hass = createHASS();
  hass.config = { version: '2023.9.0' } as HassConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    vi.mocked(getLanguage).mockReturnValue('en');
    vi.stubGlobal('navigator', { userAgent: 'FrigateCardTest/1.0' });

    vi.mocked(getAllDevices).mockResolvedValue([
      {
        model: '4.0.0/0.13.0-aded314',
        config_entries: [
          'ac4e79d258449a83bc0cf6d47a021c46',
          'b03e70c659d58ae2ce7f2dc76fed2929',
        ],
        manufacturer: 'Frigate',
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should fetch diagnostics', async () => {
    expect(
      await getDiagnostics(hass, {
        cameras: [{ camera_entity: 'camera.office' }],
      }),
    ).toEqual({
      browser: 'FrigateCardTest/1.0',
      card_version: '5.2.0',
      config: {
        cameras: [{ camera_entity: 'camera.office' }],
      },
      frigate_versions: {
        ac4e79d258449a83bc0cf6d47a021c46: '4.0.0/0.13.0-aded314',
        b03e70c659d58ae2ce7f2dc76fed2929: '4.0.0/0.13.0-aded314',
      },
      git: {
        build_date: 'Tue, 19 Sep 2023 04:59:27 GMT',
        build_version: '5.2.0-dev+g4cf13b1',
        commit_date: 'Wed, 6 Sep 2023 21:27:28 -0700',
      },
      date: now,
      lang: 'en',
      ha_version: '2023.9.0',
      timezone: expect.anything(),
    });
  });

  it('should fetch diagnostics without hass or config', async () => {
    expect(await getDiagnostics()).toEqual({
      browser: 'FrigateCardTest/1.0',
      card_version: '5.2.0',
      git: {
        build_date: 'Tue, 19 Sep 2023 04:59:27 GMT',
        build_version: '5.2.0-dev+g4cf13b1',
        commit_date: 'Wed, 6 Sep 2023 21:27:28 -0700',
      },
      date: now,
      lang: 'en',
      timezone: expect.anything(),
    });
  });

  it('should fetch diagnostics without device model', async () => {
    vi.mocked(getAllDevices).mockResolvedValue([
      {
        model: null,
        config_entries: [
          'ac4e79d258449a83bc0cf6d47a021c46',
          'b03e70c659d58ae2ce7f2dc76fed2929',
        ],
        manufacturer: 'Frigate',
      },
    ]);

    expect(await getDiagnostics(hass)).toEqual({
      browser: 'FrigateCardTest/1.0',
      card_version: '5.2.0',
      git: {
        build_date: 'Tue, 19 Sep 2023 04:59:27 GMT',
        build_version: '5.2.0-dev+g4cf13b1',
        commit_date: 'Wed, 6 Sep 2023 21:27:28 -0700',
      },
      ha_version: '2023.9.0',
      date: now,
      lang: 'en',
      timezone: expect.anything(),
    });
  });

  it('should fetch diagnostics if getAllDevices errors', async () => {
    vi.mocked(getAllDevices).mockRejectedValue(new Error());

    expect(await getDiagnostics(hass)).toEqual({
      browser: 'FrigateCardTest/1.0',
      card_version: '5.2.0',
      git: {
        build_date: 'Tue, 19 Sep 2023 04:59:27 GMT',
        build_version: '5.2.0-dev+g4cf13b1',
        commit_date: 'Wed, 6 Sep 2023 21:27:28 -0700',
      },
      ha_version: '2023.9.0',
      date: now,
      lang: 'en',
      timezone: expect.anything(),
    });
  });
});
