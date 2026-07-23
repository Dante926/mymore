import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';

// 纯 JS 和 HTML 文件复制插件
const copyHubAssets = {
  name: 'copy-hub-assets',
  buildEnd() {
    const srcDir = 'src/hub';
    const outDir = 'dist/hub';
    mkdirSync(outDir, { recursive: true });
    for (const name of readdirSync(srcDir)) {
      const src = join(srcDir, name);
      if (statSync(src).isFile()) {
        copyFileSync(src, join(outDir, name));
        console.log(`  📄 ${src} → ${join(outDir, name)}`);
      }
    }
  },
};

export default defineConfig({
  entry: {
    'bootstrap': 'src/bootstrap.ts',
  },
  format: 'esm',
  dts: false,
  clean: true,
  plugins: [copyHubAssets],
});
