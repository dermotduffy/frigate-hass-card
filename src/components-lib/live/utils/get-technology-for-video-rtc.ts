import { MediaTechnology } from '../../../types';
import { VideoRTC } from '../../../components/live/go2rtc/video-rtc';

export const getTechnologyForVideoRTC = (
  element: VideoRTC,
): MediaTechnology[] | undefined => {
  const tech = [
    ...(!!element.pc ? ['webrtc'] : []),
    ...(!element.pc && element.mseCodecs ? ['mse', 'hls'] : []),
  ];
  return tech.length ? tech : undefined;
};
