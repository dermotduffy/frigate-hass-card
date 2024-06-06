import { it } from 'vitest';
import { BaseAction } from '../../../../src/card-controller/actions/actions/base';
import { createCardAPI } from '../../../test-utils';

it('should construct', async () => {
  const api = createCardAPI();
  const action = new BaseAction(
    {},
    {
      action: 'fire-dom-event',
    },
  );

  await action.execute(api);
  await action.stop();

  // These methods have no observable effect on the base class, so this test is
  // currently only providing coverage and proof of no exceptions!
});
