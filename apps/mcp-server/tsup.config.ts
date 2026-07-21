import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'configuration': 'src/configuration.ts',
    'config/config.default': 'src/config/config.default.ts',
    'tools/add-memory': 'src/tools/add-memory.ts',
    'tools/search-memory': 'src/tools/search-memory.ts',
  },
  format: 'esm',
  dts: true,
  clean: true,
});
