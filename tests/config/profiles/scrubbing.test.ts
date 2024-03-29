import { expect, it } from 'vitest';
import { SCRUBBING_PROFILE } from '../../../src/config/profiles/scrubbing';

it('scrubbing profile', () => {
  expect(SCRUBBING_PROFILE).toEqual({
    'live.controls.timeline.mode': 'below',
    'live.controls.timeline.style': 'ribbon',
    'live.controls.timeline.pan_mode': 'seek',
    'media_viewer.controls.timeline.mode': 'below',
    'media_viewer.controls.timeline.style': 'ribbon',
    'media_viewer.controls.timeline.pan_mode': 'seek',
  });
});
