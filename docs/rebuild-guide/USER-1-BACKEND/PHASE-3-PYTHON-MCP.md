# Phase 3: Python Agent & MCP Implementation (User 1)

## Overview
This phase implements the complete Python voice agent with MCP tool integration. You'll build the voice pipeline, MCP router, and all supporting utilities.

## File Structure for This Phase
```
voice-overlay/
├── src/
│   └── agent/
│       ├── voice_agent.py          ← Complete voice agent
│       ├── mcp_router.py           ← MCP server management
│       ├── mcp_utils.py            ← Helper utilities
│       ├── mcp_logger.py           ← Logging system
│       ├── mcp.config.json         ← MCP server configuration
│       ├── requirements.txt        ← Python dependencies
│       └── logs/                   ← Log directory
```

## Step 1: Complete Voice Agent Implementation

Create `src/agent/voice_agent.py`:

```python
#!/usr/bin/env python3
"""
LiveKit Voice Agent for Voice Overlay with MCP Integration
Integrates OpenAI Realtime (STT/LLM), ElevenLabs (TTS), Silero VAD, and MCP tools
"""

import asyncio
import logging
import os
import aiohttp
import json
import pathlib
from typing import Optional, Dict, Any
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
    function_tool,
    RunContext,
)
from livekit.agents.voice import AgentSession
from livekit.plugins import openai, elevenlabs, silero
from openai.types.beta.realtime.session import InputAudioTranscription
from openai import AsyncOpenAI

# Import MCP components
from mcp_router import McpToolRouter, ToolSpec
from mcp_utils import (
    VoiceInteractionHelper,
    ToolResultSummarizer,
    ToolProposalParser,
    ToolProposal
)
from mcp_logger import MCPErrorLogger, setup_mcp_logging

# Configure logging with MCP enhancements
setup_mcp_logging()
logger = logging.getLogger("voice-overlay-agent")
logger.setLevel(logging.INFO)


class VoiceOverlayAgent:
    """Main voice agent class for Voice Overlay assistant with MCP integration"""
    
    def __init__(self):
        self.session: Optional[AgentSession] = None
        self.context: Optional[JobContext] = None
        self.metadata: dict = {}
        self.screenshot_ws_url = "ws://127.0.0.1:8765"
        self.openai_client = AsyncOpenAI()
        self._screenshot_cache = None
        self._screenshot_cache_time = None
        
        # MCP components
        self.mcp_router: Optional[McpToolRouter] = None
        self.voice_helper: Optional[VoiceInteractionHelper] = None
        self.mcp_config_path = pathlib.Path(__file__).parent / "mcp.config.json"
        self.error_logger = MCPErrorLogger('voice-overlay-agent')
        
    async def start_agent_session(self, ctx: JobContext):
        """Initialize and start the agent session with MCP support"""
        self.context = ctx
        
        # Parse metadata from job
        self.metadata = ctx.job.metadata if ctx.job.metadata else {}
        logger.info(f"Starting agent with metadata: {self.metadata}")
        
        # Initialize MCP router
        await self._initialize_mcp()
        
        # Connect to room first
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        
        # Create agent with instructions and tools
        from livekit.agents import Agent
        
        # Combine existing tools with MCP tools
        tools = [
            self.take_screenshot,
            self.execute_mcp_tool,  # MCP tool executor
        ]
        
        agent = Agent(
            instructions=self._get_system_instructions(),
            tools=tools
        )
        
        # Create agent session with OpenAI Realtime (text-only) + ElevenLabs TTS
        self.session = AgentSession(
            llm=openai.realtime.RealtimeModel(
                model="gpt-4o-realtime-preview",
                modalities=["text"],
                input_audio_transcription=InputAudioTranscription(
                    model="whisper-1",
                    language="en",
                ),
            ),
            tts=elevenlabs.TTS(
                voice_id="ThT5KcBeYPX3keUQqHPh",  # Rachel voice
                model="eleven_turbo_v2",
                language="en",
            ),
            vad=silero.VAD.load(
                min_speech_duration=0.2,
                min_silence_duration=0.5, 
                activation_threshold=0.6,
            ),
        )
        
        # Initialize voice helper with session
        self.voice_helper = VoiceInteractionHelper(self.session)
        
        # Start the session with the agent
        await self.session.start(agent=agent, room=ctx.room)
        
        # Send initial greeting if specified
        if self.metadata.get("send_greeting", True):
            await self._send_greeting()
    
    async def _initialize_mcp(self):
        """Initialize MCP router and confirmation handler"""
        try:
            if not self.mcp_config_path.exists():
                logger.warning(f"MCP config not found at {self.mcp_config_path}")
                self.error_logger.log_connection_error("config", "file", 
                    FileNotFoundError(f"Config not found: {self.mcp_config_path}"))
                return
            
            logger.info("="*60)
            logger.info("Initializing MCP System")
            logger.info(f"Config: {self.mcp_config_path}")
            logger.info("="*60)
            
            # Create and start MCP router
            self.mcp_router = McpToolRouter(str(self.mcp_config_path))
            await self.mcp_router.start()
            logger.info(f"✓ MCP router started with {len(self.mcp_router.tools)} tools")
            
            # Log available tools
            if self.mcp_router.tools:
                logger.info("Available MCP tools:")
                for tool in self.mcp_router.tools[:10]:  # Show first 10
                    logger.info(f"  - {tool.name}: {tool.description[:50]}...")
            
            logger.info("✓ Direct execution mode enabled - tools will run immediately")
                
        except Exception as e:
            logger.error(f"Failed to initialize MCP: {e}")
            self.error_logger.log_connection_error("mcp_system", "initialization", e)
            self.mcp_router = None
    
    async def _say_wrapper(self, text: str):
        """Wrapper for TTS output - ensures text is spoken clearly"""
        if self.session:
            try:
                logger.info(f"Speaking through TTS: '{text}'")
                
                # Add a small pause before speaking for clarity
                await asyncio.sleep(0.2)
                
                # Use the session's TTS with clear instructions
                handle = await self.session.generate_reply(
                    instructions=f"Speak this message clearly to the user: '{text}'"
                )
                
                # Wait for the speech to complete
                if hasattr(handle, "wait_for_initialization"):
                    await handle.wait_for_initialization()
                
                # Add a small pause after speaking for clarity
                await asyncio.sleep(0.3)
                
                logger.info(f"Successfully spoke: '{text}'")
                
            except Exception as e:
                logger.error(f"TTS error while speaking '{text}': {e}")
                # Fallback: Try alternative TTS method
                try:
                    if hasattr(self.session, 'say'):
                        await self.session.say(text)
                        logger.info(f"Used fallback TTS for: '{text}'")
                except Exception as fallback_error:
                    logger.error(f"Fallback TTS also failed: {fallback_error}")
            
    async def _send_greeting(self):
        """Send initial greeting to user"""
        greeting = self.metadata.get(
            "greeting",
            "Hello! I'm your voice assistant. I can see your screen, help with various tasks, and execute commands. Just let me know how I can help."
        )
        
        # Add MCP tools info if available
        if self.mcp_router and self.mcp_router.tools:
            tool_count = len(self.mcp_router.tools)
            greeting += f" I have {tool_count} tools available to help with various tasks."
        
        await self._say_wrapper(greeting)
            
    def _get_system_instructions(self):
        """Get system instructions for the agent"""
        base_instructions = """You are Voice Overlay, a helpful AI assistant integrated into the user's desktop.
        Be concise, friendly, and helpful. Focus on understanding the user's needs and providing
        clear, actionable responses.
        
        You can see the user's screen when they ask about it. Use the take_screenshot tool when:
        - They ask "what's on my screen" or "can you see this"
        - They need help with something visible on their screen
        - They want you to read or analyze visual content
        - They ask about errors, UI elements, or applications they're using
        
        For system operations, use the execute_mcp_tool function with appropriate tool names.
        
        Always describe actions in natural language without mentioning tool names.
        
        After completing tasks, summarize the results conversationally."""
        
        # Add available MCP tools to instructions
        if self.mcp_router and self.mcp_router.tools:
            tool_names = [tool.name for tool in self.mcp_router.tools[:10]]
            base_instructions += f"\n\nAvailable MCP tools: {', '.join(tool_names)}"
        
        # Add any custom instructions from metadata
        custom_instructions = self.metadata.get("instructions", "")
        if custom_instructions:
            return f"{base_instructions}\n\n{custom_instructions}"
        return base_instructions
    
    @function_tool
    async def execute_mcp_tool(
        self,
        context: RunContext,
        tool_name: str,
        arguments: Optional[Dict[str, Any]] = None,
        request_screenshot_first: bool = False
    ) -> str:
        """
        Execute an MCP tool with optional screenshot context
        
        Args:
            tool_name: Name of the MCP tool to execute
            arguments: Arguments to pass to the tool
            request_screenshot_first: Whether to capture screen before execution
            
        Returns:
            Result of tool execution or error message
        """
        logger.info(f"MCP tool execution requested: {tool_name}")
        
        try:
            if not self.mcp_router:
                error_msg = "MCP tools are not available at the moment."
                logger.warning(error_msg)
                return error_msg
            
            # Capture screenshot if requested
            screenshot_context = None
            if request_screenshot_first:
                logger.info("Capturing screenshot for tool context")
                try:
                    screenshot_b64 = await self._request_screenshot("full")
                    screenshot_context = await self._analyze_with_vision(
                        screenshot_b64, 
                        f"Provide context for executing {tool_name}"
                    )
                    logger.info("Screenshot context captured successfully")
                except Exception as e:
                    logger.error(f"Screenshot capture failed: {e}")
            
            # Find the tool
            tool = self.mcp_router.get_tool_by_name(tool_name)
            if not tool:
                # Try to find similar tools
                similar = self.mcp_router.find_tools(tool_name, max_results=3)
                if similar:
                    suggestions = ", ".join([t.name for t in similar])
                    logger.info(f"Tool '{tool_name}' not found, suggesting: {suggestions}")
                    return f"Tool '{tool_name}' not found. Did you mean: {suggestions}?"
                
                logger.warning(f"Tool '{tool_name}' not found and no suggestions available")
                return f"Tool '{tool_name}' not found."
            
            # Add screenshot context to arguments if available
            if screenshot_context and arguments:
                arguments["_context"] = screenshot_context
            
            # Execute the tool directly
            logger.info(f"Executing tool: {tool_name}")
            result = await self.mcp_router.call_tool(
                tool,
                arguments or {},
                timeout=30
            )
            
            # Summarize the result for voice output
            summary = ToolResultSummarizer.summarize(tool_name, result)
            logger.info(f"Tool execution completed: {summary}")
            return summary
                
        except Exception as e:
            logger.error(f"MCP tool execution error: {e}", exc_info=True)
            self.error_logger.log_tool_execution_error(tool_name, arguments or {}, e)
            
            # Provide user-friendly error message
            error_str = str(e).lower()
            if "timeout" in error_str:
                return "The tool took too long to respond. Please try again."
            elif "permission" in error_str:
                return "I don't have permission to do that."
            elif "not found" in error_str:
                return "I couldn't find what you're looking for."
            else:
                return f"I couldn't execute that tool. Please check the logs for details."
        
    @function_tool
    async def take_screenshot(
        self,
        context: RunContext,
        query: str = "What do you see on the screen?",
        region: str = "full"
    ) -> str:
        """
        Captures and analyzes a screenshot of the user's screen.
        
        Args:
            query: What to analyze or look for in the screenshot
            region: Screen region to capture ("full", "window", or "selection")
            
        Returns:
            Visual analysis of the screenshot
        """
        try:
            # Provide immediate feedback
            await self._say_wrapper("Let me take a look at your screen.")
            
            # Check cache (5 second validity)
            import time
            current_time = time.time()
            if (self._screenshot_cache and 
                self._screenshot_cache_time and 
                current_time - self._screenshot_cache_time < 5):
                logger.info("Using cached screenshot")
                screenshot_base64 = self._screenshot_cache
            else:
                # Request new screenshot from Electron via WebSocket
                logger.info(f"Requesting screenshot capture (region: {region})")
                screenshot_base64 = await self._request_screenshot(region)
                # Cache it
                self._screenshot_cache = screenshot_base64
                self._screenshot_cache_time = current_time
            
            # Provide feedback that we're analyzing
            await self._say_wrapper("Analyzing what I see...")
            
            # Analyze with GPT-4o vision
            logger.info(f"Analyzing screenshot with query: {query}")
            analysis = await self._analyze_with_vision(screenshot_base64, query)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Screenshot tool error: {e}", exc_info=True)
            return f"I couldn't capture the screen right now. Error: {str(e)}"
    
    async def _request_screenshot(self, region: str) -> str:
        """Request screenshot from Electron app via WebSocket"""
        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.ws_connect(self.screenshot_ws_url) as ws:
                    # Send screenshot request
                    await ws.send_json({
                        "action": "capture_screenshot",
                        "region": region
                    })
                    
                    # Wait for response
                    msg = await ws.receive_json()
                    if msg.get("success"):
                        logger.info("Screenshot captured successfully")
                        return msg["base64"]
                    else:
                        raise Exception(msg.get("error", "Screenshot capture failed"))
                        
        except aiohttp.ClientError as e:
            logger.error(f"WebSocket connection error: {e}")
            raise Exception(f"Could not connect to screenshot service: {str(e)}")
    
    async def _analyze_with_vision(self, image_base64: str, query: str) -> str:
        """Analyze screenshot with GPT-4o vision API"""
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": query},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}",
                                "detail": "auto"
                            }
                        }
                    ]
                }],
                max_tokens=500,
                temperature=0.7
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"GPT-4o vision analysis error: {e}")
            raise Exception(f"Could not analyze the screenshot: {str(e)}")
    
    async def cleanup(self):
        """Clean up resources"""
        logger.info("Cleaning up voice agent resources...")
        
        # Log error summary
        error_summary = self.error_logger.get_error_summary()
        if error_summary['total_errors'] > 0:
            logger.warning(f"Session ended with {error_summary['total_errors']} errors")
            logger.info("Recent errors:")
            for error in error_summary['recent_errors']:
                logger.info(f"  - {error['operation']}: {error['error_message']}")
        
        if self.mcp_router:
            logger.info("Stopping MCP router...")
            await self.mcp_router.stop()
        if self.session:
            logger.info("Stopping agent session...")
            await self.session.stop()
        
        logger.info("✓ Cleanup complete")


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the agent worker"""
    logger.info(f"Agent started for room: {ctx.room.name}")
    
    # Create and start agent
    agent = VoiceOverlayAgent()
    
    try:
        await agent.start_agent_session(ctx)
        
        # Keep the agent running
        while True:
            await asyncio.sleep(1)
            
            # Check if we should stop
            if ctx.room.connection_state == "disconnected":
                logger.info("Room disconnected, stopping agent")
                break
                
    except Exception as e:
        logger.error(f"Agent error: {e}", exc_info=True)
    finally:
        await agent.cleanup()
        logger.info("Agent stopped")


def main():
    """Main function to run the agent"""
    # Set up environment variables if not already set
    if not os.getenv("OPENAI_API_KEY"):
        logger.warning("OPENAI_API_KEY not set in environment")
    if not os.getenv("ELEVENLABS_API_KEY"):
        logger.warning("ELEVENLABS_API_KEY not set in environment")
        
    # Run the agent worker
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        ),
    )


if __name__ == "__main__":
    main()
```

