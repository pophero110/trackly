import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/app.ts'],
  bundle: true,
  outfile: 'public/dist/app.js',
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  minify: false,
  loader: {
    '.ts': 'ts'
  }
});

console.log('✓ Build complete');
