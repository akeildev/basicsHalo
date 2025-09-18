# Phase 4: Python Voice Agent Implementation - Detailed Implementation

## 4.1 Main Voice Agent with MCP Integration

Create `src/agent/voice_agent.py`:
```python
#!/usr/bin/env python3
"""
Voice Agent for Voice Overlay with MCP Integration
Integrates OpenAI Realtime (STT/LLM), ElevenLabs (TTS), and MCP tools
"""

import asyncio
import logging
import os
import json
import pathlib
from typing import Optional, Dict, Any
from datetime import datetime

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
    RunContext,
)
from livekit.agents.voice import AgentSession
from livekit.plugins import openai, elevenlabs, silero
from openai.types.beta.realtime.session import InputAudioTranscription

# Import MCP components
from mcp_router import McpToolRouter, ToolSpec
from mcp_utils import (
    VoiceInteractionHelper,
    ToolResultSummarizer,
    ToolProposalParser,
    ToolProposal
)
from mcp_logger import MCPErrorLogger, setup_mcp_logging

# Configure logging
setup_mcp_logging()
logger = logging.getLogger("voice-agent")
logger.setLevel(logging.INFO)


class VoiceAgent:
    """Main voice agent class with MCP integration"""
    
    def __init__(self):
        self.session: Optional[AgentSession] = None
        self.context: Optional[JobContext] = None
        self.room_name: Optional[str] = None
        
        # MCP components
        self.mcp_router: Optional[McpToolRouter] = None
        self.voice_helper: Optional[VoiceInteractionHelper] = None
        self.result_summarizer: Optional[ToolResultSummarizer] = None
        self.proposal_parser: Optional[ToolProposalParser] = None
        self.error_logger = MCPErrorLogger('voice-agent')
        
        # Configuration paths
        self.mcp_config_path = pathlib.Path(__file__).parent / "mcp.config.json"
        
        logger.info("Voice Agent initialized")
    
    async def entrypoint(self, ctx: JobContext):
        """Main entry point for the agent"""
        try:
            self.context = ctx
            self.room_name = ctx.room.name
            
            logger.info(f"Starting agent for room: {self.room_name}")
            logger.info(f"Job metadata: {ctx.job.metadata}")
            
            # Initialize MCP components
            await self._initialize_mcp()
            
            # Connect to room
            await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
            logger.info(f"Connected to room: {self.room_name}")
            
            # Get participant
            participant = await self._wait_for_participant()
            if not participant:
                logger.error("No participant joined within timeout")
                return
            
            logger.info(f"Participant joined: {participant.identity}")
            
            # Create agent with instructions and tools
            from livekit.agents import Agent
            
            agent = Agent(
                instructions=self._get_system_instructions(),
                tools=self._get_tools()
            )
            
            # Create voice session
            self.session = AgentSession(
                llm=openai.realtime.RealtimeModel(
                    model="gpt-4o-realtime-preview",
                    modalities=["text"],
                    temperature=0.7,
                    max_tokens=4096,
                    input_audio_transcription=InputAudioTranscription(
                        model="whisper-1",
                        language="en",
                    ),
                ),
                tts=elevenlabs.TTS(
                    voice_id=os.getenv("ELEVEN_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
                    model_id=os.getenv("ELEVEN_MODEL_ID", "eleven_turbo_v2_5"),
                    api_key=os.getenv("ELEVEN_API_KEY"),
                    sample_rate=24000,
                ),
                vad=silero.VAD.load(
                    min_silence_duration=0.5,
                    min_speech_duration=0.3,
                    activation_threshold=0.25
                ),
                agent=agent,
                chat_ctx=llm.ChatContext(),
                transcription=openai.realtime.RealtimeTranscription(),
            )
            
            # Start the session
            self.session.start(ctx.room, participant)
            logger.info("Voice session started")
            
            # Wait for session to complete
            await self.session.wait_for_completion()
            
        except Exception as e:
            logger.error(f"Agent error: {e}", exc_info=True)
            self.error_logger.log_error(e, "agent_entrypoint")
        finally:
            await self._cleanup()
    
    async def _initialize_mcp(self):
        """Initialize MCP router and utilities"""
        try:
            if not self.mcp_config_path.exists():
                logger.warning(f"MCP config not found at {self.mcp_config_path}")
                logger.info("Creating default MCP configuration...")
                self._create_default_mcp_config()
            
            # Initialize router
            self.mcp_router = McpToolRouter(str(self.mcp_config_path))
            await self.mcp_router.initialize()
            
            # Initialize helpers
            self.voice_helper = VoiceInteractionHelper()
            self.result_summarizer = ToolResultSummarizer()
            self.proposal_parser = ToolProposalParser()
            
            logger.info(f"MCP initialized with {len(self.mcp_router.tools)} tools")
            
        except Exception as e:
            logger.error(f"Failed to initialize MCP: {e}")
            self.error_logger.log_error(e, "mcp_initialization")
    
    def _create_default_mcp_config(self):
        """Create default MCP configuration file"""
        default_config = {
            "servers": {
                "applescript": {
                    "transport": "stdio",
                    "command": "npx",
                    "args": ["-y", "@johnlindquist/mcp-server-applescript"],
                    "env": {},
                    "timeout": 30.0,
                    "sensitive_tools": []
                }
            }
        }
        
        with open(self.mcp_config_path, 'w') as f:
            json.dump(default_config, f, indent=2)
        
        logger.info(f"Created default MCP config at {self.mcp_config_path}")
    
    async def _wait_for_participant(self, timeout: float = 30.0):
        """Wait for a participant to join the room"""
        start_time = asyncio.get_event_loop().time()
        
        while asyncio.get_event_loop().time() - start_time < timeout:
            if self.context.room.remote_participants:
                return next(iter(self.context.room.remote_participants.values()))
            await asyncio.sleep(0.5)
        
        return None
    
    def _get_system_instructions(self) -> str:
        """Get system instructions for the agent"""
        return """You are a helpful voice assistant with access to various tools through MCP (Model Context Protocol).

Key capabilities:
- You can control applications via AppleScript
- You can access and modify files
- You can search the web and fetch information
- You can execute various system commands

Guidelines:
1. Be conversational and natural in your responses
2. When using tools, briefly explain what you're doing
3. If a tool fails, explain the issue and suggest alternatives
4. Always confirm before performing destructive actions
5. Keep responses concise for voice interaction

Remember: You're having a voice conversation, so keep responses brief and clear."""
    
    def _get_tools(self) -> list:
        """Get list of tools for the agent"""
        tools = []
        
        # Add MCP tool executor
        if self.mcp_router:
            tools.append(self.execute_mcp_tool)
        
        # Add other tools as needed
        tools.append(self.get_current_time)
        
        return tools
    
    @llm.ai_callable(
        description="Execute an MCP tool with the given parameters"
    )
    async def execute_mcp_tool(
        self,
        tool_name: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Execute an MCP tool
        
        Args:
            tool_name: Name of the tool to execute
            parameters: Parameters for the tool
        
        Returns:
            Tool execution result as a string
        """
        try:
            if not self.mcp_router:
                return "MCP router not initialized"
            
            logger.info(f"Executing MCP tool: {tool_name} with params: {parameters}")
            
            # Execute the tool
            result = await self.mcp_router.execute_tool(
                tool_name,
                parameters or {}
            )
            
            # Summarize result for voice
            if self.result_summarizer:
                summary = await self.result_summarizer.summarize_for_voice(
                    tool_name,
                    result
                )
                return summary
            
            return json.dumps(result, indent=2)
            
        except Exception as e:
            error_msg = f"Failed to execute {tool_name}: {str(e)}"
            logger.error(error_msg)
            self.error_logger.log_error(e, f"execute_mcp_tool:{tool_name}")
            return error_msg
    
    @llm.ai_callable(
        description="Get the current date and time"
    )
    async def get_current_time(self) -> str:
        """Get current date and time"""
        now = datetime.now()
        return now.strftime("%A, %B %d, %Y at %I:%M %p")
    
    async def _cleanup(self):
        """Clean up resources"""
        try:
            if self.mcp_router:
                await self.mcp_router.shutdown()
            
            if self.session:
                await self.session.aclose()
            
            logger.info("Agent cleanup completed")
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")


async def main():
    """Main function to run the agent"""
    # Get configuration from environment
    livekit_url = os.getenv("LIVEKIT_URL", "")
    api_key = os.getenv("LIVEKIT_API_KEY", "")
    api_secret = os.getenv("LIVEKIT_API_SECRET", "")
    
    if not all([livekit_url, api_key, api_secret]):
        logger.error("Missing required LiveKit configuration")
        return
    
    # Create agent instance
    agent = VoiceAgent()
    
    # Run with LiveKit CLI
    await cli.run_app(
        WorkerOptions(
            entrypoint_fnc=agent.entrypoint,
            api_key=api_key,
            api_secret=api_secret,
            ws_url=livekit_url,
            logger=logger
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
```