## Step 2: MCP Router Implementation

Create `src/agent/mcp_router.py`:

```python
"""
MCP Router - Manages connections to multiple MCP servers
Supports stdio and websocket transports with hot-reload capability
"""

import asyncio
import json
import os
import uuid
import time
import pathlib
import hashlib
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Any, Union
from mcp_logger import MCPErrorLogger, setup_mcp_logging, log_mcp_startup, log_mcp_shutdown

# Setup logging
setup_mcp_logging()
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
    def request(method: str, params: dict | None = None) -> str:
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
        resp = json.loads(data)
        if "error" in resp:
            raise RuntimeError(f"RPC Error: {resp['error']}")
        return resp.get("result", {})

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
        self.proc = await asyncio.create_subprocess_exec(
            self.command, *self.args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, **self.env}
        )
        
    async def call(self, method: str, params: dict, timeout: float) -> dict:
        """Make an RPC call over stdio"""
        async with self._lock:
            if not self.proc or not self.proc.stdin or not self.proc.stdout:
                raise RuntimeError(f"Stdio server {self.server_id} not started")
            
            request = JSONRPCHelper.request(method, params)
            self.proc.stdin.write(request.encode("utf-8"))
            await self.proc.stdin.drain()
            
            try:
                line = await asyncio.wait_for(self.proc.stdout.readline(), timeout=timeout)
                if not line:
                    raise RuntimeError(f"Stdio server {self.server_id} closed unexpectedly")
                return JSONRPCHelper.parse_response(line.decode("utf-8"))
            except asyncio.TimeoutError:
                raise TimeoutError(f"Timeout calling {method} on {self.server_id}")
    
    async def close(self):
        """Close the stdio process"""
        if self.proc:
            self.proc.terminate()
            try:
                await asyncio.wait_for(self.proc.wait(), timeout=5)
            except asyncio.TimeoutError:
                self.proc.kill()

class WebSocketTransport:
    """WebSocket transport for remote MCP servers"""
    def __init__(self, server_id: str, url: str, headers: Dict[str, str]):
        self.server_id = server_id
        self.url = url
        self.headers = headers
        self.ws = None
        self._lock = asyncio.Lock()
        
    async def start(self):
        """Connect to websocket server"""
        logger.info(f"Connecting to websocket server {self.server_id}: {self.url}")
        try:
            import websockets
        except ImportError:
            raise ImportError("websockets library required for WebSocket transport")
        
        self.ws = await websockets.connect(self.url, extra_headers=self.headers)
        
    async def call(self, method: str, params: dict, timeout: float) -> dict:
        """Make an RPC call over websocket"""
        async with self._lock:
            if not self.ws:
                raise RuntimeError(f"WebSocket server {self.server_id} not connected")
            
            payload = {
                "jsonrpc": "2.0",
                "id": str(uuid.uuid4()),
                "method": method,
                "params": params or {}
            }
            
            await self.ws.send(json.dumps(payload))
            
            try:
                msg = await asyncio.wait_for(self.ws.recv(), timeout=timeout)
                return JSONRPCHelper.parse_response(msg)
            except asyncio.TimeoutError:
                raise TimeoutError(f"Timeout calling {method} on {self.server_id}")
    
    async def close(self):
        """Close websocket connection"""
        if self.ws:
            await self.ws.close()

class McpToolRouter:
    """Main router for managing multiple MCP servers"""
    
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.config_mtime = 0.0
        self.config = {}
        self.clients: Dict[str, Union[StdioTransport, WebSocketTransport]] = {}
        self.tools: List[ToolSpec] = []
        self.sensitive_keywords: List[str] = []
        self.policy = {}
        self.runtime = {}
        self._lock = asyncio.Lock()
        self._reload_task = None
        self.error_logger = MCPErrorLogger('mcp-router')
        
    async def _load_config(self) -> bool:
        """Load configuration from file"""
        try:
            path = pathlib.Path(self.config_path)
            if not path.exists():
                logger.warning(f"Config file not found: {self.config_path}")
                return False
                
            mtime = path.stat().st_mtime
            if mtime == self.config_mtime:
                return False
                
            self.config = json.loads(path.read_text())
            self.config_mtime = mtime
            
            # Parse configuration
            self.sensitive_keywords = [
                kw.lower() for kw in self.config.get("policy", {}).get("sensitive_keywords", [])
            ]
            self.policy = self.config.get("policy", {})
            self.runtime = self.config.get("runtime", {})
            
            logger.info(f"Loaded config with {len(self.config.get('servers', {}))} servers")
            return True
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return False
    
    async def _connect_server(self, server_id: str, server_config: dict):
        """Connect to a single MCP server"""
        transport_type = server_config.get("transport", "stdio")
        
        logger.info(f"Connecting to server: {server_id} (transport: {transport_type})")
        
        try:
            if transport_type == "stdio":
                client = StdioTransport(
                    server_id,
                    server_config["command"],
                    server_config.get("args", []),
                    server_config.get("env", {})
                )
            elif transport_type == "ws" or transport_type == "websocket":
                client = WebSocketTransport(
                    server_id,
                    server_config["url"],
                    server_config.get("headers", {})
                )
            else:
                error_msg = f"Unknown transport type: {transport_type}"
                logger.error(error_msg)
                self.error_logger.log_connection_error(server_id, transport_type, ValueError(error_msg))
                return
                
            await client.start()
            self.clients[server_id] = client
            logger.info(f"✓ Connected to {server_id}")
            
            # Initialize connection with proper MCP protocol
            try:
                await self._rpc(server_id, "initialize", {
                    "protocolVersion": "1.0.0",
                    "capabilities": {
                        "tools": {"call": True},
                        "resources": {"list": False, "read": False},
                        "prompts": {"list": False, "get": False}
                    },
                    "clientInfo": {"name": "voice-overlay-agent", "version": "1.0.0"}
                }, 5.0)
                logger.info(f"✓ Initialized server {server_id}")
            except Exception as e:
                logger.debug(f"Optional initialization failed for {server_id}: {e}")
                # This is often OK, not all servers require initialization
                
        except Exception as e:
            logger.error(f"Failed to connect to server {server_id}: {e}")
            self.error_logger.log_connection_error(server_id, transport_type, e)
    
    async def _disconnect_server(self, server_id: str):
        """Disconnect from an MCP server"""
        if server_id in self.clients:
            try:
                await self.clients[server_id].close()
            except Exception as e:
                logger.error(f"Error closing server {server_id}: {e}")
            finally:
                del self.clients[server_id]
    
    async def _rpc(self, server_id: str, method: str, params: dict, timeout: float) -> dict:
        """Make an RPC call to a specific server"""
        if server_id not in self.clients:
            error = RuntimeError(f"Server {server_id} not connected")
            self.error_logger.log_rpc_error(server_id, method, params, error)
            raise error
        
        try:
            logger.debug(f"RPC call: {method} on {server_id}")
            result = await self.clients[server_id].call(method, params, timeout)
            logger.debug(f"RPC success: {method} on {server_id}")
            return result
        except Exception as e:
            logger.error(f"RPC failed: {method} on {server_id}: {e}")
            self.error_logger.log_rpc_error(server_id, method, params, e)
            raise
    
    async def _refresh_tools(self):
        """Refresh tool list from all connected servers"""
        tools: List[ToolSpec] = []
        
        logger.info("Refreshing tool list from all servers...")
        
        for server_id, client in list(self.clients.items()):
            try:
                # Get tools from server
                logger.debug(f"Requesting tools from {server_id}")
                result = await self._rpc(server_id, "tools/list", {}, 8.0)
                server_tools = result.get("tools", [])
                
                logger.info(f"Server {server_id} returned {len(server_tools)} tools")
                
                for tool in server_tools:
                    name = tool.get("name", "")
                    description = tool.get("description", "")
                    schema = tool.get("inputSchema") or tool.get("input_schema") or {}
                    
                    # Check if tool is sensitive
                    tool_text = f"{name} {description}".lower()
                    is_sensitive = any(kw in tool_text for kw in self.sensitive_keywords)
                    
                    tools.append(ToolSpec(
                        server_id=server_id,
                        name=name,
                        description=description,
                        schema=schema,
                        sensitive=is_sensitive
                    ))
                    
                    logger.debug(f"  - {name}: {description[:50]}..." if len(description) > 50 else f"  - {name}: {description}")
                
                logger.info(f"✓ Loaded {len(server_tools)} tools from {server_id}")
                
            except Exception as e:
                logger.error(f"Failed to refresh tools from {server_id}: {e}")
                self.error_logger.log_tool_discovery_error(server_id, e)
                # Mark server as unhealthy
                logger.warning(f"Disconnecting unhealthy server: {server_id}")
                await self._disconnect_server(server_id)
        
        self.tools = tools
        logger.info(f"Total tools available: {len(self.tools)}")
    
    async def start(self):
        """Start the MCP router"""
        logger.info("="*60)
        logger.info("Starting MCP Router")
        logger.info("="*60)
        
        await self._load_config()
        
        servers = self.config.get("servers", {})
        logger.info(f"Found {len(servers)} server(s) in configuration")
        
        # Connect to all configured servers
        for server_id, server_config in servers.items():
            await self._connect_server(server_id, server_config)
        
        # Refresh tool list
        await self._refresh_tools()
        
        # Log startup summary
        log_mcp_startup(
            self.config_path,
            len(self.clients),
            len(self.tools)
        )
        
        # Start hot reload if enabled
        if self.runtime.get("hot_reload"):
            logger.info("Hot reload enabled")
            self._reload_task = asyncio.create_task(self._hot_reload_loop())
    
    async def stop(self):
        """Stop the MCP router"""
        logger.info("Stopping MCP Router...")
        
        # Cancel reload task
        if self._reload_task:
            self._reload_task.cancel()
            try:
                await self._reload_task
            except asyncio.CancelledError:
                pass
        
        # Disconnect all servers
        for server_id in list(self.clients.keys()):
            logger.info(f"Disconnecting {server_id}...")
            await self._disconnect_server(server_id)
        
        # Log shutdown
        log_mcp_shutdown("User requested shutdown")
        
        # Get error summary
        error_summary = self.error_logger.get_error_summary()
        if error_summary['total_errors'] > 0:
            logger.warning(f"Session ended with {error_summary['total_errors']} total errors")
            logger.info("Check log files for details")
    
    async def _hot_reload_loop(self):
        """Background task for hot-reloading configuration"""
        interval = self.runtime.get("reload_every_sec", 5)
        
        while True:
            try:
                await asyncio.sleep(interval)
                
                # Check for config changes
                config_changed = await self._load_config()
                if not config_changed:
                    continue
                
                # Update server connections
                current_servers = set(self.clients.keys())
                wanted_servers = set(self.config.get("servers", {}).keys())
                
                # Disconnect removed servers
                for server_id in current_servers - wanted_servers:
                    logger.info(f"Removing server {server_id}")
                    await self._disconnect_server(server_id)
                
                # Connect new servers
                for server_id in wanted_servers - current_servers:
                    if server_id in self.config.get("servers", {}):
                        logger.info(f"Adding server {server_id}")
                        await self._connect_server(server_id, self.config["servers"][server_id])
                
                # Refresh tools
                await self._refresh_tools()
                
            except Exception as e:
                logger.error(f"Error in hot reload loop: {e}")
    
    def find_tools(self, query: str, max_results: int = 5) -> List[ToolSpec]:
        """Find tools matching a query"""
        query_lower = query.lower()
        tokens = [t for t in query_lower.replace(",", " ").split() if t]
        
        scored_tools = []
        for tool in self.tools:
            haystack = f"{tool.name} {tool.description}".lower()
            score = sum(1 for token in tokens if token in haystack)
            if score > 0:
                scored_tools.append((score, tool))
        
        # Sort by score (descending) and name
        scored_tools.sort(key=lambda x: (-x[0], x[1].name))
        
        return [tool for _, tool in scored_tools[:max_results]]
    
    def get_tool_by_name(self, name: str) -> Optional[ToolSpec]:
        """Get a specific tool by name"""
        for tool in self.tools:
            if tool.name == name:
                return tool
        return None
    
    async def call_tool(self, tool: ToolSpec, arguments: dict, timeout: Optional[float] = None) -> dict:
        """Call a tool with arguments"""
        if timeout is None:
            timeout = self.policy.get("tool_timeout_sec", 25)
            
        logger.info(f"Calling tool {tool.name} on server {tool.server_id}")
        logger.debug(f"Arguments: {self.error_logger._sanitize_args(arguments)}")
        
        start_time = time.time()
        
        try:
            result = await self._rpc(
                tool.server_id,
                "tools/call",
                {"name": tool.name, "arguments": arguments},
                timeout
            )
            
            duration = time.time() - start_time
            logger.info(f"✓ Tool {tool.name} completed in {duration:.2f}s")
            self.error_logger.log_successful_execution(tool.name, duration)
            
            return result
        except asyncio.TimeoutError as e:
            duration = time.time() - start_time
            logger.error(f"Tool {tool.name} timed out after {duration:.2f}s")
            self.error_logger.log_tool_execution_error(tool.name, arguments, e)
            raise
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Tool {tool.name} failed after {duration:.2f}s: {e}")
            self.error_logger.log_tool_execution_error(tool.name, arguments, e)
            raise
```

