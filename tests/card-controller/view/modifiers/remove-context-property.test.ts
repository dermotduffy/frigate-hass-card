import { expect, it } from 'vitest';
import { createView } from '../../../test-utils';
import { RemoveContextPropertyViewModifier } from '../../../../src/card-controller/view/modifiers/remove-context-property';

it('should remove context property', () => {
  const modifier = new RemoveContextPropertyViewModifier('timeline', 'window');

  const view = createView({
    view: 'live',
    camera: 'camera',
    displayMode: 'grid',
    context: {
      timeline: {
        window: {
          start: new Date(),
          end: new Date(),
        },
      },
    },
  });

  modifier.modify(view);

  expect(view.context).toEqual({ timeline: {} });
});
