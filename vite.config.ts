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
      statements: 72.66,
      branches: 61.9,
      functions: 73.96,
      lines: 72.56,
    },
  },
});