## Step 3: MCP Utilities

Create `src/agent/mcp_utils.py` (complete file from current project):

[Copy the entire mcp_utils.py file content from the original project]

## Step 4: MCP Logger

Create `src/agent/mcp_logger.py` (complete file from current project):

[Copy the entire mcp_logger.py file content from the original project]

## Step 5: MCP Configuration

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
    },
    "filesystem": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users"],
      "env": {}
    },
    "web-search": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-websearch"],
      "env": {
        "GOOGLE_API_KEY": "${GOOGLE_API_KEY}",
        "GOOGLE_CSE_ID": "${GOOGLE_CSE_ID}"
      }
    }
  },
  "policy": {
    "sensitive_keywords": ["password", "secret", "token", "key"],
    "tool_timeout_sec": 25,
    "require_confirmation": true
  },
  "runtime": {
    "hot_reload": true,
    "reload_every_sec": 5
  }
}
```

## Step 6: Update Python Requirements

Update `src/agent/requirements.txt`:

```txt
livekit==0.2.25
livekit-agents==0.10.4
livekit-plugins-openai==0.9.1
livekit-plugins-elevenlabs==0.7.5
livekit-plugins-silero==0.6.5
python-dotenv==1.0.0
aiohttp==3.9.1
openai==1.35.0
websockets==12.0
```

## Step 7: Testing Scripts

Create `test-mcp-standalone.py`:

```python
#!/usr/bin/env python3
"""Test MCP router standalone"""

