const buble = require('rollup-plugin-buble');
const uglify = require('rollup-plugin-uglify');
const uglifyEs = require('rollup-plugin-uglify-es');
let input = 'src/tiny-patch.mjs';

export default [
  {
		input,
		plugins: [buble()],
    output: {
      name: 'TinyPatch',
      file: 'dist/tiny-patch.iife.js',
      format: 'iife'
    }
  },
  {
		input,
		plugins: [buble(), uglify()],
    output: {
      name: 'TinyPatch',
      file: 'dist/tiny-patch.iife.min.js',
      format: 'iife'
    }
  },
	{
		input,
    output: {
      file: 'dist/tiny-patch.mjs',
      format: 'es'
    }
  },
  {
		input,
    plugins: [uglifyEs()],
    output: {
      file: 'dist/tiny-patch.min.mjs',
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
