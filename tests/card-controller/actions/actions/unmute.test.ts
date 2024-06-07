import { expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { UnmuteAction } from '../../../../src/card-controller/actions/actions/unmute';
import { FrigateCardMediaPlayer } from '../../../../src/types';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';

it('should handle unmute action', async () => {
  const api = createCardAPI();
  const player = mock<FrigateCardMediaPlayer>();
  vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
    createMediaLoadedInfo({
      player: player,
    }),
  );
  const action = new UnmuteAction(
    {},
    {
      action: 'fire-dom-event',
      frigate_card_action: 'unmute',
    },
  );

  await action.execute(api);

  expect(player.unmute).toBeCalled();
});
