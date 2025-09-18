# Complete Rebuild Guide: Voice-Focused Desktop Overlay with MCP

## Project Overview

Building a simplified voice-focused desktop overlay that:
- Single, compact window (no header, ask, or settings windows)
- Voice interaction via LiveKit and OpenAI Realtime API
- MCP server integration for AppleScript and other tools
- Standard window appearance (no transparency/invisibility)
- Simplified UI with voice controls

## Phase 1: Project Setup and Foundation

### 1.1 Initialize Project
```bash
mkdir voice-overlay
cd voice-overlay
npm init -y
```

### 1.2 Install Core Dependencies
```json
{
  "dependencies": {
    "electron": "^30.5.1",
    "electron-store": "^8.2.0",
    "livekit-client": "^2.0.0",
    "livekit-server-sdk": "^2.0.0",
    "@anthropic-ai/sdk": "^0.56.0",
    "openai": "^4.70.0",
    "uuid": "^9.0.1",
    "dotenv": "^16.6.1"
  },
  "devDependencies": {
    "esbuild": "^0.25.5"
  }
}
```

### 1.3 Project Structure
```
voice-overlay/
├── src/
│   ├── main/
│   │   ├── index.js           # Main process entry
│   │   ├── window.js          # Window management
│   │   ├── config.js          # Configuration store
│   │   └── services/
│   │       ├── livekit.js     # LiveKit service
│   │       └── mcp.js         # MCP integration
│   ├── renderer/
│   │   ├── index.html         # UI HTML
│   │   ├── styles.css         # Styling
│   │   ├── index.js           # Renderer logic
│   │   ├── preload.js         # Preload script
│   │   └── livekit-client.js  # LiveKit client
│   └── agent/
│       ├── voice_agent.py     # Python voice agent
│       ├── mcp_router.py      # MCP tool router
│       └── mcp.config.json    # MCP configuration
├── assets/
│   └── icons/
├── package.json
└── .env
```

## Phase 2: Main Process Implementation

### 2.1 Main Entry Point (`src/main/index.js`)
```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const ConfigService = require('./config');
const LiveKitService = require('./services/livekit');
const MCPService = require('./services/mcp');

let mainWindow;
const config = new ConfigService();
const livekit = new LiveKitService(config);
const mcp = new MCPService();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 380,
        height: 500,
        frame: true,
        transparent: false,
        resizable: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../renderer/preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
    createWindow();
    setupIPCHandlers();
});

function setupIPCHandlers() {
    ipcMain.handle('start-voice', async () => {
        return await livekit.startSession();
    });
    
    ipcMain.handle('stop-voice', async () => {
        return await livekit.stopSession();
    });
    
    ipcMain.handle('mute-toggle', async (event, muted) => {
        return { success: true, muted };
    });
}
```

### 2.2 Configuration Service (`src/main/config.js`)
```javascript
const Store = require('electron-store');

class ConfigService {
    constructor() {
        this.store = new Store({ name: 'voice-overlay-config' });
        this.setDefaults();
    }
    
    setDefaults() {
        const defaults = {
            openaiApiKey: '',
            livekitUrl: 'wss://your-livekit-server.livekit.cloud',
            livekitApiKey: '',
            livekitApiSecret: '',
            elevenLabsApiKey: ''
        };
        
        Object.entries(defaults).forEach(([key, value]) => {
            if (!this.store.has(key)) {
                this.store.set(key, value);
            }
        });
    }
    
    get(key) {
        return this.store.get(key);
    }
    
    set(key, value) {
        this.store.set(key, value);
    }
}

module.exports = ConfigService;
```

## Phase 3: LiveKit Integration

