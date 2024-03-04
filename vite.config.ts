import { defineConfig } from 'vitest/config';

// ts-prune-ignore-next
export default defineConfig({
  test: {
    include: [
      "tests/**/*.test.ts"
    ],
    coverage: {
      // Favor istanbul for coverage over v8 due to better accuracy.
      provider: 'istanbul',

      // Thresholds will automatically be updated as coverage improves to avoid
      // back-sliding.
      thresholds: {
        autoUpdate: true,
        statements: 51.11,
        branches: 43.04,
        functions: 51.03,
        lines: 51.91,
      },
    },
  },
});
