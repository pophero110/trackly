import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

// Plugin to log rebuild events
const watchPlugin = {
  name: 'watch-plugin',
  setup(build) {
    let startTime;
    build.onStart(() => {
      startTime = Date.now();
      console.log('⚡ Rebuilding...');
    });
    build.onEnd((result) => {
      const duration = Date.now() - startTime;
      if (result.errors.length > 0) {
        console.log(`❌ Build failed with ${result.errors.length} error(s)`);
      } else {
        console.log(`✓ Build complete in ${duration}ms`);
      }
    });
  }
};

const config = {
  entryPoints: ['src/app/app.ts'],
  bundle: true,
  outfile: 'public/dist/app.js',
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  minify: false,
  loader: {
    '.ts': 'ts'
  },
  tsconfigRaw: {
    compilerOptions: {
      experimentalDecorators: true,
      useDefineForClassFields: false
    }
  },
  plugins: isWatch ? [watchPlugin] : []
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('👀 Watching for changes...');

  // Keep the process running
  await new Promise(() => {});
} else {
  await esbuild.build(config);
  console.log('✓ Build complete');
}
