import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
  {
    input: ['src/index.ts'],
    output: {
      dir: 'dist',
      format: 'esm',
      preserveModules: true,
      sourcemap: true,
    },
    external: [/node_modules/],
    plugins: [typescript(), nodeResolve()],
  },
];
