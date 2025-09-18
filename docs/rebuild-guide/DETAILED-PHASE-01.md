# Phase 1: Project Setup and Foundation - Detailed Implementation

## 1.1 Create Project Directory Structure

```bash
# Create the project
mkdir voice-overlay
cd voice-overlay

# Create the complete directory structure
mkdir -p src/{main,renderer,agent}
mkdir -p src/main/services
mkdir -p src/renderer/{assets,components}
mkdir -p src/agent/tools
mkdir -p assets/icons
mkdir -p build
mkdir -p dist
```

## 1.2 Initialize Package.json with Exact Dependencies

Create `package.json`:
```json
{
  "name": "voice-overlay",
  "productName": "Voice Overlay",
  "version": "0.1.0",
  "description": "Simplified voice-focused desktop overlay with MCP",
  "main": "src/main/index.js",
  "author": {
    "name": "Your Name"
  },
  "license": "GPL-3.0",
  "scripts": {
    "start": "npm run build:renderer && electron .",
    "build:renderer": "node build.js",
    "build:renderer:watch": "node build.js --watch",
    "dev": "npm run build:renderer && electron .",
    "package": "npm run build:renderer && electron-builder --dir",
    "build": "npm run build:renderer && electron-builder --config electron-builder.yml --publish never",
    "build:mac": "npm run build:renderer && electron-builder --mac --x64 --publish never",
    "build:win": "npm run build:renderer && electron-builder --win --x64 --publish never",
    "postinstall": "electron-builder install-app-deps"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.56.0",
    "axios": "^1.10.0",
    "dotenv": "^16.6.1",
    "electron": "^30.5.1",
    "electron-store": "^8.2.0",
    "express": "^4.18.2",
    "livekit-client": "^2.0.0",
    "livekit-server-sdk": "^2.0.0",
    "openai": "^4.70.0",
    "uuid": "^9.0.1",
    "ws": "^8.14.2"
  },
  "devDependencies": {
    "electron-builder": "^26.0.12",
    "esbuild": "^0.25.5",
    "fs-extra": "^11.1.1"
  },
  "build": {
    "appId": "com.voiceoverlay.app",
    "productName": "Voice Overlay",
    "directories": {
      "output": "dist",
      "buildResources": "build"
    },
    "files": [
      "src/**/*",
      "node_modules/**/*",
      "package.json",
      "!src/agent/venv/**"
    ],
    "extraResources": [
      {
        "from": "assets/",
        "to": "assets/",
        "filter": ["**/*"]
      }
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ],
      "icon": "build/icon.icns",
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "hardenedRuntime": true,
      "gatekeeperAssess": false
    },
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.ico"
    }
  }
}
```

## 1.3 Create Build Script with Asset Handling

Create `build.js`:
```javascript
#!/usr/bin/env node

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs-extra');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [
    'src/renderer/index.js',
    'src/renderer/livekit-client.js'
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
    '.css': 'css'
  },
  external: ['electron', 'livekit-client'],
  plugins: [
    {
      name: 'copy-assets',
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length === 0) {
            // Ensure dist directory exists
            await fs.ensureDir('dist/renderer');
            
            // Copy HTML and CSS files
            const filesToCopy = [
              { src: 'src/renderer/index.html', dest: 'dist/renderer/index.html' },
              { src: 'src/renderer/styles.css', dest: 'dist/renderer/styles.css' },
              { src: 'src/renderer/preload.js', dest: 'dist/renderer/preload.js' }
            ];
            
            for (const file of filesToCopy) {
              if (await fs.pathExists(file.src)) {
                await fs.copy(file.src, file.dest);
                console.log(`📄 Copied ${file.src} -> ${file.dest}`);
              }
            }
            
            // Copy assets directory if it exists
            if (await fs.pathExists('src/renderer/assets')) {
              await fs.copy('src/renderer/assets', 'dist/renderer/assets');
              console.log('📁 Copied assets directory');
            }
            
            console.log('✅ Build complete');
          }
        });
      }
    }
  ]
};

async function build() {
  try {
    console.log('🔨 Building renderer...');
    
    // Clean dist directory first
    await fs.emptyDir('dist/renderer');
    
    if (isWatch) {
      console.log('👀 Watching for changes...');
      const context = await esbuild.context(buildOptions);
      await context.watch();
      console.log('🔄 Watching for file changes... Press Ctrl+C to stop.');
    } else {
      await esbuild.build(buildOptions);
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run build
build();
```

## 1.4 Environment Configuration

Create `.env` file:
```bash
# LiveKit Configuration
LIVEKIT_URL=wss://your-server.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# OpenAI Configuration
OPENAI_API_KEY=your_openai_key

# ElevenLabs Configuration
ELEVEN_API_KEY=your_elevenlabs_key

# App Configuration
NODE_ENV=development
DEBUG=true
```

Create `.env.example`:
```bash
# Copy this file to .env and fill in your values

# LiveKit Configuration
LIVEKIT_URL=wss://your-server.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# OpenAI Configuration
OPENAI_API_KEY=

# ElevenLabs Configuration
ELEVEN_API_KEY=

# App Configuration
NODE_ENV=development
DEBUG=false
```

## 1.5 macOS Entitlements for Permissions

Create `build/entitlements.mac.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.device.camera</key>
    <true/>
    <key>com.apple.security.personal-information.addressbook</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
</dict>
</plist>
```

