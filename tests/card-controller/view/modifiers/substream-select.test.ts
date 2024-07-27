import { expect, it } from 'vitest';
import { SubstreamSelectViewModifier } from '../../../../src/card-controller/view/modifiers/substream-select';
import { getStreamCameraID, hasSubstream } from '../../../../src/utils/substream';
import { createView } from '../../../test-utils';

it('should select substream', () => {
  const view = createView({
    view: 'live',
    camera: 'camera.office',
  });

  expect(hasSubstream(view)).toBe(false);

  const modifier = new SubstreamSelectViewModifier('substream');
  modifier.modify(view);

  expect(hasSubstream(view)).toBe(true);
  expect(getStreamCameraID(view)).toBe('substream');
});
