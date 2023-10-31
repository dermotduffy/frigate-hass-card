import { defineConfig } from 'vitest/config';

// ts-prune-ignore-next
export default defineConfig({
  test: {
    coverage: {
      // Favor istanbul for coverage over v8 due to better accuracy.
      provider: 'istanbul',

      // Thresholds will automatically be updated as coverage improves to avoid
      // back-sliding.
      thresholdAutoUpdate: true,
      statements: 71.65,
      branches: 60.62,
      functions: 72.78,
      lines: 71.54,
    },
  },
});
