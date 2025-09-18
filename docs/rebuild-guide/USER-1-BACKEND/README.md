# User 1: Backend Developer Guide

## Your Responsibilities
You are responsible for the backend infrastructure, main process, services, and Python voice agent. You will NOT touch any renderer/UI files.

## Your Directory Structure
```
voice-overlay/
├── src/
│   ├── main/              ← YOUR DOMAIN
│   │   ├── index.js
│   │   └── services/
│   └── agent/             ← YOUR DOMAIN
│       └── *.py
├── package.json           ← SHARED (dependencies only)
├── .env                   ← YOUR DOMAIN
└── .gitignore
```

## Week 1: Foundation Setup

### Day 1-2: Project Initialization

1. **Create project and install dependencies:**
```bash
mkdir voice-overlay
cd voice-overlay
npm init -y
```

2. **Update package.json dependencies:**
```json
{
  "name": "voice-overlay",
  "version": "0.1.0",
  "main": "src/main/index.js",
  "dependencies": {
    "dotenv": "^16.6.1",
    "electron": "^30.5.1",
    "electron-store": "^8.2.0",
    "express": "^4.18.2",
    "livekit-server-sdk": "^2.0.0",
    "uuid": "^9.0.1"
  }
}
```

3. **Create .env file:**
```bash
LIVEKIT_URL=wss://your-server.livekit.cloud
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret
OPENAI_API_KEY=your_key
ELEVEN_API_KEY=your_key
```

4. **Create initial main process** `src/main/index.js`:
```javascript
require('dotenv').config();
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 380,
        height: 500,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../renderer/preload.js')
        }
    });
    
    // For now, just load a blank page
    mainWindow.loadURL('data:text/html,<h1>Backend Ready</h1>');
}

app.whenReady().then(createWindow);

// Stub IPC handlers for User 2
ipcMain.handle('voice:start', async () => {
    console.log('[Backend] Voice start requested');
    return { 
        success: true, 
        url: 'wss://dummy.livekit.cloud',
        token: 'dummy-token',
        roomName: 'test-room'
    };
});

ipcMain.handle('voice:stop', async () => {
    console.log('[Backend] Voice stop requested');
    return { success: true };
});
```

### Day 3-4: Services Implementation

Create `src/main/services/ConfigService.js`:
[Copy complete ConfigService from DETAILED-PHASE-02.md]

Create `src/main/services/SettingsService.js`:
[Copy complete SettingsService from DETAILED-PHASE-02.md]

### Day 5: Python Environment

1. **Setup Python agent structure:**
```bash
mkdir -p src/agent
cd src/agent
python3 -m venv venv
source venv/bin/activate
```

2. **Create requirements.txt:**
```
livekit==0.2.25
livekit-agents==0.10.4
livekit-plugins-openai==0.9.1
livekit-plugins-elevenlabs==0.7.5
livekit-plugins-silero==0.6.5
python-dotenv==1.0.0
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

### 📍 CHECKPOINT 1 DELIVERABLES (End of Week 1)
- [ ] Electron app launches
- [ ] All IPC handlers return mock data
- [ ] Settings service works
- [ ] Python environment ready
- [ ] Can run: `npm start` without errors

## Week 2: LiveKit Integration

### Day 1-2: LiveKit Backend Service

Create `src/main/services/LiveKitService.js`:
[Copy complete LiveKitService from DETAILED-PHASE-02.md]

Update `src/main/index.js` to use real LiveKit service:
```javascript
const LiveKitService = require('./services/LiveKitService');
const SettingsService = require('./services/SettingsService');

const settings = new SettingsService();
const livekit = new LiveKitService(settings);

// Replace stub with real implementation
ipcMain.handle('voice:start', async () => {
    return await livekit.startSession();
});

