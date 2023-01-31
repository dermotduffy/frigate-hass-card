import {
    HassEntity,
    HassEntityAttributeBase,
    HassEntityBase
} from 'home-assistant-js-websocket';

const UPDATE_SUPPORT_PROGRESS = 4;

interface UpdateEntityAttributes extends HassEntityAttributeBase {
  auto_update: boolean | null;
  installed_version: string | null;
  in_progress: boolean | number;
  latest_version: string | null;
  release_summary: string | null;
  release_url: string | null;
  skipped_version: string | null;
  title: string | null;
}

export interface UpdateEntity extends HassEntityBase {
  attributes: UpdateEntityAttributes;
}

export const supportsFeature = (stateObj: HassEntity, feature: number): boolean =>
  ((stateObj.attributes.supported_features ?? 0) & feature) !== 0;

const updateUsesProgress = (entity: UpdateEntity): boolean =>
  supportsFeature(entity, UPDATE_SUPPORT_PROGRESS) &&
  typeof entity.attributes.in_progress === 'number';

export const updateIsInstalling = (entity: UpdateEntity): boolean =>
  updateUsesProgress(entity) || !!entity.attributes.in_progress;
