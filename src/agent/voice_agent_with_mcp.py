#!/usr/bin/env python3
"""
LiveKit Voice Agent for Halo with MCP Integration
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
logger = logging.getLogger("halo-agent")
logger.setLevel(logging.INFO)


class HaloVoiceAgentWithMCP:
    """Main voice agent class for Halo assistant with MCP integration"""
    
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
        self.error_logger = MCPErrorLogger('halo-agent')
        
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
            self.execute_mcp_tool,  # New MCP tool executor
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
            
            # No confirmation handler - just execute tools directly
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
                
                # Method 1: Try to use the participant's audio track directly
                if hasattr(self.session, '_participant') and self.session._participant:
                    participant = self.session._participant
                    # Find the audio track
                    for track in participant.tracks.values():
                        if track.kind == "audio":
                            # Speak directly through the track if possible
                            logger.info("Found audio track for direct TTS")
                            break
                
                # Method 2: Use generate_reply with more explicit instructions
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
                    # If direct TTS fails, try adding to the session's message queue
                    if hasattr(self.session, 'say'):
                        await self.session.say(text)
                        logger.info(f"Used fallback TTS for: '{text}'")
                except Exception as fallback_error:
                    logger.error(f"Fallback TTS also failed: {fallback_error}")
    
    async def _listen_yes_no_wrapper(self, timeout: float) -> bool:
        """Wrapper for yes/no listening - waits for user to say yes/no"""
        # IMPORTANT: This should wait for actual user response
        # For now, we'll wait but NOT auto-confirm
        try:
            logger.info("Waiting for user confirmation (yes/no)...")
            # In a real implementation, this would monitor the transcript
            # For testing, let's NOT auto-confirm to see if confirmation is being called
            await asyncio.sleep(timeout)
            # Return False by default to prevent unwanted executions
            logger.warning("Confirmation timeout - defaulting to NO for safety")
            return False
        except Exception as e:
            logger.error(f"Listen error: {e}")
            return False
            
    async def _send_greeting(self):
        """Send initial greeting to user"""
        greeting = self.metadata.get(
            "greeting",
            "Hello and welcome to Halo. I can understand your screen, help with various tasks, and guide you through anything you might need. Just let me know how I can assist."
        )
        
        # Add MCP tools info if available
        if self.mcp_router and self.mcp_router.tools:
            tool_count = len(self.mcp_router.tools)
            greeting += f" I have {tool_count} tools available to help with various tasks."
        
        await self._say_wrapper(greeting)
            
    def _get_system_instructions(self):
        """Get system instructions for the agent"""
        base_instructions = """You are Halo, a helpful AI assistant integrated into the user's desktop.
        Be concise, friendly, and helpful. Focus on understanding the user's needs and providing
        clear, actionable responses.
        
        You can see the user's screen when they ask about it. Use the take_screenshot tool when:
        - They ask "what's on my screen" or "can you see this"
        - They need help with something visible on their screen
        - They want you to read or analyze visual content
        - They ask about errors, UI elements, or applications they're using
        
        CRITICAL INSTRUCTION FOR ALL MACOS OPERATIONS:
        ================================================
        You have ONLY ONE TOOL for macOS operations: execute_mcp_tool with tool_name="applescript_execute"
        
        NEVER create fake tool names. ALWAYS use:
        - Function: execute_mcp_tool
        - tool_name: "applescript_execute" 
        - arguments: {"code_snippet": "<your AppleScript code here>"}
        
        CRITICAL: In AppleScript code_snippet formatting:
        - Use regular double quotes " inside the AppleScript (NOT escaped)
        - Use \\n for line breaks between AppleScript lines
        - The code_snippet is a normal string - let JSON handle the escaping
        
        Examples of AppleScript operations:
        
        1. REMINDERS (with proper date/time handling):
        - Create reminder for specific time today:
          code_snippet: "set reminderDate to (current date) + (5 * hours)\ntell application \"Reminders\" to make new reminder with properties {name:\"Task\", remind me date:reminderDate}"
        - Create reminder for tomorrow at specific time:
          set reminderDate to (current date) + (1 * days)
          set hours of reminderDate to 17 -- 5 PM
          set minutes of reminderDate to 0
          tell application \"Reminders\" to make new reminder with properties {name:\"Task\", remind me date:reminderDate}
        - List: tell application "Reminders" to get name of every reminder
        
        2. CALENDAR (IMPORTANT: Use proper date/time formats with timezone):
        - Get timezone first: do shell script "date +%Z"
        - Get first calendar: tell application "Calendar" to get name of first calendar
        - Create event with proper date format (use calendar 1 or "Work"):
          set eventDate to current date
          set day of eventDate to 25
          set month of eventDate to 12
          set year of eventDate to 2024
          set hours of eventDate to 15
          set minutes of eventDate to 0
          tell application "Calendar" to make new event at calendar 1 with properties {summary:"Meeting", start date:eventDate, end date:eventDate + (60 * minutes)}
        - Create event for specific time today/tomorrow:
          set eventDate to (current date) + (5 * hours) -- for 5 hours from now
          tell application "Calendar" to make new event at calendar 1 with properties {summary:"Test", start date:eventDate, end date:eventDate + (60 * minutes)}
        - Check calendar: tell application "Calendar" to get summary of every event of calendar 1
        
        3. MESSAGES:
        - Send: tell application "Messages" to send "Hello" to buddy "+1234567890"
        
        4. NOTES:
        - Create: tell application "Notes" to make new note with properties {name:"Title", body:"Content"}
        - Read: tell application "Notes" to get body of note 1
        
        5. SYSTEM INFO:
        - Battery: do shell script "pmset -g batt | grep -o '[0-9]*%'"
        - WiFi: do shell script "networksetup -getairportnetwork en0"
        - Disk space: do shell script "df -h / | tail -1"
        
        6. FINDER/FILES:
        - List files: tell application "Finder" to get name of every file of desktop
        - Open folder: tell application "Finder" to open folder "Documents" of home
        
        7. SAFARI:
        - Open URL: tell application "Safari" to open location "https://example.com"
        - Get URL: tell application "Safari" to get URL of current tab of window 1
        
        8. NOTIFICATIONS:
        - Show: display notification "Message" with title "Title"
        
        REMEMBER: There is NO "reminders_add", "calendar_create", "messages_send" tool!
        ONLY use execute_mcp_tool with tool_name="applescript_execute" for EVERYTHING!
        
        Always describe actions in natural language without mentioning tool names.
        
        EXECUTION FLOW:
        1. When user asks to add something to calendar/reminders, acknowledge and execute immediately
        2. After successful execution, confirm: "I've added [event] to your calendar" or "Your reminder is set"
        3. If there's an error, explain what went wrong
        
        TIMEZONE AWARENESS:
        - Detect user's timezone with: do shell script "date +%Z"
        - Always use proper AppleScript date objects with correct timezone
        - For "5pm today", calculate from current date/time
        - For "tomorrow at 3pm", add days then set specific hours
        
        After completing tasks, I'll summarize the results conversationally."""
        
        # Add available MCP tools to instructions
        if self.mcp_router and self.mcp_router.tools:
            tool_names = [tool.name for tool in self.mcp_router.tools[:10]]
            base_instructions += f"\n\nAvailable MCP tools: {', '.join(tool_names)}"
            base_instructions += "\nREMEMBER: Use applescript_execute for ALL system operations!"
        
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
                    # Continue without screenshot context
            
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
            
            # Just execute the tool directly
            logger.info(f"Executing tool: {tool_name}")
            result = await self.mcp_router.call_tool(
                tool,
                arguments or {},
                timeout=30
            )
            result = {"success": True, "result": result}
            
            # Return the summary from confirmer (it already spoke it)
            if result.get("success"):
                # The confirmer already spoke the summary
                return result.get("summary", "Done.")
            else:
                # Handle errors/cancellations
                if result.get("canceled"):
                    return "Action canceled."
                error = result.get("error", "Unknown error")
                return f"I couldn't complete that: {error}"
                
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
                
                # Start filler task for long operations
                import asyncio
                cancel_event = asyncio.Event()
                filler_task = asyncio.create_task(self._screenshot_filler(cancel_event))
                
                try:
                    screenshot_base64 = await self._request_screenshot(region)
                    # Cache it
                    self._screenshot_cache = screenshot_base64
                    self._screenshot_cache_time = current_time
                finally:
                    # Stop filler
                    cancel_event.set()
                    if not filler_task.done():
                        filler_task.cancel()
                        try:
                            await filler_task
                        except asyncio.CancelledError:
                            pass
            
            # Provide feedback that we're analyzing
            await self._say_wrapper("Analyzing what I see...")
            
            # Analyze with GPT-4o vision
            logger.info(f"Analyzing screenshot with query: {query}")
            analysis = await self._analyze_with_vision(screenshot_base64, query)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Screenshot tool error: {e}", exc_info=True)
            return f"I couldn't capture the screen right now. Error: {str(e)}"
    
    async def _screenshot_filler(self, cancel_event: asyncio.Event):
        """Provide filler speech while capturing screenshot"""
        await asyncio.sleep(1.5)  # Wait before first filler
        
        filler_phrases = [
            "Still capturing...",
            "One moment...",
            "Almost ready..."
        ]
        
        phrase_index = 0
        while not cancel_event.is_set():
            if phrase_index < len(filler_phrases):
                await self._say_wrapper(filler_phrases[phrase_index])
                phrase_index += 1
            
            # Wait for next filler or cancellation
            try:
                await asyncio.wait_for(cancel_event.wait(), timeout=2.0)
                break  # Event was set
            except asyncio.TimeoutError:
                continue  # Continue with next filler
    
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
    agent = HaloVoiceAgentWithMCP()
    
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