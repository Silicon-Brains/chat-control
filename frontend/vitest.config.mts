import { defineConfig } from 'vitest/config';
import tsconfigPathsPlugin from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPathsPlugin()],
  test: { environment: 'node', include: ['src/**/*.test.ts'], coverage: { include: ['src/lib/crypto/**'] } },
});
