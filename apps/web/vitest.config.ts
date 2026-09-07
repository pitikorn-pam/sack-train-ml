/**
 * Test config = the app's own vite config plus a `test` block.
 *
 * Merged rather than rewritten on purpose: the `@contracts` alias
 * (vite.config.ts:8-12) is what lets `src/lib/schema.ts` read the shared
 * param-schema.json. A test suite with its own hand-copied alias would keep
 * passing after the real one broke, which is worse than having no suite.
 */
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
    },
  }),
)