## 4.2 MCP Router Implementation

Create `src/agent/mcp_router.py`:
```python
"""
MCP Router - Manages connections to multiple MCP servers
"""

import asyncio
import json
import os
import uuid
import time
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Any, Union

logger = logging.getLogger("mcp-router")


@dataclass
class ToolSpec:
    """Specification for a tool exposed by an MCP server"""
    server_id: str
    name: str
    description: str
    schema: dict
    sensitive: bool = False


class JSONRPCHelper:
    """Helper for JSONRPC protocol formatting"""
    
    @staticmethod
    def request(method: str, params: dict = None) -> str:
        """Create a JSONRPC request"""
        return json.dumps({
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": method,
            "params": params or {}
        }) + "\n"
    
    @staticmethod
    def parse_response(data: str) -> dict:
        """Parse JSONRPC response"""
        try:
            resp = json.loads(data)
            if "error" in resp:
                raise RuntimeError(f"RPC Error: {resp['error']}")
            return resp.get("result", {})
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Invalid JSON response: {e}")


class StdioTransport:
    """Stdio transport for local MCP servers"""
    
    def __init__(self, server_id: str, command: str, args: List[str], env: Dict[str, str]):
        self.server_id = server_id
        self.command = command
        self.args = args
        self.env = env
        self.proc: Optional[asyncio.subprocess.Process] = None
        self._lock = asyncio.Lock()
    
    async def start(self):
        """Start the stdio process"""
        logger.info(f"Starting stdio server {self.server_id}: {self.command} {' '.join(self.args)}")
        
        try:
            self.proc = await asyncio.create_subprocess_exec(
                self.command, *self.args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ, **self.env}
            )
            
            # Wait a moment for the process to start
            await asyncio.sleep(0.5)
            
            # Check if process is still running
            if self.proc.returncode is not None:
                stderr = await self.proc.stderr.read() if self.proc.stderr else b""
                raise RuntimeError(f"Process exited immediately: {stderr.decode('utf-8')}")
            
            logger.info(f"Started {self.server_id} successfully")
            
        except Exception as e:
            logger.error(f"Failed to start {self.server_id}: {e}")
            raise
    
    async def call(self, method: str, params: dict, timeout: float = 30.0) -> dict:
        """Make an RPC call over stdio"""
        async with self._lock:
            if not self.proc or not self.proc.stdin or not self.proc.stdout:
                raise RuntimeError(f"Server {self.server_id} not started")
            
            request = JSONRPCHelper.request(method, params)
            
            try:
                self.proc.stdin.write(request.encode("utf-8"))
                await self.proc.stdin.drain()
                
                line = await asyncio.wait_for(
                    self.proc.stdout.readline(),
                    timeout=timeout
                )
                
                if not line:
                    raise RuntimeError(f"Server {self.server_id} closed unexpectedly")
                
                return JSONRPCHelper.parse_response(line.decode("utf-8"))
                
            except asyncio.TimeoutError:
                raise TimeoutError(f"Timeout calling {method} on {self.server_id}")
            except Exception as e:
                logger.error(f"Error calling {method} on {self.server_id}: {e}")
                raise
    
    async def close(self):
        """Close the stdio process"""
        if self.proc:
            try:
                self.proc.terminate()
                await asyncio.wait_for(self.proc.wait(), timeout=5)
            except asyncio.TimeoutError:
                self.proc.kill()
                await self.proc.wait()
            except Exception as e:
                logger.error(f"Error closing {self.server_id}: {e}")


class McpToolRouter:
    """Main router for managing multiple MCP servers"""
    
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.config = {}
        self.servers: Dict[str, Union[StdioTransport]] = {}
        self.tools: Dict[str, ToolSpec] = {}
        self._initialized = False
    
    async def initialize(self):
        """Initialize the router and start all servers"""
        if self._initialized:
            return
        
        try:
            # Load configuration
            self._load_config()
            
            # Start all servers
            for server_id, server_config in self.config.get("servers", {}).items():
                await self._start_server(server_id, server_config)
            
            # Discover tools from all servers
            await self._discover_tools()
            
            self._initialized = True
            logger.info(f"MCP Router initialized with {len(self.tools)} tools")
            
        except Exception as e:
            logger.error(f"Failed to initialize MCP router: {e}")
            raise
    
    def _load_config(self):
        """Load configuration from file"""
        try:
            with open(self.config_path, 'r') as f:
                self.config = json.load(f)
            logger.info(f"Loaded config from {self.config_path}")
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            raise
    
    async def _start_server(self, server_id: str, config: dict):
        """Start a single MCP server"""
        try:
            transport_type = config.get("transport", "stdio")
            
            if transport_type == "stdio":
                transport = StdioTransport(
                    server_id,
                    config["command"],
                    config.get("args", []),
                    config.get("env", {})
                )
                await transport.start()
                self.servers[server_id] = transport
                
            else:
                raise ValueError(f"Unsupported transport: {transport_type}")
            
            logger.info(f"Started server: {server_id}")
            
        except Exception as e:
            logger.error(f"Failed to start server {server_id}: {e}")
            # Continue with other servers
    
    async def _discover_tools(self):
        """Discover available tools from all servers"""
        for server_id, server in self.servers.items():
            try:
                # Initialize the server
                await server.call("initialize", {
                    "capabilities": {}
                })
                
                # List available tools
                result = await server.call("tools/list", {})
                tools = result.get("tools", [])
                
                # Register each tool
                for tool in tools:
                    tool_name = tool["name"]
                    full_name = f"{server_id}.{tool_name}" if len(self.servers) > 1 else tool_name
                    
                    self.tools[full_name] = ToolSpec(
                        server_id=server_id,
                        name=tool_name,
                        description=tool.get("description", ""),
                        schema=tool.get("inputSchema", {}),
                        sensitive=tool_name in self.config.get("servers", {}).get(server_id, {}).get("sensitive_tools", [])
                    )
                
                logger.info(f"Discovered {len(tools)} tools from {server_id}")
                
            except Exception as e:
                logger.error(f"Failed to discover tools from {server_id}: {e}")
    
    async def execute_tool(self, tool_name: str, parameters: dict) -> dict:
        """Execute a tool on the appropriate server"""
        # Find the tool
        tool_spec = self.tools.get(tool_name)
        if not tool_spec:
            # Try with server prefix
            for full_name, spec in self.tools.items():
                if spec.name == tool_name or full_name == tool_name:
                    tool_spec = spec
                    break
        
        if not tool_spec:
            raise ValueError(f"Tool not found: {tool_name}")
        
        # Get the server
        server = self.servers.get(tool_spec.server_id)
        if not server:
            raise RuntimeError(f"Server not available: {tool_spec.server_id}")
        
        # Execute the tool
        try:
            logger.info(f"Executing {tool_name} on {tool_spec.server_id}")
            
            result = await server.call("tools/call", {
                "name": tool_spec.name,
                "arguments": parameters
            })
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to execute {tool_name}: {e}")
            raise
    
    def list_tools(self) -> List[Dict[str, Any]]:
        """List all available tools"""
        return [
            {
                "name": name,
                "description": spec.description,
                "server": spec.server_id,
                "sensitive": spec.sensitive
            }
            for name, spec in self.tools.items()
        ]
    
    async def shutdown(self):
        """Shutdown all servers"""
        for server_id, server in self.servers.items():
            try:
                await server.close()
                logger.info(f"Closed server: {server_id}")
            except Exception as e:
                logger.error(f"Error closing {server_id}: {e}")
        
        self.servers.clear()
        self.tools.clear()
        self._initialized = False
```

