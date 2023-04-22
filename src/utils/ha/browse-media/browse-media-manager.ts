import { HomeAssistant } from 'custom-card-helpers';
import add from 'date-fns/add';
import { homeAssistantWSRequest } from '..';
import { MemoryRequestCache } from '../../../camera-manager/cache';
import { allPromises } from '../../basic';
import {
  BrowseMedia,
  browseMediaSchema,
  BROWSE_MEDIA_CACHE_SECONDS,
  RichBrowseMedia,
} from './types';

type BrowseMediaCache<M> = MemoryRequestCache<string, RichBrowseMedia<M>>;
type RichMetadataGenerator<M> = (
  media: BrowseMedia,
  parent?: RichBrowseMedia<M>,
) => M | null;

export type BrowseMediaTarget<M> = string | RichBrowseMedia<M>;
type RichBrowseMediaPredicate<M> = (media: RichBrowseMedia<M>) => boolean;

export interface BrowseMediaStep<M> {
  // The targets to start the media walk from.
  targets: BrowseMediaTarget<M>[];

  // All children of the target have the metadata generator applied to them
  // first.
  metadataGenerator?: RichMetadataGenerator<M>;

  // If those children pass this matcher, then they will be included in the
  // output.
  matcher: RichBrowseMediaPredicate<M>;

  // advance will be called to generate a next step (or null if the child should
  // just be included straight through to the output with no further steps).
  advance?: BrowseMediaStepAdvancer<M>;
}

type BrowseMediaStepAdvancer<M> = (media: RichBrowseMedia<M>[]) => BrowseMediaStep<M>[];

export class BrowseMediaManager<M> {
  protected _cache: BrowseMediaCache<M>;

  constructor(cache: BrowseMediaCache<M>) {
    this._cache = cache;
  }

  // Walk down a browse media tree according to instructions included in `steps`.
  public async walkBrowseMedias(
    hass: HomeAssistant,
    steps: BrowseMediaStep<M>[] | null,
    options?: {
      useCache?: boolean;
    },
  ): Promise<RichBrowseMedia<M>[]> {
    if (!steps || !steps.length) {
      return [];
    }
    return (
      await allPromises(
        steps,
        async (step) => await this._walkBrowseMedia(hass, step, options),
      )
    ).flat();
  }

  protected async _walkBrowseMedia(
    hass: HomeAssistant,
    step: BrowseMediaStep<M>,
    options?: {
      useCache?: boolean;
    },
  ): Promise<RichBrowseMedia<M>[]> {
    const media = await allPromises(
      step.targets,
      async (target) =>
        await this._browseMedia(hass, target, {
          useCache: options?.useCache,
          metadataGenerator: step.metadataGenerator,
        }),
    );

    const newTargets: RichBrowseMedia<M>[] = [];
    for (const parent of media) {
      for (const child of parent.children ?? []) {
        if (step.matcher(child)) {
          newTargets.push(child);
        }
      }
    }

    const nextSteps = step.advance ? step.advance(newTargets) : null;
    if (!nextSteps || !nextSteps.length) {
      return newTargets;
    }

    const targetsIncludedInNextSteps = new Set(
      nextSteps.map((nextStep) => nextStep.targets).flat(),
    );
    const finished: RichBrowseMedia<M>[] = [];

    // Any new target that doesn't have a proposed 'next step' is assumed to be
    // ready to return.
    for (const target of newTargets) {
      if (!targetsIncludedInNextSteps.has(target)) {
        finished.push(target);
      }
    }

    const downstream = await this.walkBrowseMedias(hass, nextSteps, options);
    return finished.concat(downstream);
  }

  protected async _browseMedia(
    hass: HomeAssistant,
    target: string | RichBrowseMedia<M>,
    options?: {
      useCache?: boolean;
      metadataGenerator?: RichMetadataGenerator<M>;
    },
  ): Promise<RichBrowseMedia<M>> {
    const mediaContentID = typeof target === 'object' ? target.media_content_id : target;
    const cachedResult =
      options?.useCache ?? true ? this._cache.get(mediaContentID) : null;
    if (cachedResult) {
      return cachedResult;
    }

    const request = {
      type: 'media_source/browse_media',
      media_content_id: mediaContentID,
    };
    const browseMedia = (await homeAssistantWSRequest(
      hass,
      browseMediaSchema,
      request,
    )) as RichBrowseMedia<M>;

    if (options?.metadataGenerator) {
      for (const child of browseMedia.children ?? []) {
        child._metadata =
          options.metadataGenerator(
            child,
            typeof target === 'object' ? target : undefined,
          ) ?? undefined;
      }
    }

    if (options?.useCache ?? true) {
      this._cache.set(
        mediaContentID,
        browseMedia,
        add(new Date(), { seconds: BROWSE_MEDIA_CACHE_SECONDS }),
      );
    }
    return browseMedia;
  }
}
