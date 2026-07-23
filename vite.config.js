import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { renameSync, rmSync, existsSync } from 'node:fs';

// Vite mirrors an HTML entry's source directory into dist (dist/src/app/app.html).
// MV3 needs a flat, predictable path, so this plugin relocates the file on disk
// after the write phase (generateBundle runs before vite's own html plugin adds
// the asset, so renaming there is a no-op). Internal asset references use
// root-absolute URLs ("/assets/..."), which resolve correctly from any path
// under the extension's chrome-extension:// origin, so moving the file is safe.
function flattenAppHtml() {
  return {
    name: 'flatten-app-html',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist');
      const from = resolve(outDir, 'src/app/app.html');
      const to = resolve(outDir, 'app.html');
      if (existsSync(from)) {
        renameSync(from, to);
        rmSync(resolve(outDir, 'src'), { recursive: true, force: true });
      }
    }
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [flattenAppHtml()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    // Vite normally wraps every dynamic import() with a helper that injects
    // <link rel="modulepreload"> and touches `document` to detect support.
    // That's fine on the main thread but throws "document is not defined"
    // for the dynamic import()s inside engine.worker.js, which runs in a
    // Web Worker with no document at all. Disabling modulePreload makes Vite
    // emit plain native import() calls everywhere instead, which work
    // correctly in both contexts.
    modulePreload: false,
    minify: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'src/app/app.html'),
        background: resolve(__dirname, 'src/background.js'),
        'engine.worker': resolve(__dirname, 'src/workers/engine.worker.js')
      },
      output: {
        entryFileNames: (chunk) => {
          // background.js and the worker need a fixed, predictable top-level
          // filename because manifest.json / new Worker() reference them by path.
          const fixed = ['background', 'engine.worker'];
          return fixed.includes(chunk.name) ? '[name].js' : 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/chunk-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  worker: {
    format: 'es'
  }
});