## 4.3 MCP Utilities

Create `src/agent/mcp_utils.py`:
```python
"""
MCP Utilities for Voice Interaction
"""

import json
import re
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

logger = logging.getLogger("mcp-utils")


@dataclass
class ToolProposal:
    """Represents a proposed tool execution"""
    tool_name: str
    parameters: Dict[str, Any]
    description: str
    requires_confirmation: bool = False


class VoiceInteractionHelper:
    """Helper for voice-friendly interactions"""
    
    def format_for_speech(self, text: str) -> str:
        """Format text to be more speech-friendly"""
        # Remove URLs
        text = re.sub(r'https?://\S+', 'a web link', text)
        
        # Replace technical symbols
        text = text.replace('_', ' ')
        text = text.replace('-', ' ')
        text = text.replace('/', ' slash ')
        text = text.replace('\\', ' backslash ')
        
        # Simplify paths
        text = re.sub(r'/Users/\w+/', 'your home folder/', text)
        text = re.sub(r'C:\\Users\\\w+\\', 'your user folder\\', text)
        
        # Limit length for voice
        if len(text) > 500:
            text = text[:497] + "..."
        
        return text
    
    def parse_voice_command(self, transcript: str) -> Dict[str, Any]:
        """Parse voice command for tool execution hints"""
        command_lower = transcript.lower()
        
        hints = {
            "action": None,
            "target": None,
            "parameters": {}
        }
        
        # Detect common actions
        if any(word in command_lower for word in ["open", "launch", "start"]):
            hints["action"] = "open"
        elif any(word in command_lower for word in ["close", "quit", "exit"]):
            hints["action"] = "close"
        elif any(word in command_lower for word in ["search", "find", "look for"]):
            hints["action"] = "search"
        elif any(word in command_lower for word in ["create", "make", "new"]):
            hints["action"] = "create"
        elif any(word in command_lower for word in ["delete", "remove"]):
            hints["action"] = "delete"
        
        # Extract potential app names
        app_keywords = ["safari", "chrome", "firefox", "mail", "calendar", "notes", 
                       "terminal", "finder", "music", "spotify", "slack", "discord"]
        for app in app_keywords:
            if app in command_lower:
                hints["target"] = app
                break
        
        return hints


class ToolResultSummarizer:
    """Summarizes tool results for voice output"""
    
    async def summarize_for_voice(self, tool_name: str, result: Any) -> str:
        """Create a voice-friendly summary of tool results"""
        try:
            if isinstance(result, dict):
                if "error" in result:
                    return f"The {tool_name} encountered an error: {result['error']}"
                
                if "content" in result:
                    content = str(result["content"])
                    if len(content) > 200:
                        return f"The {tool_name} completed successfully. {content[:200]}..."
                    return f"The {tool_name} completed. {content}"
                
                if "success" in result:
                    if result["success"]:
                        return f"The {tool_name} completed successfully."
                    else:
                        reason = result.get("reason", "unknown reason")
                        return f"The {tool_name} failed: {reason}"
            
            elif isinstance(result, list):
                count = len(result)
                if count == 0:
                    return f"The {tool_name} returned no results."
                elif count == 1:
                    return f"The {tool_name} found one result."
                else:
                    return f"The {tool_name} found {count} results."
            
            elif isinstance(result, str):
                if len(result) > 200:
                    return f"{result[:200]}..."
                return result
            
            elif result is None:
                return f"The {tool_name} completed."
            
            else:
                return f"The {tool_name} returned: {str(result)[:200]}"
                
        except Exception as e:
            logger.error(f"Error summarizing result: {e}")
            return f"The {tool_name} completed with results."


class ToolProposalParser:
    """Parses natural language into tool proposals"""
    
    def parse(self, text: str, available_tools: List[str]) -> Optional[ToolProposal]:
        """Parse text to identify tool execution intent"""
        text_lower = text.lower()
        
        # AppleScript patterns
        if "open" in text_lower and any(app in text_lower for app in ["safari", "chrome", "mail"]):
            app_match = re.search(r"open\s+(\w+)", text_lower)
            if app_match:
                return ToolProposal(
                    tool_name="open_application",
                    parameters={"app_name": app_match.group(1).title()},
                    description=f"Opening {app_match.group(1).title()}",
                    requires_confirmation=False
                )
        
        # File operations
        if "create" in text_lower and "file" in text_lower:
            return ToolProposal(
                tool_name="create_file",
                parameters={},
                description="Creating a new file",
                requires_confirmation=True
            )
        
        return None


class MCPErrorHandler:
    """Handles and formats MCP errors for voice"""
    
    def format_error(self, error: Exception, context: str) -> str:
        """Format error message for voice output"""
        error_type = type(error).__name__
        
        if isinstance(error, TimeoutError):
            return "The operation took too long to complete. Please try again."
        elif isinstance(error, ConnectionError):
            return "I'm having trouble connecting to the service. Please check your connection."
        elif isinstance(error, PermissionError):
            return "I don't have permission to perform that action."
        elif isinstance(error, FileNotFoundError):
            return "I couldn't find the requested file or application."
        else:
            logger.error(f"MCP Error in {context}: {error}")
            return "I encountered an error while processing that request."
```

