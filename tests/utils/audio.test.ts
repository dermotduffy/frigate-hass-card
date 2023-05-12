import { describe, expect, it } from 'vitest';
import { AudioProperties, mayHaveAudio } from '../../src/utils/audio';

// @vitest-environment jsdom
describe('mayHaveAudio', () => {
  it('should detect audio when mozHasAudio true', () => {
    const element: HTMLVideoElement & AudioProperties = document.createElement('video');
    element.mozHasAudio = true;
    expect(mayHaveAudio(element)).toBeTruthy();
  });

  it('should not detect audio when mozHasAudio undefined', () => {
    const element: HTMLVideoElement & AudioProperties = document.createElement('video');
    element.mozHasAudio = undefined;
    expect(mayHaveAudio(element)).toBeFalsy();
  });

  it('should detect audio when audioTracks has length', () => {
    // Workaround: "Cannot set property audioTracks of #<HTMLMediaElement> which has only a getter"
    const element = {} as HTMLVideoElement & AudioProperties;
    element.audioTracks = [1, 2, 3];
    expect(mayHaveAudio(element)).toBeTruthy();
  });

  it('should not detect audio when audioTracks has no length', () => {
    // Workaround: "Cannot set property audioTracks of #<HTMLMediaElement> which has only a getter"
    const element = {} as HTMLVideoElement & AudioProperties;
    element.audioTracks = [];
    expect(mayHaveAudio(element)).toBeFalsy();
  });

  it('should detect audio when no evidence to the contrary', () => {
    const element = {} as HTMLVideoElement & AudioProperties;
    expect(mayHaveAudio(element)).toBeTruthy();
  });
});
