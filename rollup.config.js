import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import serve from 'rollup-plugin-serve';
import json from '@rollup/plugin-json';
import styles from 'rollup-plugin-styles';
import image from '@rollup/plugin-image';
import replace from '@rollup/plugin-replace';
import gitInfo from 'rollup-plugin-git-info';
import { visualizer } from 'rollup-plugin-visualizer';

const watch = process.env.ROLLUP_WATCH === 'true' || process.env.ROLLUP_WATCH === '1';
const dev = watch || process.env.DEV === 'true' || process.env.DEV === '1';

/**
 * @type {import('rollup-plugin-serve').ServeOptions}
 */
const serveopts = {
  contentBase: ['./dist'],
  host: '0.0.0.0',
  port: 10001,
  allowCrossOrigin: true,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
};

/**
 * @type {import('rollup').RollupOptions['plugins']}
 */
const plugins = [
  gitInfo({ enableBuildDate: true, updateVersion: false }),
  styles({
    modules: false,
    // Behavior of inject mode, without actually injecting style
    // into <head>.
    mode: ['inject', () => undefined],
    sass: {
      includePaths: ['./node_modules/'],
    },
  }),
  image(),
  nodeResolve({
    browser: true,
  }),
  commonjs({
    include: 'node_modules/**',
    sourceMap: false,
  }),
  typescript(),
  json({ exclude: 'package.json' }),
  replace({
    preventAssignment: true,
    values: {
      'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),
    },
  }),
  watch && serve(serveopts),
  !dev && terser(),
  visualizer(),
];

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
  input: 'src/card.ts',
  // Specifically want a facade created as HACS will attach a hacstag
  // queryparameter to the resource. Without a facade when chunks re-import the
  // card chunk, they'll refer to a 'different' copy of the card chunk without
  // the hacstag, causing a re-download of the same content and functionality
  // problems.
  preserveEntrySignatures: 'strict',
  output: {
    entryFileNames: 'frigate-hass-card.js',
    dir: 'dist',
    chunkFileNames: (chunk) => {
      // Add "lang-" to the front of the language chunk names for readability.
      if (
        chunk.facadeModuleId &&
        chunk.facadeModuleId.match(/localize\/languages\/.*\.json/)
      ) {
        return 'lang-[name]-[hash].js';
      }
      return '[name]-[hash].js';
    },
    format: 'es',
    ...(dev && {
      sourcemap: true,
    }),
  },
  plugins: plugins,
  // These files use this at the toplevel, which causes rollup warning
  // spam on build: `this` has been rewritten to `undefined`.
  moduleContext: {
    './node_modules/@formatjs/intl-utils/lib/src/diff.js': 'window',
    './node_modules/@formatjs/intl-utils/lib/src/resolve-locale.js': 'window',
    './node_modules/flatpickr/dist/esm/index.js': 'window',
  },
};

export default config;
