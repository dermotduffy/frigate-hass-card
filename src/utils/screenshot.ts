import format from 'date-fns/format';
import { View } from '../view/view';

export const screenshotMedia = (video: HTMLVideoElement): string | null => {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg');
};

export const generateScreenshotTitle = (view?: View): string => {
  if (view?.is('live') || view?.is('image')) {
    return `${view.view}-${view.camera}-${format(
      new Date(),
      `yyyy-MM-dd-HH-mm-ss`,
    )}.jpg`;
  } else if (view?.isViewerView()) {
    const media = view.queryResults?.getSelectedResult();
    const id = media?.getID() ?? null;
    return `${view.view}-${view.camera}${id ? `-${id}` : ''}.jpg`;
  }
  return 'screenshot.jpg';
};