import asyncio
import sys
import pathlib
sys.path.append(str(pathlib.Path(__file__).parent))

from mcp_router import McpToolRouter
from mcp_logger import setup_mcp_logging

async def test_mcp():
    setup_mcp_logging()
    
    # Create router
    config_path = pathlib.Path(__file__).parent / "mcp.config.json"
    router = McpToolRouter(str(config_path))
    
    # Start router
    print("Starting MCP router...")
    await router.start()
    
    # List tools
    print(f"\nFound {len(router.tools)} tools:")
    for tool in router.tools[:10]:
        print(f"  - {tool.name}: {tool.description[:50]}...")
    
    # Test AppleScript if available
    applescript_tool = router.get_tool_by_name("applescript_execute")
    if applescript_tool:
        print("\nTesting AppleScript tool...")
        result = await router.call_tool(
            applescript_tool,
            {"code_snippet": 'display notification "MCP Test" with title "Voice Overlay"'},
            timeout=5
        )
        print(f"Result: {result}")
    
    # Stop router
    await router.stop()
    print("\nTest complete!")

if __name__ == "__main__":
    asyncio.run(test_mcp())
```

Create `test-full-agent.py`:

```python
#!/usr/bin/env python3
"""Test the complete voice agent locally"""

import asyncio
import os
from unittest.mock import Mock, AsyncMock
import sys
import pathlib
sys.path.append(str(pathlib.Path(__file__).parent))

