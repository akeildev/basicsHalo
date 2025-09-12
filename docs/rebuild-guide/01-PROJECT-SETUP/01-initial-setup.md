# Project Initial Setup - Complete Implementation Guide

## Directory Structure Creation

Create the following complete directory structure:

```bash
mkdir -p clueless
cd clueless

# Create all source directories
mkdir -p src/agent
mkdir -p src/bridge
mkdir -p src/features/ask
mkdir -p src/features/listen/services
mkdir -p src/features/settings
mkdir -p src/features/common/services
mkdir -p src/renderer/ask
mkdir -p src/renderer/header
mkdir -p src/renderer/listen
mkdir -p src/renderer/settings
mkdir -p src/renderer/splash
mkdir -p src/services
mkdir -p src/window
mkdir -p src/windows

# Create build and asset directories
mkdir -p build
mkdir -p assets
mkdir -p dist
mkdir -p scripts
mkdir -p docs/rebuild-guide

# Create Python agent directories
mkdir -p src/agent/tests
```

## Git Initialization

```bash
git init
```

## Complete .gitignore File

Create `.gitignore`:

```gitignore
# Dependencies
node_modules/
src/agent/venv/
src/agent/__pycache__/
*.pyc
*.pyo
*.pyd
.Python
*.so
*.egg
*.egg-info/
dist/
build/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.manifest
*.spec

# Environment variables
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store
Thumbs.db

# Build outputs
dist/
out/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Electron
.electron/
electron-builder.yml.backup

# Database
*.db
*.sqlite
*.sqlite3

# Temporary files
tmp/
temp/
*.tmp

# OS files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Firebase
firebase-debug.log
.firebase/
firebase-export-*

# Test coverage
coverage/
.nyc_output/

# Local settings
.claude/
*.local.json

# Build artifacts
*.dmg
*.app
*.exe
*.deb
*.rpm
*.AppImage
*.snap
*.msi

# Logs
logs/
*.log
lerna-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity
```

## Node.js Version Configuration

Create `.nvmrc`:

```
18.0.0
```

## Python Version Configuration

Create `.python-version`:

```
3.13.0
```

## EditorConfig

Create `.editorconfig`:

```ini
# EditorConfig is awesome: https://EditorConfig.org

# top-most EditorConfig file
root = true

# Unix-style newlines with a newline ending every file
[*]
end_of_line = lf
insert_final_newline = true
charset = utf-8
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

# JavaScript/TypeScript files
[*.{js,jsx,ts,tsx}]
indent_size = 2
quote_type = single

# Python files
[*.py]
indent_size = 4

# Markdown files
[*.md]
trim_trailing_whitespace = false

# Package files
[package*.json]
indent_size = 2

# YAML files
[*.{yml,yaml}]
indent_size = 2

# HTML files
[*.html]
indent_size = 2

# CSS files
[*.css]
indent_size = 2
```

## VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black",
  "python.formatting.blackArgs": ["--line-length", "100"],
  "[python]": {
    "editor.formatOnSave": true,
    "editor.rulers": [100]
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[html]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[css]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "files.exclude": {
    "**/.git": true,
    "**/.DS_Store": true,
    "**/node_modules": true,
    "**/dist": true,
    "**/__pycache__": true,
    "**/venv": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/venv": true,
    "**/.git": true
  }
}
```

## VS Code Extensions Recommendations

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-python.python",
    "ms-python.vscode-pylance",
    "ms-python.black-formatter",
    "eg2.vscode-npm-script",
    "christian-kohler.npm-intellisense",
    "christian-kohler.path-intellisense",
    "formulahendry.auto-rename-tag",
    "formulahendry.auto-close-tag",
    "mikestead.dotenv",
    "pranaygp.vscode-css-peek",
    "naumovs.color-highlight",
    "oderwat.indent-rainbow"
  ]
}
```

## ESLint Configuration

Create `.eslintrc.json`:

```json
{
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": [
    "eslint:recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 2021,
    "sourceType": "module"
  },
  "rules": {
    "indent": ["error", 2],
    "linebreak-style": ["error", "unix"],
    "quotes": ["error", "single"],
    "semi": ["error", "always"],
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-console": "off",
    "no-debugger": "warn",
    "prefer-const": "error",
    "arrow-body-style": ["error", "as-needed"],
    "arrow-parens": ["error", "always"],
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-template": "error"
  },
  "globals": {
    "process": "readonly",
    "__dirname": "readonly",
    "Buffer": "readonly",
    "global": "readonly"
  }
}
```

## Prettier Configuration

Create `.prettierrc`:

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "as-needed",
  "jsxSingleQuote": false,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "jsxBracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "htmlWhitespaceSensitivity": "css",
  "embeddedLanguageFormatting": "auto"
}
```

Create `.prettierignore`:

```
node_modules/
dist/
build/
coverage/
.git/
*.min.js
*.min.css
package-lock.json
yarn.lock
*.md
```

## Environment Variables Template

Create `.env.example`:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Google AI Configuration
GOOGLE_API_KEY=your_google_api_key_here

# Deepgram Configuration
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# LiveKit Configuration
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here
LIVEKIT_URL=wss://your-livekit-server.com

# Firebase Configuration (JSON string)
FIREBASE_CONFIG={"apiKey":"","authDomain":"","projectId":"","storageBucket":"","messagingSenderId":"","appId":""}

# Optional: Portkey Configuration
PORTKEY_API_KEY=your_portkey_api_key_here

# Optional: Local Development
DEV_MODE=false
DEBUG_LEVEL=info
WEB_PORT=3000

# Optional: Database
DATABASE_PATH=./data/halo.db

# Optional: Encryption
ENCRYPTION_KEY=auto_generated_on_first_run

# Python Agent Configuration
AGENT_PORT=8765
AGENT_HOST=localhost
AGENT_LOG_LEVEL=INFO
```

