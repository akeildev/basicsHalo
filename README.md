# Halo by Basics - AI Desktop Assistant

<div align="center">
  <img src="assets/logo.png" alt="Halo Logo" width="200"/>

  [![License](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0)
  [![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org)
  [![Python](https://img.shields.io/badge/python-%3E%3D3.9-blue.svg)](https://python.org)
  [![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/clueless/clueless)

  **An intelligent real-time AI desktop assistant with voice and screen capture capabilities**

  [Website](https://clueless.app) | [Documentation](docs/) | [Issues](https://github.com/clueless/clueless/issues)
</div>

## 🌟 Features

- **🎙️ Real-time Voice AI**: Natural conversations powered by OpenAI Realtime API with GPT-4o
- **🗣️ High-Quality TTS**: ElevenLabs text-to-speech for natural voice responses
- **🎧 Advanced Voice Detection**: Silero VAD for accurate voice activity detection
- **📸 Screen Understanding**: AI-powered screen capture analysis with context awareness
- **🔧 MCP Integration**: Model Context Protocol support for extensible tool capabilities
- **💬 Real-time Chat**: Interactive chat interface with streaming responses
- **🔒 Privacy-First**: Local processing with secure API key management
- **🖥️ Cross-Platform**: Works on macOS, Windows, and Linux
- **⚡ LiveKit Infrastructure**: Enterprise-grade WebRTC for low-latency voice communication

## 🚀 Getting Started

### Prerequisites

Before installing Halo, ensure you have:

#### Core Requirements
- **Node.js** v18.0.0 or higher ([Download](https://nodejs.org/))
- **npm** v8.0.0 or higher (comes with Node.js)
- **Python** v3.9 or higher ([Download](https://python.org/))
- **Git** ([Download](https://git-scm.com/))

#### Required API Keys for Voice Features
- **[OpenAI API Key](https://platform.openai.com/)** - Required for GPT-4o Realtime API (voice conversations)
- **[ElevenLabs API Key](https://elevenlabs.io/)** - Required for high-quality text-to-speech
- **[LiveKit Cloud](https://cloud.livekit.io/)** - Free tier available for WebRTC infrastructure

#### Optional API Keys (for additional features)
- [Anthropic API Key](https://console.anthropic.com/) - For Claude AI in chat mode
- [Google AI API Key](https://makersuite.google.com/app/apikey) - For Gemini AI in chat mode

### 📦 Installation from GitHub

```bash
# Clone the repository
git clone https://github.com/clueless/clueless.git

# Navigate to the project directory
cd clueless

# Install Node.js dependencies
npm install

# Build the renderer
npm run build:renderer

# Set up Python environment for voice agent
cd src/agent
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ../..

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
# Required for Voice Agent
OPENAI_API_KEY=your_openai_api_key_here           # GPT-4o Realtime API
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here   # Text-to-speech

# LiveKit Configuration (get free account at https://cloud.livekit.io)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# Optional for Chat Features
ANTHROPIC_API_KEY=your_anthropic_api_key_here     # Claude AI
GOOGLE_AI_API_KEY=your_google_ai_api_key_here     # Gemini AI
```

**Important Notes:**
- The voice agent uses OpenAI's GPT-4o Realtime API which handles both speech recognition and AI responses
- ElevenLabs provides natural-sounding voice output
- LiveKit Cloud free tier includes 10,000 monthly minutes
- MCP (Model Context Protocol) support allows extensible tool integration

3. **First Launch Setup**:
   - On first launch, Halo will request necessary system permissions
   - **macOS**: Grant Screen Recording and Microphone access in System Settings
   - **Windows**: Allow microphone access when prompted
   - **Linux**: May require additional permissions depending on your distribution

## 💻 Usage

### Starting the Application

```bash
# Start the Electron app
npm start

# In a separate terminal, start the voice agent
cd src/agent
./start_agent.sh  # On Windows: python run_agent.py
```

### How the Voice Agent Works

The voice agent (`src/agent/voice_agent_with_mcp.py`) implements a real-time conversation system:

1. **Audio Streaming**: LiveKit WebRTC handles bidirectional audio between the Electron app and Python agent
2. **Speech Processing**: OpenAI's GPT-4o Realtime API converts speech to text and generates AI responses
3. **Voice Output**: ElevenLabs TTS creates natural-sounding speech from the AI's text responses
4. **Turn Detection**: Silero VAD intelligently detects when you start/stop speaking
5. **Tool Execution**: MCP integration enables the AI to take screenshots, read files, and more

The Python agent runs separately from the Electron app and communicates via LiveKit's infrastructure.

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

**Voice Agent Not Starting:**
```bash
# Check Python version (must be 3.9+)
python3 --version

# Reinstall voice agent dependencies
cd src/agent
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Check API keys are set
echo $OPENAI_API_KEY
echo $ELEVENLABS_API_KEY
```

**LiveKit Connection Issues:**
- Ensure LiveKit credentials in `.env` match your LiveKit Cloud project
- Check firewall isn't blocking WebRTC connections (UDP ports 50000-60000)
- Try using a different LiveKit server region if latency is high

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
- OpenAI API key must have access to GPT-4o Realtime (check your OpenAI account)
- ElevenLabs requires an active subscription for API access
- LiveKit free tier provides 10,000 minutes/month

### Getting Help

- Check [existing issues](https://github.com/clueless/clueless/issues)
- Join our [Discord community](https://discord.gg/clueless)
- Read the [documentation](docs/)
- Contact support at support@clueless.app

## 📄 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Electron](https://www.electronjs.org/) - Cross-platform desktop framework
- [OpenAI](https://openai.com/) - GPT-4o Realtime API for voice conversations
- [ElevenLabs](https://elevenlabs.io/) - Natural text-to-speech voices
- [LiveKit](https://livekit.io/) - WebRTC infrastructure for real-time voice
- [Silero](https://github.com/snakers4/silero-vad) - Voice activity detection
- [MCP](https://modelcontextprotocol.io/) - Model Context Protocol for tool integration
- [Anthropic](https://www.anthropic.com/) - Claude AI models (chat mode)
- [Google AI](https://ai.google/) - Gemini models (chat mode)

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