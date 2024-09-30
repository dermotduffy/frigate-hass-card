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
  'camera-manager/utils/*.ts',
  'card-controller/**/*.ts',
  'components-lib/**/!(timeline-source.ts)',
  'config/**/*.ts',
  'const.ts',
  'types.ts',
  'utils/action.ts',
  'utils/audio.ts',
  'utils/basic.ts',
  'utils/camera.ts',
  'utils/debug.ts',
  'utils/diagnostics.ts',
  'utils/download.ts',
  'utils/embla/**/*.ts',
  'utils/endpoint.ts',
  'utils/ha/registry/**/*.ts',
  'utils/ha/types.ts',
  'utils/initializer.ts',
  'utils/interaction-mode.ts',
  'utils/media-info.ts',
  'utils/media-layout.ts',
  'utils/media.ts',
  'utils/ptz.ts',
  'utils/screenshot.ts',
  'utils/substream.ts',
  'utils/timer.ts',
  'utils/zod.ts',
  'view/*.ts',
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
      exclude: ['docs/**', 'tests/**', '.eslintrc.cjs'],

      // Favor istanbul for coverage over v8 due to better accuracy.
      provider: 'istanbul',
      thresholds: {
        ...calculateFullCoverageThresholds(),
      },
    },
  },
});