## 4.4 MCP Logger

Create `src/agent/mcp_logger.py`:
```python
"""
MCP Logger - Enhanced logging for MCP operations
"""

import logging
import json
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

# Configure logging format
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_mcp_logging(log_level=logging.INFO, log_file: Optional[str] = None):
    """Setup logging configuration for MCP"""
    handlers = [logging.StreamHandler()]
    
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file))
    
    logging.basicConfig(
        level=log_level,
        format=LOG_FORMAT,
        datefmt=LOG_DATE_FORMAT,
        handlers=handlers
    )


class MCPErrorLogger:
    """Specialized error logger for MCP operations"""
    
    def __init__(self, component: str):
        self.component = component
        self.logger = logging.getLogger(component)
        self.error_log_path = Path.home() / ".voice-overlay" / "errors" / f"{component}_errors.json"
        self.error_log_path.parent.mkdir(parents=True, exist_ok=True)
    
    def log_error(self, error: Exception, operation: str, details: Dict[str, Any] = None):
        """Log an error with full context"""
        error_record = {
            "timestamp": datetime.now().isoformat(),
            "component": self.component,
            "operation": operation,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "traceback": traceback.format_exc(),
            "details": details or {}
        }
        
        # Log to standard logger
        self.logger.error(f"{operation} failed: {error}")
        
        # Save to error log file
        try:
            # Read existing errors
            errors = []
            if self.error_log_path.exists():
                with open(self.error_log_path, 'r') as f:
                    errors = json.load(f)
            
            # Add new error
            errors.append(error_record)
            
            # Keep only last 100 errors
            if len(errors) > 100:
                errors = errors[-100:]
            
            # Write back
            with open(self.error_log_path, 'w') as f:
                json.dump(errors, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Failed to write error log: {e}")
    
    def get_recent_errors(self, count: int = 10) -> list:
        """Get recent errors"""
        try:
            if self.error_log_path.exists():
                with open(self.error_log_path, 'r') as f:
                    errors = json.load(f)
                    return errors[-count:]
        except Exception as e:
            self.logger.error(f"Failed to read error log: {e}")
        
        return []


def log_mcp_startup(servers: Dict[str, Any]):
    """Log MCP startup information"""
    logger = logging.getLogger("mcp-startup")
    logger.info("=" * 60)
    logger.info("MCP STARTUP")
    logger.info("=" * 60)
    
    for server_id, config in servers.items():
        logger.info(f"Server: {server_id}")
        logger.info(f"  Transport: {config.get('transport', 'stdio')}")
        logger.info(f"  Command: {config.get('command', 'N/A')}")
        logger.info(f"  Args: {config.get('args', [])}")
    
    logger.info("=" * 60)


def log_mcp_shutdown():
    """Log MCP shutdown"""
    logger = logging.getLogger("mcp-shutdown")
    logger.info("=" * 60)
    logger.info("MCP SHUTDOWN")
    logger.info("=" * 60)
```

