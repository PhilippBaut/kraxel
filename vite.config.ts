import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/kraxel/',
  server: { host: true },
  test: { environment: 'node' },
});
