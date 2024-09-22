import { expect, it } from 'vitest';
import { SCRUBBING_PROFILE } from '../../../src/config/profiles/scrubbing';
import { setProfiles } from '../../../src/config/profiles';
import { frigateCardConfigSchema } from '../../../src/config/types';
import { createRawConfig } from '../../test-utils';

it('should contain expected defaults', () => {
  expect(SCRUBBING_PROFILE).toEqual({
    'live.controls.timeline.mode': 'below',
    'live.controls.timeline.style': 'ribbon',
    'live.controls.timeline.pan_mode': 'seek',
    'media_viewer.controls.timeline.mode': 'below',
    'media_viewer.controls.timeline.style': 'ribbon',
    'media_viewer.controls.timeline.pan_mode': 'seek',
  });
});

it('should be parseable after application', () => {
  const rawInputConfig = createRawConfig();
  const parsedConfig = frigateCardConfigSchema.parse(rawInputConfig);

  setProfiles(rawInputConfig, parsedConfig, ['low-performance']);

  // Reparse the config to ensure the profile did not introduce errors.
  const parseResult = frigateCardConfigSchema.safeParse(parsedConfig);
  expect(parseResult.success, parseResult.error?.toString()).toBeTruthy();
});
