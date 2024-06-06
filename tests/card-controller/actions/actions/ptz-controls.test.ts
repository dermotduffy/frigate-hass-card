import { expect, it } from 'vitest';
import { createCardAPI } from '../../../test-utils';
import { PTZControlsAction } from '../../../../src/card-controller/actions/actions/ptz-controls';

it('should handle ptz_controls action', async () => {
  const api = createCardAPI();
  const action = new PTZControlsAction(
    {},
    {
      action: 'fire-dom-event',
      frigate_card_action: 'ptz_controls',
      enabled: true,
    },
  );

  await action.execute(api);

  expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith(
    expect.objectContaining({ ptzControls: { enabled: true } }),
  );
});
