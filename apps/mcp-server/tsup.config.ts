import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'configuration': 'src/configuration.ts',
    'config/config.default': 'src/config/config.default.ts',
    'tools/add-memory': 'src/tools/add-memory.ts',
    'tools/search-memory': 'src/tools/search-memory.ts',
    'tools/forget-memory': 'src/tools/forget-memory.ts',
    'tools/consolidate': 'src/tools/consolidate.ts',
    'resources/memory-resource': 'src/resources/memory-resource.ts',
  },
  format: 'esm',
  dts: true,
  clean: true,
});
