import { VideoRTC } from '../../../components/live/providers/go2rtc/video-rtc';
import { MediaTechnology } from '../../../types';

export const getTechnologyForVideoRTC = (
  element: VideoRTC,
): MediaTechnology[] | undefined => {
  const tech = [
    ...(!!element.pc ? ['webrtc'] : []),
    ...(!element.pc && element.mseCodecs ? ['mse', 'hls'] : []),
  ];
  return tech.length ? tech : undefined;
};