## 4.5 MCP Configuration File

Create `src/agent/mcp.config.json`:
```json
{
  "servers": {
    "applescript": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@johnlindquist/mcp-server-applescript"],
      "env": {},
      "timeout": 30.0,
      "sensitive_tools": [],
      "description": "Control macOS applications via AppleScript"
    },
    "filesystem": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users"],
      "env": {},
      "timeout": 30.0,
      "sensitive_tools": ["write_file", "delete_file"],
      "description": "Access and modify files on the filesystem"
    },
    "web-search": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-websearch"],
      "env": {},
      "timeout": 60.0,
      "sensitive_tools": [],
      "description": "Search the web for information"
    }
  },
  "settings": {
    "require_confirmation": true,
    "log_level": "INFO",
    "max_retries": 3,
    "retry_delay": 1.0
  }
}
```

## 4.6 Test Script for Python Agent

Create `src/agent/test_agent.py`:
```python
#!/usr/bin/env python3
"""
Test script for Voice Agent components
"""

import asyncio
import os
import sys
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from mcp_router import McpToolRouter
from mcp_utils import VoiceInteractionHelper, ToolResultSummarizer
from mcp_logger import setup_mcp_logging

# Setup logging
setup_mcp_logging(logging.DEBUG)
logger = logging.getLogger("test-agent")


async def test_mcp_router():
    """Test MCP router initialization and tool discovery"""
    logger.info("Testing MCP Router...")
    
    config_path = Path(__file__).parent / "mcp.config.json"
    
    if not config_path.exists():
        logger.error(f"Config file not found: {config_path}")
        return False
    
    try:
        router = McpToolRouter(str(config_path))
        await router.initialize()
        
        tools = router.list_tools()
        logger.info(f"Discovered {len(tools)} tools:")
        for tool in tools:
            logger.info(f"  - {tool['name']}: {tool['description']}")
        
        # Test a simple tool if available
        if tools and "get_running_apps" in [t["name"] for t in tools]:
            logger.info("Testing get_running_apps tool...")
            result = await router.execute_tool("get_running_apps", {})
            logger.info(f"Result: {result}")
        
        await router.shutdown()
        return True
        
    except Exception as e:
        logger.error(f"Router test failed: {e}")
        return False


async def test_voice_utils():
    """Test voice utility functions"""
    logger.info("Testing Voice Utilities...")
    
    helper = VoiceInteractionHelper()
    summarizer = ToolResultSummarizer()
    
    # Test speech formatting
    text = "Check https://example.com/path_to_file.txt in /Users/john/Documents"
    formatted = helper.format_for_speech(text)
    logger.info(f"Original: {text}")
    logger.info(f"Formatted: {formatted}")
    
    # Test command parsing
    commands = [
        "Open Safari",
        "Search for Python tutorials",
        "Create a new file",
        "Close the terminal"
    ]
    
    for cmd in commands:
        hints = helper.parse_voice_command(cmd)
        logger.info(f"Command: {cmd}")
        logger.info(f"  Hints: {hints}")
    
    # Test result summarization
    results = [
        {"success": True, "content": "File created successfully"},
        {"error": "Permission denied"},
        ["item1", "item2", "item3"],
        "Simple string result",
        None
    ]
    
    for result in results:
        summary = await summarizer.summarize_for_voice("test_tool", result)
        logger.info(f"Result: {result}")
        logger.info(f"  Summary: {summary}")
    
    return True


async def main():
    """Run all tests"""
    logger.info("=" * 60)
    logger.info("VOICE AGENT TEST SUITE")
    logger.info("=" * 60)
    
    # Test MCP Router
    router_ok = await test_mcp_router()
    
    # Test Voice Utils
    utils_ok = await test_voice_utils()
    
    logger.info("=" * 60)
    logger.info("TEST RESULTS")
    logger.info(f"  MCP Router: {'✅ PASS' if router_ok else '❌ FAIL'}")
    logger.info(f"  Voice Utils: {'✅ PASS' if utils_ok else '❌ FAIL'}")
    logger.info("=" * 60)
    
    return router_ok and utils_ok


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
```