### 3.1 LiveKit Service (`src/main/services/livekit.js`)
```javascript
const { AccessToken } = require('livekit-server-sdk');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class LiveKitService {
    constructor(config) {
        this.config = config;
        this.agentProcess = null;
        this.currentRoom = null;
    }
    
    async generateToken(roomName, participantName = 'user') {
        const token = new AccessToken(
            this.config.get('livekitApiKey'),
            this.config.get('livekitApiSecret'),
            {
                identity: participantName,
                ttl: '10h'
            }
        );
        
        token.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true
        });
        
        return await token.toJwt();
    }
    
    async startSession() {
        try {
            this.currentRoom = `voice-room-${uuidv4()}`;
            const token = await this.generateToken(this.currentRoom);
            
            // Start Python agent
            await this.startAgent();
            
            return {
                success: true,
                url: this.config.get('livekitUrl'),
                token,
                roomName: this.currentRoom
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async startAgent() {
        const agentPath = path.join(__dirname, '../../agent/voice_agent.py');
        
        this.agentProcess = spawn('python3', [agentPath], {
            env: {
                ...process.env,
                LIVEKIT_URL: this.config.get('livekitUrl'),
                LIVEKIT_API_KEY: this.config.get('livekitApiKey'),
                LIVEKIT_API_SECRET: this.config.get('livekitApiSecret'),
                OPENAI_API_KEY: this.config.get('openaiApiKey'),
                ELEVEN_API_KEY: this.config.get('elevenLabsApiKey'),
                ROOM_NAME: this.currentRoom
            }
        });
        
        this.agentProcess.stdout.on('data', (data) => {
            console.log('[Agent]:', data.toString());
        });
    }
    
    async stopSession() {
        if (this.agentProcess) {
            this.agentProcess.kill();
            this.agentProcess = null;
        }
        this.currentRoom = null;
        return { success: true };
    }
}

module.exports = LiveKitService;
```

## Phase 4: Renderer Implementation

### 4.1 HTML Interface (`src/renderer/index.html`)
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Voice Assistant</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <!-- Status indicator -->
        <div class="status-bar">
            <div class="status-indicator" id="statusIndicator"></div>
            <span class="status-text" id="statusText">Ready</span>
        </div>
        
        <!-- Chat messages -->
        <div class="messages" id="messages"></div>
        
        <!-- Controls -->
        <div class="controls">
            <button class="voice-btn" id="voiceBtn">
                <svg class="mic-icon" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
                <span>Start Voice</span>
            </button>
            <button class="mute-btn" id="muteBtn">
                <svg viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                </svg>
            </button>
        </div>
    </div>
    <script src="index.js"></script>
</body>
</html>
```

### 4.2 Renderer JavaScript (`src/renderer/index.js`)
```javascript
class VoiceOverlay {
    constructor() {
        this.isActive = false;
        this.isMuted = false;
        this.livekitClient = null;
        
        this.initElements();
        this.setupListeners();
    }
    
    initElements() {
        this.voiceBtn = document.getElementById('voiceBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.statusText = document.getElementById('statusText');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.messages = document.getElementById('messages');
    }
    
    setupListeners() {
        this.voiceBtn.addEventListener('click', () => this.toggleVoice());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        
        // IPC listeners
        window.api.onVoiceEvent((event, data) => {
            this.handleVoiceEvent(event, data);
        });
    }
    
    async toggleVoice() {
        if (this.isActive) {
            await this.stopVoice();
        } else {
            await this.startVoice();
        }
    }
    
    async startVoice() {
        this.setStatus('Connecting...');
        const result = await window.api.startVoice();
        
        if (result.success) {
            // Connect LiveKit client
            await this.connectLiveKit(result);
            this.isActive = true;
            this.updateUI();
            this.setStatus('Connected');
        } else {
            this.setStatus('Failed to connect');
        }
    }
    
    async connectLiveKit(config) {
        const { LiveKitClient } = await import('./livekit-client.js');
        this.livekitClient = new LiveKitClient();
        await this.livekitClient.connect(config.url, config.token);
    }
    
    async stopVoice() {
        if (this.livekitClient) {
            await this.livekitClient.disconnect();
        }
        await window.api.stopVoice();
        this.isActive = false;
        this.updateUI();
        this.setStatus('Disconnected');
    }
    
    updateUI() {
        if (this.isActive) {
            this.voiceBtn.classList.add('active');
            this.statusIndicator.classList.add('active');
        } else {
            this.voiceBtn.classList.remove('active');
            this.statusIndicator.classList.remove('active');
        }
    }
    
    addMessage(type, text) {
        const msg = document.createElement('div');
        msg.className = `message ${type}`;
        msg.textContent = text;
        this.messages.appendChild(msg);
        this.messages.scrollTop = this.messages.scrollHeight;
    }
    
    setStatus(text) {
        this.statusText.textContent = text;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new VoiceOverlay();
});
```

## Phase 5: Python Voice Agent

### 5.1 Voice Agent (`src/agent/voice_agent.py`)
```python
#!/usr/bin/env python3
import asyncio
import os
import logging
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    Agent
)
from livekit.agents.voice import AgentSession
from livekit.plugins import openai, elevenlabs, silero
from mcp_router import McpToolRouter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-agent")

