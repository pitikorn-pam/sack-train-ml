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
      // src/lib/supabase.ts builds a client at import time, and createClient throws on
      // an empty URL — so any test that transitively imports a section or component
      // fails at import rather than at assert. These are inert placeholders: no test
      // may reach the network, and a test that needs a client mocks it.
      env: {
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_ANON_KEY: 'anon-key-for-tests-only',
      },
    },
  }),
)
