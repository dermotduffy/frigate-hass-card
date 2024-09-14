import { expect, it } from 'vitest';
import { ScreenshotAction } from '../../../../src/card-controller/actions/actions/screenshot';
import { createCardAPI } from '../../../test-utils';

it('should handle screenshot action', async () => {
  const api = createCardAPI();
  const action = new ScreenshotAction(
    {},
    {
      action: 'fire-dom-event',
      frigate_card_action: 'screenshot',
    },
  );

  await action.execute(api);

  expect(api.getDownloadManager().downloadScreenshot).toBeCalled();
});
