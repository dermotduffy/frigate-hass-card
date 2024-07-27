import { expect, it } from 'vitest';
import { SubstreamOnAction } from '../../../../src/card-controller/actions/actions/substream-on';
import { createCardAPI } from '../../../test-utils';
import { SubstreamOnViewModifier } from '../../../../src/card-controller/view/modifiers/substream-on';

it('should handle live_substream_on action', async () => {
  const api = createCardAPI();
  const action = new SubstreamOnAction(
    {},
    {
      action: 'fire-dom-event',
      frigate_card_action: 'live_substream_on',
    },
  );

  await action.execute(api);

  expect(api.getViewManager().setViewByParameters).toBeCalledWith({
    modifiers: [expect.any(SubstreamOnViewModifier)],
  });
});
