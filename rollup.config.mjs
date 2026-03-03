import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from '@rollup/plugin-terser';

export default {
  input: "src/index.ts",
  external: ["fabric"],
  output: {
    file: "dist/umd/image-editor.umd.js",
    format: "umd",
    name: "ImageEditor",
    globals: {
      fabric: "fabric"
    },
    sourcemap: true
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
    terser()
  ]
};