const buble = require('rollup-plugin-buble');
const uglify = require('rollup-plugin-uglify');
const uglifyEs = require('rollup-plugin-uglify-es');
let input = 'src/index.js';

export default [
  {
		input,
		plugins: [buble()],
    name: 'SUtils',
    output: {
      file: 'dist/s-utilities.iife.js',
      format: 'iife'
    }
  },
  {
		input,
		plugins: [buble(), uglify()],
    name: 'SUtils',
    output: {
      file: 'dist/s-utilities.iife.min.js',
      format: 'iife'
    }
  },
	{
		input,
    output: {
      file: 'dist/s-utilities.mjs',
      format: 'es'
    }
  },
  {
		input,
    plugins: [uglifyEs()],
    output: {
      file: 'dist/s-utilities.min.mjs',
      format: 'es'
    }
  },
  {
		input,
    output: {
      file: 'index.js',
      format: 'cjs'
    }
  }
];
