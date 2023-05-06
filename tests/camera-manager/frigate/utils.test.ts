import sub from 'date-fns/sub';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  getEventMediaContentID,
  getEventThumbnailURL,
  getEventTitle,
  getRecordingID,
  getRecordingMediaContentID,
  getRecordingTitle,
} from '../../../src/camera-manager/frigate/util';
import { CameraConfig } from '../../../src/types';
import {
  createCameraConfig,
  createFrigateEvent,
  createFrigateRecording,
} from '../../test-utils';

describe('getEventTitle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('should get finished event title', () => {
    expect(
      getEventTitle(
        createFrigateEvent({
          start_time: 1683395000,
          end_time: 1683397124,
          top_score: 0.841796875,
          label: 'person',
        }),
      ),
    ).toBe('2023-05-06 10:43 [2124s, Person 84%]');
  });
  it('should get in-progress event title', () => {
    const baseTime = new Date('2023-04-29T14:25');
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);
    const startTime = sub(baseTime, { seconds: 60 });

    expect(
      getEventTitle(
        createFrigateEvent({
          start_time: startTime.getTime() / 1000,
          end_time: null,
          top_score: 0.841796875,
          label: 'person',
        }),
      ),
    ).toBe('2023-04-29 14:24 [60s, Person 84%]');
  });
  it('should get scoreless event title', () => {
    expect(
      getEventTitle(
        createFrigateEvent({
          start_time: 1683395000,
          end_time: 1683397124,
          top_score: null,
          label: 'person',
        }),
      ),
    ).toBe('2023-05-06 10:43 [2124s, Person]');
  });
});

describe('getRecordingTitle', () => {
  it('should get recording title', () => {
    expect(
      getRecordingTitle(
        'Kitchen',
        createFrigateRecording({
          startTime: new Date('2023-04-29T14:00:00'),
        }),
      ),
    ).toBe('Kitchen 2023-04-29 14:00');
  });
});

describe('getEventThumbnailURL', () => {
  it('should get thumbnail URL', () => {
    expect(
      getEventThumbnailURL(
        'clientid',
        createFrigateEvent({
          id: '1683396875.643998-hmzrh5',
        }),
      ),
    ).toBe('/api/frigate/clientid/thumbnail/1683396875.643998-hmzrh5');
  });
});

describe('getEventMediaContentID', () => {
  it('should get event content ID', () => {
    expect(
      getEventMediaContentID(
        'clientid',
        'kitchen',
        createFrigateEvent({
          id: '1683396875.643998-hmzrh5',
        }),
        'clips',
      ),
    ).toBe(
      'media-source://frigate/clientid/event/clips/kitchen/1683396875.643998-hmzrh5',
    );
  });
});

describe('getRecordingMediaContentID', () => {
  it('should get recording content ID', () => {
    expect(
      getRecordingMediaContentID(
        'clientid',
        'kitchen',
        createFrigateRecording({
          startTime: new Date('2023-04-29T14:00:00'),
        }),
      ),
    ).toBe('media-source://frigate/clientid/recordings/kitchen/2023-04-29/14');
  });
});

describe('getRecordingID', () => {
  it('should get recording ID', () => {
    expect(
      getRecordingID(
        createCameraConfig({
          frigate: {
            client_id: 'unique_client_id',
            camera_name: 'kitchen',
          },
        }),
        createFrigateRecording({
          startTime: new Date('2023-04-29T14:00:00'),
          endTime: new Date('2023-04-29T14:59:59'),
        }),
      ),
    ).toBe('unique_client_id/kitchen/1682802000000/1682805599000');
  });
  it('should get recording ID without client_id or camera_name', () => {
    // Note: This path is defended against in the code but should not happen in
    // practice as this would be a malformed (not-zod-parsed) camera config.
    const cameraConfig = mock<CameraConfig>();
    expect(
      getRecordingID(
        cameraConfig,
        createFrigateRecording({
          startTime: new Date('2023-04-29T14:00:00'),
          endTime: new Date('2023-04-29T14:59:59'),
        }),
      ),
    ).toBe('//1682802000000/1682805599000');
  });
});
