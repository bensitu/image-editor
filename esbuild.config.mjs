import { build } from 'esbuild';

const shared = {
  entryPoints : ['src/image-editor.js'],
  bundle      : true,
  minify      : true,
  sourcemap   : true,
  legalComments: 'inline',
  external    : ['fabric']
};

await build({
  ...shared,
  format : 'esm',
  outfile: 'dist/image-editor.esm.min.js'
});

await build({
  ...shared,
  format    : 'iife',
  globalName: 'ImageEditor',
  outfile   : 'dist/image-editor.min.js'
});

console.log('✨  build finished');