class VoiceAgent:
    def __init__(self):
        self.mcp_router = None
        
    async def entrypoint(self, ctx: JobContext):
        # Initialize MCP router
        self.mcp_router = McpToolRouter()
        await self.mcp_router.initialize()
        
        # Connect to room
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        
        # Create agent with tools
        agent = Agent(
            instructions="You are a helpful voice assistant.",
            tools=[self.execute_mcp_tool]
        )
        
        # Create voice session
        session = AgentSession(
            llm=openai.realtime.RealtimeModel(
                model="gpt-4o-realtime-preview",
                modalities=["text"],
            ),
            tts=elevenlabs.TTS(
                voice_id="21m00Tcm4TlvDq8ikWAM",
                model_id="eleven_turbo_v2_5"
            ),
            vad=silero.VAD.load(),
            agent=agent
        )
        
        # Start session
        session.start(ctx.room)
        await session.wait_for_completion()
    
    async def execute_mcp_tool(self, tool_name: str, **params):
        """Execute MCP tool"""
        return await self.mcp_router.execute(tool_name, params)

if __name__ == "__main__":
    agent = VoiceAgent()
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=agent.entrypoint,
            api_key=os.environ["LIVEKIT_API_KEY"],
            api_secret=os.environ["LIVEKIT_API_SECRET"],
            ws_url=os.environ["LIVEKIT_URL"]
        )
    )
```

## Phase 6: MCP Integration

### 6.1 MCP Router (`src/agent/mcp_router.py`)
```python
import asyncio
import json
import subprocess
from typing import Dict, Any

class McpToolRouter:
    def __init__(self):
        self.servers = {}
        self.config = self.load_config()
    
    def load_config(self):
        with open('mcp.config.json', 'r') as f:
            return json.load(f)
    
    async def initialize(self):
        """Initialize MCP servers"""
        for name, config in self.config['servers'].items():
            await self.start_server(name, config)
    
    async def start_server(self, name: str, config: Dict):
        """Start an MCP server"""
        cmd = config['command']
        args = config.get('args', [])
        
        process = await asyncio.create_subprocess_exec(
            cmd, *args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        self.servers[name] = {
            'process': process,
            'config': config
        }
    
    async def execute(self, tool_name: str, params: Dict[str, Any]):
        """Execute a tool via MCP"""
        # Find which server handles this tool
        server_name = self.find_server_for_tool(tool_name)
        if not server_name:
            return {"error": f"No server found for tool {tool_name}"}
        
        server = self.servers[server_name]
        
        # Send request to MCP server
        request = {
            "jsonrpc": "2.0",
            "method": "tools/execute",
            "params": {
                "name": tool_name,
                "arguments": params
            },
            "id": 1
        }
        
        server['process'].stdin.write(json.dumps(request).encode() + b'\n')
        await server['process'].stdin.drain()
        
        # Read response
        response_line = await server['process'].stdout.readline()
        response = json.loads(response_line.decode())
        
        return response.get('result', {})
    
    def find_server_for_tool(self, tool_name: str) -> str:
        """Find which server provides a tool"""
        for name, config in self.config['servers'].items():
            if tool_name in config.get('tools', []):
                return name
        return None
```

### 6.2 MCP Configuration (`src/agent/mcp.config.json`)
```json
{
  "servers": {
    "applescript": {
      "command": "npx",
      "args": ["-y", "@johnlindquist/mcp-server-applescript"],
      "tools": [
        "run_applescript",
        "get_running_apps",
        "open_application",
        "close_application"
      ]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users"],
      "tools": [
        "read_file",
        "write_file",
        "list_directory"
      ]
    }
  }
}
```

## Phase 7: Styling

### 7.1 CSS Styles (`src/renderer/styles.css`)
```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f5f5f5;
    color: #333;
    height: 100vh;
    overflow: hidden;
}

.container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 16px;
}

.status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
}

