import { defineConfig } from 'vitest/config';

// These globs are expected to have 100% coverage.
const FULL_COVERAGE_FILES_RELATIVE = [
  'camera-manager/*.ts',
  'camera-manager/browse-media/camera.ts',
  'camera-manager/frigate/camera.ts',
  'camera-manager/frigate/icon.ts',
  'camera-manager/frigate/requests.ts',
  'camera-manager/frigate/util.ts',
  'camera-manager/generic/*.ts',
  'camera-manager/motioneye/icon.ts',
  'card-controller/*.ts',
  'components-lib/cached-value-controller.ts',
  'components-lib/media-filter-controller.ts',
  'components-lib/menu-button-controller.ts',
  'components-lib/menu-controller.ts',
  'components-lib/ptz-controller.ts',
  'components-lib/zoom-controller.ts',
  'config-mgmt.ts',
  'config/types.ts',
  'const.ts',
  'src/view/*.ts',
  'types.ts',
  'utils/action.ts',
  'utils/audio.ts',
  'utils/basic.ts',
  'utils/camera.ts',
  'utils/debug.ts',
  'utils/diagnostics.ts',
  'utils/download.ts',
  'utils/embla/**/*.ts',
  'utils/ha/entity-registry/types.ts',
  'utils/ha/types.ts',
  'utils/media-info.ts',
  'utils/media-to-view.ts',
  'utils/media.ts',
  'utils/ptz.ts',
  'utils/screenshot.ts',
  'utils/substream.ts',
  'utils/timer.ts',
  'utils/zod.ts',
];

interface Threshold {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  perFile: boolean;
}

const fullCoverage: Threshold = {
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
  perFile: true,
};

const calculateFullCoverageThresholds = (): Record<string, Threshold> => {
  return FULL_COVERAGE_FILES_RELATIVE.reduce(
    (a, v) => ({ ...a, ['**/src/' + v]: fullCoverage }),
    {},
  );
};

// ts-prune-ignore-next
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      // Favor istanbul for coverage over v8 due to better accuracy.
      provider: 'istanbul',

      thresholds: {
        // Thresholds will automatically be updated as coverage improves to avoid
        // back-sliding.
        autoUpdate: true,

        // Expected thresholds for anything that does not have 100% coverage
        // yet.
        statements: 15.54,
        branches: 10.38,
        functions: 16.18,
        lines: 15.84,

        ...calculateFullCoverageThresholds(),
      },
    },
  },
});