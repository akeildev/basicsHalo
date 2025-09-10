#!/usr/bin/env node

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs-extra');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [
    'src/renderer/header/index.js',
    'src/renderer/listen/index.js', 
    'src/renderer/ask/index.js',
    'src/renderer/settings/index.js'
  ],
  bundle: true,
  outdir: 'dist/renderer',
  platform: 'browser',
  target: 'es2020',
  format: 'iife',
  sourcemap: isWatch,
  minify: !isWatch,
  define: {
    'process.env.NODE_ENV': JSON.stringify(isWatch ? 'development' : 'production')
  },
  loader: {
    '.js': 'jsx',
    '.jsx': 'jsx',
    '.ts': 'ts',
    '.tsx': 'tsx',
    '.css': 'css'
  },
  external: ['electron', 'livekit-client'],
  plugins: [
    {
      name: 'copy-assets',
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length === 0) {
            // Copy static assets
            await fs.copy('src/renderer/assets', 'dist/renderer/assets');
            
            // Copy HTML files to dist directory
            await fs.copy('src/renderer/header/index.html', 'dist/renderer/header/index.html');
            await fs.copy('src/renderer/header/styles.css', 'dist/renderer/header/styles.css');
            await fs.copy('src/renderer/header/preload.js', 'dist/renderer/header/preload.js');
            await fs.copy('src/renderer/listen/index.html', 'dist/renderer/listen/index.html');
            await fs.copy('src/renderer/listen/styles.css', 'dist/renderer/listen/styles.css');
            await fs.copy('src/renderer/listen/preload.js', 'dist/renderer/listen/preload.js');
            await fs.copy('src/renderer/ask/index.html', 'dist/renderer/ask/index.html');
            await fs.copy('src/renderer/ask/styles.css', 'dist/renderer/ask/styles.css');
            await fs.copy('src/renderer/ask/preload.js', 'dist/renderer/ask/preload.js');
            await fs.copy('src/renderer/settings/index.html', 'dist/renderer/settings/index.html');
            await fs.copy('src/renderer/settings/styles.css', 'dist/renderer/settings/styles.css');
            await fs.copy('src/renderer/settings/preload.js', 'dist/renderer/settings/preload.js');
            
            // Copy splash screen files
            await fs.copy('src/renderer/splash/index.html', 'dist/renderer/splash/index.html');
            await fs.copy('src/renderer/splash/styles.css', 'dist/renderer/splash/styles.css');
            await fs.copy('src/renderer/splash/splash.js', 'dist/renderer/splash/splash.js');
            await fs.copy('src/renderer/splash/preload.js', 'dist/renderer/splash/preload.js');
            
            console.log('✅ Assets copied');
          }
        });
      }
    }
  ]
};

async function build() {
  try {
    console.log('🔨 Building renderer...');
    
    if (isWatch) {
      console.log('👀 Watching for changes...');
      const context = await esbuild.context(buildOptions);
      await context.watch();
    } else {
      await esbuild.build(buildOptions);
      console.log('✅ Build complete');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
