import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// Keep in sync with src/standalone.ts
const STANDALONE_FILE_NAME = 'kit-finder-standalone.html';

// Folds the built JS, CSS and favicon into index.html so the app works as one downloadable file
function inlineIntoSingleFile(): Plugin {
  return {
    name: 'inline-into-single-file',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);

      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'chunk' && output.isEntry) {
          // Keep the inline script from being closed early by "</script" inside the bundle
          const code = output.code.replace(/<\/script/gi, '<\\/script');
          source = source.replace(
            new RegExp(`<script[^>]*src="[^"]*${fileName}"[^>]*></script>`),
            () => `<script type="module">${code}</script>`
          );
          delete bundle[fileName];
        } else if (output.type === 'asset' && fileName.endsWith('.css')) {
          source = source.replace(
            new RegExp(`<link[^>]*href="[^"]*${fileName}"[^>]*>`),
            () => `<style>${String(output.source)}</style>`
          );
          delete bundle[fileName];
        }
      }

      const favicon = fs.readFileSync(path.resolve(__dirname, 'public/favicon.svg'));
      source = source.replace(
        'href="/favicon.svg"',
        `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`
      );

      delete bundle['index.html'];
      this.emitFile({type: 'asset', fileName: STANDALONE_FILE_NAME, source});
    },
  };
}

export default defineConfig(({mode}) => {
  const standalone = mode === 'standalone';
  return {
    plugins: [react(), tailwindcss(), ...(standalone ? [inlineIntoSingleFile()] : [])],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // The standalone file is added next to the regular build output
    build: standalone
      ? {
          emptyOutDir: false,
          copyPublicDir: false,
          assetsInlineLimit: Number.MAX_SAFE_INTEGER,
          cssCodeSplit: false,
          modulePreload: false,
        }
      : undefined,
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