## README.md Template

Create `README.md`:

```markdown
# Halo Desktop Assistant

A sophisticated AI-powered desktop assistant with voice interaction, screen capture, and real-time AI responses.

## Features

- 🎤 Voice interaction with real-time transcription
- 📸 Screen capture with AI-powered analysis
- 🤖 Multiple AI model support (GPT-4, Claude, Gemini)
- 🔒 Privacy-focused with local storage
- 🖥️ Cross-platform (macOS, Windows, Linux)

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.13+
- Git

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/clueless/clueless.git
   cd clueless
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up Python environment:
   \`\`\`bash
   cd src/agent
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cd ../..
   \`\`\`

4. Configure environment:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your API keys
   \`\`\`

5. Run the application:
   \`\`\`bash
   npm start
   \`\`\`

## Development

### Available Scripts

- `npm start` - Start development mode
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run lint` - Lint code

### Project Structure

See [docs/rebuild-guide/](docs/rebuild-guide/) for complete documentation.

## Building

### macOS
\`\`\`bash
npm run build
\`\`\`

### Windows
\`\`\`bash
npm run build:win
\`\`\`

## License

GPL-3.0

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

Open an issue on [GitHub](https://github.com/clueless/clueless/issues).
```

## CONTRIBUTING.md

Create `CONTRIBUTING.md`:

```markdown
# Contributing to Halo Desktop Assistant

## Code of Conduct

Be respectful and inclusive. We welcome contributions from everyone.

## How to Contribute

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Update documentation
6. Submit a pull request

## Development Setup

See README.md for setup instructions.

## Code Style

- JavaScript: ESLint + Prettier
- Python: Black + Pylint
- Use meaningful variable names
- Add comments for complex logic
- Keep functions small and focused

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Include integration tests when applicable

## Documentation

- Update relevant documentation
- Add JSDoc comments for JavaScript functions
- Add docstrings for Python functions
- Update README if adding features

## Pull Request Process

1. Update the README.md with details of changes
2. Update the version numbers if applicable
3. Ensure all tests pass
4. Request review from maintainers

## Reporting Issues

Use GitHub Issues with:
- Clear description
- Steps to reproduce
- Expected behavior
- Actual behavior
- System information
```

## LICENSE

Create `LICENSE`:

```
GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

[Full GPL-3.0 license text would go here - obtain from https://www.gnu.org/licenses/gpl-3.0.txt]
```

## Initial npm Setup Commands

Run these commands to initialize the project:

```bash
# Initialize npm project (this will be replaced by our package.json)
npm init -y

# Install ESLint and Prettier for development
npm install --save-dev eslint prettier eslint-config-prettier

# Create initial directory for build artifacts
mkdir -p dist

# Create placeholder files for assets
touch build/icon.icns
touch build/icon.ico
touch build/icon.png
```

## Python Virtual Environment Setup

```bash
cd src/agent
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Create requirements.txt (we'll populate this in the next document)
touch requirements.txt
```

## System Requirements Verification Script

Create `scripts/check-requirements.js`:

```javascript
#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Checking system requirements...\n');

// Check Node.js version
try {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion >= 18) {
    console.log(`✅ Node.js ${nodeVersion} (>= 18.0.0 required)`);
  } else {
    console.log(`❌ Node.js ${nodeVersion} (>= 18.0.0 required)`);
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Node.js not found');
  process.exit(1);
}

// Check Python version
try {
  const pythonVersion = execSync('python3 --version', { encoding: 'utf8' }).trim();
  const versionMatch = pythonVersion.match(/Python (\d+)\.(\d+)/);
  if (versionMatch) {
    const major = parseInt(versionMatch[1]);
    const minor = parseInt(versionMatch[2]);
    if (major === 3 && minor >= 13) {
      console.log(`✅ ${pythonVersion} (>= 3.13 required)`);
    } else {
      console.log(`⚠️  ${pythonVersion} (>= 3.13 recommended)`);
    }
  }
} catch (error) {
  console.log('❌ Python 3 not found');
  process.exit(1);
}

// Check npm version
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`✅ npm ${npmVersion}`);
} catch (error) {
  console.log('❌ npm not found');
  process.exit(1);
}

// Check git
try {
  const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
  console.log(`✅ ${gitVersion}`);
} catch (error) {
  console.log('❌ Git not found');
  process.exit(1);
}

// Check for .env file
if (fs.existsSync(path.join(process.cwd(), '.env'))) {
  console.log('✅ .env file exists');
} else {
  console.log('⚠️  .env file not found (copy from .env.example)');
}

console.log('\n✅ All requirements satisfied!');
```

Make it executable:
```bash
chmod +x scripts/check-requirements.js
```

---

This completes the initial project setup documentation with all configuration files and directory structure needed to start building the Halo Desktop Assistant.