import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { homeAssistantWSRequest } from '../ws-request';
import { IntegrationManifest, integrationManifestSchema } from './types';

export const getIntegrationManifest = async (
  hass: HomeAssistant,
  integration: string,
): Promise<IntegrationManifest> => {
  return await homeAssistantWSRequest(hass, integrationManifestSchema, {
    type: 'manifest/get',
    integration: integration,
  });
};
