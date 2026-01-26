import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import postcss from 'rollup-plugin-postcss';

export default [
  // UMD build (for script tags)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/quinn-widget.js',
      format: 'umd',
      name: 'QuinnWidget',
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM'
      },
      sourcemap: true
    },
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      postcss({
        extract: true,
        minimize: true
      }),
      terser()
    ],
    external: ['react', 'react-dom']
  },

  // ESM build (for modern bundlers)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/quinn-widget.esm.js',
      format: 'esm',
      sourcemap: true
    },
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      postcss({
        extract: false,
        inject: true
      })
    ],
    external: ['react', 'react-dom']
  },

  // Standalone build (includes React - for non-React sites)
  {
    input: 'src/standalone.ts',
    output: {
      file: 'dist/quinn-standalone.js',
      format: 'iife',
      name: 'QuinnWidget',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      postcss({
        extract: true,
        minimize: true
      }),
      terser()
    ]
  }
];
