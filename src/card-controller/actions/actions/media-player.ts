import { MediaPlayerActionConfig } from '../../../config/types';
import { getStreamCameraID } from '../../../utils/substream';
import { CardActionsAPI } from '../../types';
import { FrigateCardAction } from './base';

export class MediaPlayerAction extends FrigateCardAction<MediaPlayerActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    const mediaPlayer = this._action.media_player;
    const mediaPlayerController = api.getMediaPlayerManager();
    const view = api.getViewManager().getView();
    const media = view?.queryResults?.getSelectedResult() ?? null;

    if (this._action.media_player_action === 'stop') {
      await mediaPlayerController.stop(mediaPlayer);
    } else if (view?.is('live')) {
      await mediaPlayerController.playLive(mediaPlayer, getStreamCameraID(view));
    } else if (view?.isViewerView() && media) {
      await mediaPlayerController.playMedia(mediaPlayer, media);
    }
  }
}
