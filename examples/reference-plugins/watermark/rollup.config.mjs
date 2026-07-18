export default {
    input: 'dist/esm/index.js',
    external: (source) => source === 'fabric' || source.startsWith('@bensitu/image-editor'),
    output: { file: 'dist/cjs/index.cjs', format: 'cjs', exports: 'named' },
};
