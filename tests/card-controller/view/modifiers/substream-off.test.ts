import { expect, it } from 'vitest';
import { createView } from '../../../test-utils';
import { SubstreamOffViewModifier } from '../../../../src/card-controller/view/modifiers/substream-off';
import { hasSubstream, setSubstream } from '../../../../src/utils/substream';

it('should turn off substream', () => {
  const view = createView({
    view: 'live',
    camera: 'camera',
    displayMode: 'grid',
  });

  setSubstream(view, 'substream');
  expect(hasSubstream(view)).toBe(true);

  const modifier = new SubstreamOffViewModifier();
  modifier.modify(view);

  expect(hasSubstream(view)).toBe(false);
});
