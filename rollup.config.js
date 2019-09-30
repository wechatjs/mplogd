import typescript from 'rollup-plugin-typescript2'
import json from 'rollup-plugin-json'
import { uglify } from 'rollup-plugin-uglify'
import replace from 'rollup-plugin-replace'

export default [
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/mplogd.dev.js',
      format: 'umd',
      name: 'Mplogd'
    },
    plugins: [
      typescript(),
      json({
        include: 'package.json',
      }),
      replace({
        exclude: 'node_modules/**',
        IS_PROD: false,
      }),
    ],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/mplogd.js',
      format: 'umd',
      name: 'Mplogd'
    },
    plugins: [
      typescript(),
      json({
        include: 'package.json',
      }),
      replace({
        exclude: 'node_modules/**',
        IS_PROD: true,
      }),
    ],
  },
  {
    input: 'dist/mplogd.js',
    output: {
      file: 'dist/mplogd.min.js',
      format: 'umd',
      name: 'Mplogd'
    },
    plugins: [
      uglify(),
    ],
  },
]