## 4.7 Running the Agent

Create `src/agent/run.sh`:
```bash
#!/bin/bash

# Activate virtual environment
source venv/bin/activate

# Set environment variables
export LIVEKIT_URL="${LIVEKIT_URL}"
export LIVEKIT_API_KEY="${LIVEKIT_API_KEY}"
export LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET}"
export OPENAI_API_KEY="${OPENAI_API_KEY}"
export ELEVEN_API_KEY="${ELEVEN_API_KEY}"
export ELEVEN_VOICE_ID="${ELEVEN_VOICE_ID:-21m00Tcm4TlvDq8ikWAM}"
export ELEVEN_MODEL_ID="${ELEVEN_MODEL_ID:-eleven_turbo_v2_5}"
export PYTHONUNBUFFERED=1

# Run the agent
echo "Starting Voice Agent..."
python3 voice_agent.py
```

Make executable:
```bash
chmod +x src/agent/run.sh
```

## Common Issues and Solutions

### Issue 1: MCP server not starting
```python
# Add retry logic
async def start_with_retry(transport, max_retries=3):
    for i in range(max_retries):
        try:
            await transport.start()
            return
        except Exception as e:
            if i < max_retries - 1:
                await asyncio.sleep(1)
            else:
                raise
```

### Issue 2: Tool execution timeout
```python
# Increase timeout for specific tools
if tool_name in ["web_search", "large_file_operation"]:
    timeout = 60.0  # Longer timeout
else:
    timeout = 30.0  # Default timeout
```

### Issue 3: Voice recognition issues
```python
# Add fallback for unclear commands
if confidence < 0.7:
    return "I didn't quite catch that. Could you please repeat?"
```

## Testing the Complete System

1. **Test MCP components:**
```bash
cd src/agent
python3 test_agent.py
```

2. **Test voice agent standalone:**
```bash
cd src/agent
source venv/bin/activate
python3 -c "from voice_agent import VoiceAgent; import asyncio; agent = VoiceAgent(); print('Agent initialized successfully')"
```

3. **Test with LiveKit:**
```bash
# Start the agent
cd src/agent
./run.sh

# In another terminal, check if it connects
curl http://localhost:7880/health  # If LiveKit has health endpoint
```

## Next Steps

With Phase 4 complete, you have:
- ✅ Full voice agent implementation
- ✅ MCP router for tool execution
- ✅ Voice-optimized utilities
- ✅ Error handling and logging
- ✅ AppleScript integration
- ✅ File system access
- ✅ Web search capability
- ✅ Test suite

The voice agent is ready to handle natural language commands and execute tools via MCP. The system can now:
- Process voice input via LiveKit
- Execute AppleScript commands
- Access and modify files
- Search the web
- Provide voice-friendly responses