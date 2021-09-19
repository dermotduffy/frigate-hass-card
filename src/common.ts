import { ZodSchema, z } from 'zod';
import { MessageBase } from 'home-assistant-js-websocket';
import { HomeAssistant } from 'custom-card-helpers';
import { localize } from './localize/localize';
import { BrowseMediaSource, browseMediaSourceSchema, ExtendedHomeAssistant } from './types';

export function getParseErrorKeys<T>(error: z.ZodError<T>): string[] {
  const errors = error.format();
  return Object.keys(errors).filter((v) => !v.startsWith('_'));
}

export async function homeAssistantWSRequest<T>(
  hass: HomeAssistant & ExtendedHomeAssistant,
  schema: ZodSchema<T>,
  request: MessageBase,
): Promise<T | null> {
  const response = await hass.callWS<T>(request);

  if (!response) {
    const error_message = `${localize('error.empty_response')}: ${JSON.stringify(
      request,
    )}`;
    console.warn(error_message);
    throw new Error(error_message);
  }
  const parseResult = schema.safeParse(response);
  if (!parseResult.success) {
    const keys = getParseErrorKeys<T>(parseResult.error);
    const error_message =
      `${localize('error.invalid_response')}: ${JSON.stringify(request)}. ` +
      localize('error.invalid_keys') +
      `: '${keys}'`;
    console.warn(error_message);
    throw new Error(error_message);
  }
  return parseResult.data;
}

// From a BrowseMediaSource item extract the first true media item (i.e. a
// clip/snapshot, not a folder).
export function getFirstTrueMediaChildIndex(
  media: BrowseMediaSource | null,
): number | null {
  if (!media || !media.children) {
    return null;
  }
  for (let i = 0; i < media.children.length; i++) {
    if (!media.children[i].can_expand) {
      return i;
    }
  }
  return null;
}

// Browse Frigate media with a media content id.
export async function browseMedia(
  hass: HomeAssistant & ExtendedHomeAssistant | null,
  media_content_id: string,
): Promise<BrowseMediaSource | null> {
  if (!hass) {
    return null;
  }
  const request = {
    type: 'media_source/browse_media',
    media_content_id: media_content_id,
  };
  return homeAssistantWSRequest(hass, browseMediaSourceSchema, request);
}

interface BrowseMediaQueryParameters {
  hass: HomeAssistant & ExtendedHomeAssistant,
  mediaType: "clips" | "snapshots",
  clientId: string,
  cameraName: string,
  label?: string,
  zone?: string,
  before?: number,
  after?: number,
}

// Browse Frigate media with query parameters.
export async function browseMediaQuery(params: BrowseMediaQueryParameters): Promise<BrowseMediaSource | null> {
  return browseMedia(
    params.hass,
    // Defined in:
    // https://github.com/blakeblackshear/frigate-hass-integration/blob/master/custom_components/frigate/media_source.py
    [
      'media-source://frigate',
      params.clientId,
      'event-search',
      params.mediaType,
      '', // Name/Title to render (not necessary here)
      params.after ? String(params.after) : '',
      params.before ? String(params.before) : '',
      params.cameraName,
      params.label,
      params.zone,
    ].join('/'),
  );
}