from voice_agent import VoiceOverlayAgent

async def test_agent():
    # Set up mock environment
    os.environ["OPENAI_API_KEY"] = "test-key"
    os.environ["ELEVENLABS_API_KEY"] = "test-key"
    
    # Create mock context
    mock_ctx = Mock()
    mock_ctx.job = Mock()
    mock_ctx.job.metadata = {"send_greeting": False}
    mock_ctx.room = Mock()
    mock_ctx.room.name = "test-room"
    mock_ctx.room.connection_state = "connected"
    mock_ctx.connect = AsyncMock()
    
    # Create agent
    agent = VoiceOverlayAgent()
    
    # Initialize MCP only
    print("Initializing MCP system...")
    await agent._initialize_mcp()
    
    if agent.mcp_router:
        print(f"✓ MCP initialized with {len(agent.mcp_router.tools)} tools")
        
        # List available tools
        print("\nAvailable tools:")
        for tool in agent.mcp_router.tools[:5]:
            print(f"  - {tool.name}: {tool.description[:50]}...")
    else:
        print("✗ MCP initialization failed")
    
    # Clean up
    await agent.cleanup()
    print("\nTest complete!")

if __name__ == "__main__":
    asyncio.run(test_agent())
```

## Step 8: Integration with Main Process

Update `src/main/services/LiveKitService.js` to ensure Python agent starts correctly:

```javascript
async spawnPythonAgent(roomName) {
    const agentPath = path.join(__dirname, '../../agent/voice_agent.py');
    const venvPython = path.join(__dirname, '../../agent/venv/bin/python3');
    
    // Use venv Python if available, otherwise system Python
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3';
    
    logger.info(`Starting Python agent: ${pythonCmd} ${agentPath}`);
    
    const agentProcess = spawn(pythonCmd, [agentPath], {
        env: {
            ...process.env,
            LIVEKIT_URL: this.settings.get('livekit.url'),
            LIVEKIT_API_KEY: this.settings.get('livekit.apiKey'),
            LIVEKIT_API_SECRET: this.settings.get('livekit.apiSecret'),
            OPENAI_API_KEY: this.settings.get('openai.apiKey'),
            ELEVENLABS_API_KEY: this.settings.get('elevenlabs.apiKey'),
            PYTHONUNBUFFERED: '1'
        },
        cwd: path.dirname(agentPath)
    });
    
    // Log output
    agentProcess.stdout.on('data', (data) => {
        logger.info(`[Python Agent] ${data.toString().trim()}`);
    });
    
    agentProcess.stderr.on('data', (data) => {
        logger.error(`[Python Agent Error] ${data.toString().trim()}`);
    });
    
    agentProcess.on('exit', (code) => {
        logger.info(`[Python Agent] Process exited with code ${code}`);
        this.agentProcess = null;
    });
    
    this.agentProcess = agentProcess;
    logger.info('[Python Agent] Started successfully');
}
```

## Step 9: End-to-End Testing

Create `test-voice-flow.js`:

```javascript
const { spawn } = require('child_process');
const path = require('path');