## 1.6 TypeScript Configuration (Optional but Recommended)

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "allowJs": true,
    "checkJs": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "src/agent/venv"
  ]
}
```

## 1.7 Python Environment Setup

Create `src/agent/requirements.txt`:
```
livekit==0.2.25
livekit-agents==0.10.4
livekit-plugins-openai==0.9.1
livekit-plugins-elevenlabs==0.7.5
livekit-plugins-silero==0.6.5
python-dotenv==1.0.0
aiohttp==3.11.10
asyncio==3.4.3
```

Create setup script `src/agent/setup.sh`:
```bash
#!/bin/bash

echo "🐍 Setting up Python environment..."

# Check Python version
python_version=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
major=$(echo $python_version | cut -d. -f1)
minor=$(echo $python_version | cut -d. -f2)

if [ "$major" -lt 3 ] || ([ "$major" -eq 3 ] && [ "$minor" -lt 8 ]); then
    echo "❌ Python 3.8+ is required. Current version: $python_version"
    exit 1
fi

echo "✅ Python $python_version detected"

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📦 Installing requirements..."
pip install -r requirements.txt

echo "✅ Python environment setup complete!"
echo ""
echo "To activate the environment manually, run:"
echo "  cd src/agent && source venv/bin/activate"
```

Make it executable:
```bash
chmod +x src/agent/setup.sh
```

## 1.8 Git Configuration

Create `.gitignore`:
```gitignore
# Dependencies
node_modules/
src/agent/venv/
__pycache__/
*.pyc

# Build outputs
dist/
build/
*.dmg
*.exe
*.app
*.AppImage
*.deb
*.rpm

# Environment files
.env
.env.local
.env.*.local

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Electron
electron-builder.yml
!electron-builder.example.yml

# Testing
coverage/
.nyc_output/

# Temporary files
*.tmp
.temp/
```

## 1.9 Install Dependencies

```bash
# Install Node dependencies
npm install

# Set up Python environment
cd src/agent
./setup.sh
cd ../..
```

## 1.10 Verify Installation

Create a test script `verify-setup.js`:
```javascript
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🔍 Verifying Voice Overlay Setup...\n');

// Check Node version
const nodeVersion = process.version;
console.log(`✅ Node.js ${nodeVersion}`);

// Check required directories
const requiredDirs = [
  'src/main',
  'src/main/services',
  'src/renderer',
  'src/agent',
  'assets',
  'build'
];

console.log('\n📁 Checking directories:');
requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`  ✅ ${dir}`);
  } else {
    console.log(`  ❌ ${dir} - Missing`);
  }
});

// Check required files
const requiredFiles = [
  'package.json',
  'build.js',
  '.env.example',
  'src/agent/requirements.txt'
];

console.log('\n📄 Checking files:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - Missing`);
  }
});

// Check Python
console.log('\n🐍 Checking Python:');
const pythonCheck = spawn('python3', ['--version']);
pythonCheck.stdout.on('data', (data) => {
  console.log(`  ✅ ${data.toString().trim()}`);
});
pythonCheck.stderr.on('data', (data) => {
  console.log(`  ✅ ${data.toString().trim()}`);
});

pythonCheck.on('error', () => {
  console.log('  ❌ Python 3 not found');
});

pythonCheck.on('close', () => {
  // Check npm packages
  console.log('\n📦 Key npm packages:');
  try {
    const pkg = require('./package.json');
    const keyPackages = ['electron', 'livekit-client', 'livekit-server-sdk', 'electron-store'];
    keyPackages.forEach(name => {
      if (pkg.dependencies[name] || pkg.devDependencies[name]) {
        const version = pkg.dependencies[name] || pkg.devDependencies[name];
        console.log(`  ✅ ${name}: ${version}`);
      } else {
        console.log(`  ❌ ${name}: Not found`);
      }
    });
  } catch (e) {
    console.log('  ❌ Could not read package.json');
  }
  
  console.log('\n✨ Setup verification complete!');
});
```

Run verification:
```bash
node verify-setup.js
```

## 1.11 Create Initial README

Create `README.md`:
```markdown
# Voice Overlay

A simplified voice-focused desktop overlay with MCP integration.

## Features
- 🎤 Voice interaction via LiveKit and OpenAI Realtime API
- 🤖 MCP server integration for AppleScript and tools
- 🪟 Compact, single-window design
- 🎨 Clean, non-transparent UI

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   cd src/agent && ./setup.sh
   ```

2. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Add your API keys

3. **Run development:**
   ```bash
   npm run dev
   ```

## Building

- **macOS:** `npm run build:mac`
- **Windows:** `npm run build:win`
- **All platforms:** `npm run build`

## Project Structure
```
voice-overlay/
├── src/
│   ├── main/          # Main process
│   ├── renderer/      # UI
│   └── agent/         # Python voice agent
├── assets/            # Icons and resources
└── build/            # Build configuration
```
```

## Common Issues and Solutions

### Issue 1: Electron not starting
```bash
# Clear electron cache
rm -rf ~/Library/Caches/electron
npm install electron@30.5.1 --save-dev
```

### Issue 2: Python packages not installing
```bash
# Use pip directly
cd src/agent
source venv/bin/activate
pip install --no-cache-dir -r requirements.txt
```

### Issue 3: Build failing
```bash
# Clean and rebuild
rm -rf dist node_modules package-lock.json
npm install
npm run build:renderer
```

## Next Steps

With Phase 1 complete, you now have:
- ✅ Complete project structure
- ✅ All dependencies configured
- ✅ Build system ready
- ✅ Python environment prepared
- ✅ macOS permissions configured

Proceed to Phase 2 to implement the main process and core services.