ipcMain.handle('voice:stop', async () => {
    return await livekit.stopSession();
});
```

### Day 3-5: Python Voice Agent

Create `src/agent/voice_agent.py`:
[Copy complete voice_agent.py from DETAILED-PHASE-04.md]

Create stub MCP files:
- `src/agent/mcp_router.py` (basic version)
- `src/agent/mcp_utils.py` 
- `src/agent/mcp_logger.py`

### 📍 CHECKPOINT 2 DELIVERABLES (End of Week 2)
- [ ] LiveKit tokens generate correctly
- [ ] Python agent starts when session begins
- [ ] Agent connects to LiveKit room
- [ ] Voice pipeline works (without MCP)
- [ ] Backend responds with real connection details

## Week 3: MCP & Polish

### Day 1-3: MCP Implementation

Complete MCP router implementation:
[Copy complete mcp_router.py from DETAILED-PHASE-04.md]

Create `src/agent/mcp.config.json`:
```json
{
  "servers": {
    "applescript": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@johnlindquist/mcp-server-applescript"],
      "env": {},
      "timeout": 30.0
    }
  }
}
```

### Day 4-5: Error Handling & Logging

Add comprehensive error handling to all services:
```javascript
class LiveKitService {
    async startSession() {
        try {
            // ... existing code
        } catch (error) {
            logger.error('Session start failed:', error);
            return { 
                success: false, 
                error: error.message,
                code: error.code || 'UNKNOWN'
            };
        }
    }
}
```

### 📍 CHECKPOINT 3 DELIVERABLES (End of Week 3)
- [ ] All MCP tools work
- [ ] Error handling complete
- [ ] Logging system functional
- [ ] Settings persist correctly
- [ ] Python agent fully functional

## Testing Your Backend

### Unit Tests
```bash
# Test services individually
node -e "const ConfigService = require('./src/main/services/ConfigService'); const c = new ConfigService(); c.initialize(); console.log('Config OK');"

# Test Python agent
cd src/agent
python3 -c "from voice_agent import VoiceAgent; print('Agent imports OK')"
```

### Integration Test Script
Create `test-backend.js`:
```javascript
const { spawn } = require('child_process');

// Test Electron startup
const electron = spawn('npx', ['electron', 'src/main/index.js']);

electron.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
});

electron.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
});

setTimeout(() => {
    electron.kill();
    console.log('Backend test complete');
}, 5000);
```

## Your Git Workflow

```bash
# Initial setup
git checkout -b backend-dev

# Daily work
git add src/main/ src/agent/ .env
git commit -m "Backend: [feature description]"
git push origin backend-dev

# At checkpoints
git checkout main
git pull origin main
git checkout backend-dev
git merge main  # Get any updates
git push origin backend-dev
```

## Communication with User 2

### What User 2 Needs From You:
1. **IPC Channel names** (share immediately)
2. **Response formats** for each IPC call
3. **Any changes to package.json**
4. **When backend services are ready for testing**

### What You Need From User 2:
1. **Preload script location** (for main process)
2. **Any specific UI state requirements**
3. **Testing feedback on IPC responses**

## Checkpoint Merge Preparation

Before each checkpoint:
1. Ensure all your code runs without errors
2. Document any API changes
3. Update your test scripts
4. Remove any debug console.logs
5. Commit and push everything

## Troubleshooting

### Common Issues:
1. **Port conflicts**: LiveKit or Express using same port
2. **Python path issues**: Use absolute paths in spawn
3. **Token generation fails**: Check API keys in .env
4. **IPC timeout**: Increase timeout in handlers

### Debug Commands:
```bash
# Check if Python agent can start
LIVEKIT_URL=test python3 src/agent/voice_agent.py

# Test LiveKit connection
node -e "const { AccessToken } = require('livekit-server-sdk'); console.log('LiveKit SDK OK');"

# Verify environment variables
node -e "require('dotenv').config(); console.log(process.env);"
```

## Final Integration (Week 4)

You will work with User 2 to:
1. Test complete voice flow
2. Fix any integration issues
3. Optimize performance
4. Write documentation

Remember: You own the backend. Make it robust, well-tested, and well-documented!