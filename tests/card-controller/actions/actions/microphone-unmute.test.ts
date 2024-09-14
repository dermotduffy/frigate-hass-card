import { expect, it } from 'vitest';
import { createCardAPI } from '../../../test-utils';
import { MicrophoneUnmuteAction } from '../../../../src/card-controller/actions/actions/microphone-unmute';

it('should handle microphone_unmute action', async () => {
  const api = createCardAPI();
  const action = new MicrophoneUnmuteAction(
    {},
    {
      action: 'fire-dom-event',
      frigate_card_action: 'microphone_unmute',
    },
  );

  await action.execute(api);

  expect(api.getMicrophoneManager().unmute).toBeCalled();
});
