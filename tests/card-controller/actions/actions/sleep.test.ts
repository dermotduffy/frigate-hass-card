import { afterAll, expect, it, vi } from 'vitest';
import { createCardAPI } from '../../../test-utils';
import { SleepAction } from '../../../../src/card-controller/actions/actions/sleep';
import { sleep } from '../../../../src/utils/basic';

vi.mock('../../../../src/utils/basic');

afterAll(() => {
  vi.restoreAllMocks();
});

it('should handle sleep action', async () => {
  const api = createCardAPI();
  const action = new SleepAction(
    {},
    {
      action: 'fire-dom-event',
      frigate_card_action: 'sleep',
      duration: {
        s: 5,
        ms: 200,
      },
    },
  );

  await action.execute(api);

  expect(sleep).toBeCalledWith(5.2);
});
