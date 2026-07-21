import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bootstrap': 'src/bootstrap.ts',
  },
  format: 'esm',
  dts: false,
  clean: true,
});
