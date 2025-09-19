# Halo by Basics - AI Desktop Assistant

<div align="center">
  <img src="assets/logo.png" alt="Halo Logo" width="200"/>

  [![License](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0)
  [![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org)
  [![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/clueless/clueless)

  **An intelligent real-time AI desktop assistant with voice and screen capture capabilities**

  [Website](https://clueless.app) | [Documentation](docs/) | [Issues](https://github.com/clueless/clueless/issues)
</div>

## 🌟 Features

- **🎙️ Voice Interaction**: Natural voice commands with real-time AI responses using Deepgram and LiveKit
- **📸 Screen Capture**: Intelligent screen capture and analysis with contextual understanding
- **🤖 Multiple AI Models**: Support for Anthropic Claude, Google Gemini, and OpenAI GPT models
- **💬 Real-time Chat**: Interactive chat interface with streaming responses
- **🔒 Privacy-First**: Local processing with secure API key management
- **🖥️ Cross-Platform**: Works on macOS, Windows, and Linux
- **⚡ Real-time Processing**: Live audio transcription and immediate AI responses
- **🎨 Modern UI**: Clean, intuitive interface built with Electron

## 🚀 Getting Started

### Prerequisites

Before installing Halo, ensure you have:

- **Node.js** v18.0.0 or higher ([Download](https://nodejs.org/))
- **npm** v8.0.0 or higher (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- **API Keys** for AI services you want to use:
  - [Anthropic API Key](https://console.anthropic.com/) (for Claude)
  - [Google AI API Key](https://makersuite.google.com/app/apikey) (for Gemini)
  - [OpenAI API Key](https://platform.openai.com/) (for GPT)
  - [Deepgram API Key](https://console.deepgram.com/) (for voice transcription)

### 📦 Installation from GitHub

#### Option 1: Quick Install (Recommended)

```bash
# Clone the repository
git clone https://github.com/clueless/clueless.git

# Navigate to the project directory
cd clueless

# Run the automated setup (installs dependencies and starts the app)
npm run setup
```

#### Option 2: Manual Installation

```bash
# Clone the repository
git clone https://github.com/clueless/clueless.git

# Navigate to the project directory
cd clueless

# Install dependencies
npm install

# Build the renderer
npm run build:renderer

# Start the application
npm start
```

### 🔧 Configuration

1. **Environment Variables**: Create a `.env` file in the root directory:

```bash
# Copy the example environment file
cp .env.example .env
```

2. **Edit the `.env` file** with your API keys:

```env
# AI Model API Keys
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Voice Services
DEEPGRAM_API_KEY=your_deepgram_api_key_here
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here
LIVEKIT_URL=wss://your-livekit-server.com

# Optional: Firebase Configuration (for cloud sync)
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
FIREBASE_APP_ID=your_firebase_app_id
```

3. **First Launch Setup**:
   - On first launch, Halo will request necessary system permissions
   - **macOS**: Grant Screen Recording and Microphone access in System Settings
   - **Windows**: Allow microphone access when prompted
   - **Linux**: May require additional permissions depending on your distribution

## 💻 Usage

### Starting the Application

```bash
# Development mode with hot reload
npm start

# Build for production
npm run build

# Package for distribution
npm run package
```

### Key Features & Shortcuts

- **⌘/Ctrl + Space**: Toggle Halo window
- **⌘/Ctrl + Shift + S**: Take screenshot and analyze
- **⌘/Ctrl + M**: Toggle microphone
- **⌘/Ctrl + ,**: Open settings
- **Esc**: Hide window

### Voice Commands

Simply speak naturally to Halo:
- "Take a screenshot and describe what you see"
- "Help me understand this code"
- "What's on my screen?"
- "Explain this error message"

### Screen Capture Mode

1. Click the camera icon or use the shortcut
2. Select the area you want to capture
3. Halo will analyze and provide context about the captured content

## 🛠️ Development

### Project Structure

```
clueless/
├── src/                    # Source code
│   ├── index.js           # Main Electron process
│   ├── agent/             # AI agent implementations
│   ├── services/          # Core services (AI, audio, capture)
│   ├── renderer/          # Frontend UI code
│   ├── window/            # Window management
│   └── utils/             # Utility functions
├── docs/                   # Documentation
├── scripts/               # Build and test scripts
├── test-*.js              # Test files
├── package.json           # Project configuration
└── .env                   # Environment variables
```

### Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run tests
npm run test:screen-capture        # Screen capture tests
npm run test:ask:all              # All integration tests

# Linting
npm run lint

# Build commands
npm run build:renderer            # Build renderer only
npm run build:web                 # Build web components
npm run build:all                 # Build everything
npm run build:win                 # Build for Windows

# Platform-specific builds
npm run build                     # Build for current platform
npm run publish                   # Build and publish to GitHub
```

### Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm run test:ask:all

# Run specific test suites
npm run test:screen-capture:permissions    # Permission tests
npm run test:screen-capture:capture       # Capture functionality
npm run test:screen-capture:audio         # Audio processing
npm run test:screen-capture:integration   # Integration tests
```

## 📦 Building & Distribution

### Build for Your Platform

```bash
# macOS
npm run build

# Windows
npm run build:win

# Linux
npm run build
```

Built applications will be in the `dist/` directory.

### Creating Installers

```bash
# Create installer for current platform
npm run package

# The installer will be in dist/
# - macOS: .dmg and .zip files
# - Windows: .exe installer and portable
# - Linux: .AppImage, .deb, and .rpm
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR
- Keep commits atomic and descriptive

## 🐛 Troubleshooting

### Common Issues

**Permission Denied on macOS:**
- Go to System Settings → Privacy & Security
- Grant Screen Recording and Microphone permissions to Halo

**Microphone Not Working:**
```bash
# Reset audio permissions (macOS)
tccutil reset Microphone com.halo.app
```

**Build Failures:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build:all
```

**API Key Issues:**
- Ensure all required API keys are properly set in `.env`
- Check that API keys have necessary permissions enabled
- Verify API usage limits haven't been exceeded

### Getting Help

- Check [existing issues](https://github.com/clueless/clueless/issues)
- Join our [Discord community](https://discord.gg/clueless)
- Read the [documentation](docs/)
- Contact support at support@clueless.app

## 📄 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Electron](https://www.electronjs.org/) - Cross-platform desktop framework
- [Anthropic](https://www.anthropic.com/) - Claude AI models
- [Google AI](https://ai.google/) - Gemini models
- [OpenAI](https://openai.com/) - GPT models
- [Deepgram](https://deepgram.com/) - Voice transcription
- [LiveKit](https://livekit.io/) - Real-time voice infrastructure

## 📊 System Requirements

### Minimum Requirements
- **OS**: macOS 11+, Windows 10+, Ubuntu 20.04+
- **RAM**: 4GB
- **Storage**: 500MB available space
- **Internet**: Required for AI features

### Recommended
- **RAM**: 8GB or more
- **Processor**: Multi-core processor
- **Internet**: Stable broadband connection

## 🔗 Links

- [Website](https://clueless.app)
- [GitHub Repository](https://github.com/clueless/clueless)
- [Issue Tracker](https://github.com/clueless/clueless/issues)
- [Releases](https://github.com/clueless/clueless/releases)

---

<div align="center">
  Made with ❤️ by the Basics Team

  Star ⭐ this repository if you find it helpful!
</div>