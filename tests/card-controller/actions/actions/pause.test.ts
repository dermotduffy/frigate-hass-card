import { expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { PauseAction } from '../../../../src/card-controller/actions/actions/pause';
import { FrigateCardMediaPlayer } from '../../../../src/types';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';

it('should handle pause action', async () => {
  const api = createCardAPI();
  const player = mock<FrigateCardMediaPlayer>();
  vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
    createMediaLoadedInfo({
      player: player,
    }),
  );
  const action = new PauseAction(
    {},
    {
      action: 'fire-dom-event',
      frigate_card_action: 'pause',
    },
  );

  await action.execute(api);

  expect(player.pause).toBeCalled();
});