.status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #999;
    transition: background 0.3s;
}

.status-indicator.active {
    background: #4CAF50;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.messages {
    flex: 1;
    overflow-y: auto;
    background: white;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
}

.message {
    padding: 8px 12px;
    margin-bottom: 8px;
    border-radius: 6px;
    animation: slideIn 0.3s;
}

.message.user {
    background: #e3f2fd;
    margin-left: 20%;
}

.message.assistant {
    background: #f5f5f5;
    margin-right: 20%;
}

.controls {
    display: flex;
    gap: 8px;
}

.voice-btn {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 8px;
    background: #2196F3;
    color: white;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.3s;
}

.voice-btn:hover {
    background: #1976D2;
}

.voice-btn.active {
    background: #f44336;
}

.mute-btn {
    width: 48px;
    height: 48px;
    border: none;
    border-radius: 8px;
    background: #fff;
    border: 1px solid #ddd;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.mute-btn.muted {
    background: #ffebee;
}

svg {
    width: 20px;
    height: 20px;
}
```

## Phase 8: Build and Package

### 8.1 Build Script (`build.js`)
```javascript
const esbuild = require('esbuild');
const path = require('path');

async function build() {
    // Build renderer
    await esbuild.build({
        entryPoints: ['src/renderer/index.js'],
        bundle: true,
        outfile: 'dist/renderer/index.js',
        platform: 'browser',
        target: 'es2020'
    });
    
    // Build preload
    await esbuild.build({
        entryPoints: ['src/renderer/preload.js'],
        bundle: true,
        outfile: 'dist/renderer/preload.js',
        platform: 'node',
        target: 'node18',
        external: ['electron']
    });
    
    console.log('Build complete!');
}

build().catch(console.error);
```

### 8.2 Package.json Scripts
```json
{
  "scripts": {
    "start": "electron src/main/index.js",
    "build": "node build.js",
    "dev": "npm run build && npm start"
  }
}
```

## Phase 9: Configuration Files

### 9.1 Environment Variables (`.env`)
```
LIVEKIT_URL=wss://your-server.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
OPENAI_API_KEY=your_openai_key
ELEVEN_API_KEY=your_elevenlabs_key
```

### 9.2 Preload Script (`src/renderer/preload.js`)
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    startVoice: () => ipcRenderer.invoke('start-voice'),
    stopVoice: () => ipcRenderer.invoke('stop-voice'),
    muteToggle: (muted) => ipcRenderer.invoke('mute-toggle', muted),
    onVoiceEvent: (callback) => {
        ipcRenderer.on('voice-event', callback);
    }
});
```

## Phase 10: Testing and Deployment

### 10.1 Test Checklist
- [ ] Window launches correctly
- [ ] Voice button starts/stops session
- [ ] LiveKit connection established
- [ ] Python agent starts and connects
- [ ] Voice input/output working
- [ ] MCP tools execute properly
- [ ] Mute functionality works
- [ ] Messages display correctly

### 10.2 Run Instructions
1. Install dependencies: `npm install`
2. Set up Python environment:
   ```bash
   cd src/agent
   python3 -m venv venv
   source venv/bin/activate
   pip install livekit-agents livekit-plugins-openai livekit-plugins-elevenlabs livekit-plugins-silero
   ```
3. Configure API keys in `.env`
4. Build: `npm run build`
5. Start: `npm start`

### 10.3 Packaging for Distribution
```bash
npm install --save-dev electron-builder
npm run build
npx electron-builder --mac  # or --win, --linux
```

## Key Differences from Original

1. **Single Window**: No header, ask, or settings windows
2. **Simplified UI**: Compact, non-transparent design
3. **Configuration**: File-based instead of settings window
4. **Voice-First**: LiveKit/OpenAI Realtime at the core
5. **MCP Integration**: Built-in from the start
6. **Python Agent**: Simplified, focused on voice + MCP

## Troubleshooting

### Common Issues:
1. **LiveKit Connection Failed**: Check API keys and server URL
2. **Python Agent Not Starting**: Verify Python 3.8+ and dependencies
3. **MCP Tools Not Working**: Check mcp.config.json paths
4. **No Audio**: Check microphone permissions

This rebuild creates a focused, efficient voice assistant overlay that maintains the core functionality while removing unnecessary complexity.