async function testVoiceFlow() {
    console.log('Testing complete voice flow...\n');
    
    // 1. Test Python environment
    console.log('1. Testing Python environment...');
    const pythonTest = spawn('python3', ['-c', 'import livekit; print("✓ LiveKit SDK available")']);
    pythonTest.stdout.on('data', (data) => console.log(data.toString()));
    pythonTest.stderr.on('data', (data) => console.error(data.toString()));
    
    await new Promise(resolve => pythonTest.on('close', resolve));
    
    // 2. Test MCP configuration
    console.log('\n2. Testing MCP configuration...');
    const mcpTest = spawn('python3', ['src/agent/test-mcp-standalone.py']);
    mcpTest.stdout.on('data', (data) => console.log(data.toString()));
    mcpTest.stderr.on('data', (data) => console.error(data.toString()));
    
    await new Promise(resolve => mcpTest.on('close', resolve));
    
    // 3. Test agent initialization
    console.log('\n3. Testing agent initialization...');
    const agentTest = spawn('python3', ['src/agent/test-full-agent.py']);
    agentTest.stdout.on('data', (data) => console.log(data.toString()));
    agentTest.stderr.on('data', (data) => console.error(data.toString()));
    
    await new Promise(resolve => agentTest.on('close', resolve));
    
    console.log('\n✓ All tests complete!');
}

