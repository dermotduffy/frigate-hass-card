import { expect, it } from 'vitest';
import { SubstreamOnAction } from '../../../../src/card-controller/actions/actions/substream-on';
import { createCardAPI } from '../../../test-utils';

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

  expect(api.getViewManager().setViewWithSubstream).toBeCalledWith();
});
