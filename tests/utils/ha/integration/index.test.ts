import { describe, expect, it, vi } from 'vitest';
import { getIntegrationManifest } from '../../../../src/utils/ha/integration';
import { integrationManifestSchema } from '../../../../src/utils/ha/integration/types';
import { homeAssistantWSRequest } from '../../../../src/utils/ha/ws-request';
import { createHASS } from '../../../test-utils';

vi.mock('../../../../src/utils/ha/ws-request');

describe('getIntegrationManifest', () => {
  it('should get integration manifest', async () => {
    const hass = createHASS();
    await getIntegrationManifest(hass, 'INTEGRATION');
    expect(homeAssistantWSRequest).toHaveBeenCalledWith(
      hass,
      integrationManifestSchema,
      { type: 'manifest/get', integration: 'INTEGRATION' },
    );
  });
});
