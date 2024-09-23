import { expect, it } from 'vitest';
import { setProfiles } from '../../../src/config/profiles';
import { frigateCardConfigSchema } from '../../../src/config/types';
import { createRawConfig } from '../../test-utils';
import { CASTING_PROFILE } from '../../../src/config/profiles/casting';

it('should contain expected defaults', () => {
  expect(CASTING_PROFILE).toEqual({
    'dimensions.aspect_ratio': '16:9',
    'live.auto_unmute': ['selected', 'visible'],
    'menu.style': 'none',
  });
});

it('should be parseable after application', () => {
  const rawInputConfig = createRawConfig();
  const parsedConfig = frigateCardConfigSchema.parse(rawInputConfig);

  setProfiles(rawInputConfig, parsedConfig, ['casting']);

  // Reparse the config to ensure the profile did not introduce errors.
  const parseResult = frigateCardConfigSchema.safeParse(parsedConfig);
  expect(parseResult.success, parseResult.error?.toString()).toBeTruthy();
});
