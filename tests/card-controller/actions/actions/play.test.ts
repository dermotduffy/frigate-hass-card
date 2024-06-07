import { expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { PlayAction } from '../../../../src/card-controller/actions/actions/play';
import { FrigateCardMediaPlayer } from '../../../../src/types';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';

it('should handle play action', async () => {
  const api = createCardAPI();
  const player = mock<FrigateCardMediaPlayer>();
  vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
    createMediaLoadedInfo({
      player: player,
    }),
  );
  const action = new PlayAction(
    {},
    {
      action: 'fire-dom-event',
      frigate_card_action: 'play',
    },
  );

  await action.execute(api);

  expect(player.play).toBeCalled();
});
