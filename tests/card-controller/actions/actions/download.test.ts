import { expect, it } from 'vitest';
import { DownloadAction } from '../../../../src/card-controller/actions/actions/download';
import { createCardAPI } from '../../../test-utils';

it('should handle download action', async () => {
  const api = createCardAPI();
  const action = new DownloadAction(
    {},
    {
      action: 'fire-dom-event',
      frigate_card_action: 'download',
    },
  );

  await action.execute(api);

  expect(api.getDownloadManager().downloadViewerMedia).toBeCalled();
});
