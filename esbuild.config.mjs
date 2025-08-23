import esbuild from 'esbuild'
import babel from 'esbuild-plugin-babel';

const shared = {
  entryPoints: ['src/image-editor.js'],
  bundle: true,
  minify: true,
  sourcemap: true,
  legalComments: 'inline',
  external: ['fabric'],
  plugins: [
    babel({
      filter: /\.m?js$/,
      config: {
        presets: [
          ['@babel/preset-env', {
            targets: { ie: '11' },
            modules: false,
            useBuiltIns: false
          }]
        ]
      }
    })
  ]
};

await esbuild.build({
  ...shared,
  format: 'esm',
  outfile: 'dist/image-editor.esm.min.js'
});

await esbuild.build({
  ...shared,
  format: 'iife',
  globalName: 'ImageEditor',
  outfile: 'dist/image-editor.min.js'
});

console.log('✨  build finished!  ✨');