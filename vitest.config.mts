import { defineConfig } from 'vitest/config';

// The workspace path contains "(2)". Angular's unit-test builder hands Vitest absolute test
// file paths as glob patterns, so glob metacharacters in the path must be escaped or no test
// file is found.
const escapeGlob = (pattern: string) => pattern.replace(/[()[\]{}*?!+@]/g, '\\$&');

export default defineConfig({
  plugins: [
    {
      name: 'escape-absolute-test-includes',
      config(config: { test?: { include?: string[] } }) {
        if (config.test?.include) {
          config.test.include = config.test.include.map(escapeGlob);
        }
      },
    },
  ],
});
