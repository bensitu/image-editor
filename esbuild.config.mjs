import esbuild from 'esbuild'

const shared = {
  bundle: true,
  sourcemap: true,
  legalComments: 'inline',
  target: ['chrome100', 'firefox100', 'safari15', 'edge100']
};

const builds = [
  {
    entryPoints: ['src/esm.js'],
    format: 'esm',
    external: ['fabric'],
    outfile: 'dist/image-editor.esm.js',
    minify: false
  },
  {
    entryPoints: ['src/esm.js'],
    format: 'esm',
    external: ['fabric'],
    outfile: 'dist/image-editor.esm.min.js',
    minify: true
  },
  {
    entryPoints: ['src/esm.js'],
    format: 'esm',
    external: ['fabric'],
    outfile: 'dist/image-editor.esm.mjs',
    minify: false
  },
  {
    entryPoints: ['src/esm.js'],
    format: 'esm',
    external: ['fabric'],
    outfile: 'dist/image-editor.esm.min.mjs',
    minify: true
  },
  {
    entryPoints: ['src/esm.js'],
    format: 'cjs',
    external: ['fabric'],
    outfile: 'dist/image-editor.cjs',
    footer: {
      js: 'if (module.exports && module.exports.default) module.exports = Object.assign(module.exports.default, module.exports);'
    },
    minify: false
  },
  {
    entryPoints: ['src/browser.js'],
    format: 'iife',
    outfile: 'dist/image-editor.js',
    minify: false
  },
  {
    entryPoints: ['src/browser.js'],
    format: 'iife',
    outfile: 'dist/image-editor.min.js',
    minify: true
  }
];

await Promise.all(builds.map(build => esbuild.build({
    ...shared,
    ...build
  })));

console.log('✨  build finished!  ✨');