testVoiceFlow().catch(console.error);
```

## Troubleshooting Guide

### Common Issues and Solutions

1. **MCP tools not loading**
   ```bash
   # Check MCP config exists
   ls src/agent/mcp.config.json
   
   # Test MCP router directly
   cd src/agent
   python3 test-mcp-standalone.py
   ```

2. **Python agent not starting**
   ```bash
   # Check Python dependencies
   cd src/agent
   source venv/bin/activate
   pip list | grep livekit
   
   # Test agent directly
   LIVEKIT_URL=test python3 voice_agent.py
   ```

3. **AppleScript tool not working**
   ```bash
   # Test AppleScript server directly
   npx @johnlindquist/mcp-server-applescript
   
   # Check permissions in System Preferences > Security & Privacy
   ```

4. **WebSocket screenshot connection failing**
   ```bash
   # Check if screenshot service is running
   lsof -i :8765
   
   # Start screenshot service manually if needed
   node src/main/services/ScreenshotService.js
   ```

## Phase 3 Completion Checklist

- [ ] Voice agent with OpenAI Realtime + ElevenLabs TTS
- [ ] MCP router managing multiple servers
- [ ] All MCP utilities implemented
- [ ] Comprehensive logging system
- [ ] Screenshot capture and analysis
- [ ] AppleScript tool integration
- [ ] Error handling and recovery
- [ ] All tests passing
- [ ] Integration with main process verified

## Next Steps

Once Phase 3 is complete:
1. Run full integration tests
2. Document any API changes for User 2
3. Prepare for final integration checkpoint
4. Test voice flow end-to-end

You now have a complete backend with voice agent and MCP tools ready for integration!