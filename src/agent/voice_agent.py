#!/usr/bin/env python3
"""
LiveKit Voice Agent for Halo
Integrates OpenAI Realtime (STT/LLM), ElevenLabs (TTS), and Silero VAD
"""

import asyncio
import logging
import os
import base64
import aiohttp
from typing import Annotated, Optional
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
from datetime import datetime
import json

# Configure logging
logger = logging.getLogger("halo-agent")
logger.setLevel(logging.INFO)


class HaloVoiceAgent:
    """Main voice agent class for Halo assistant"""
    
    def __init__(self):
        self.session: Optional[AgentSession] = None
        self.context: Optional[JobContext] = None
        self.metadata: dict = {}
        self.screenshot_ws_url = "ws://127.0.0.1:8765"
        self.openai_client = AsyncOpenAI()
        self._screenshot_cache = None
        self._screenshot_cache_time = None
        
    async def start_agent_session(self, ctx: JobContext):
        """Initialize and start the agent session"""
        self.context = ctx
        
        # Parse metadata from job
        self.metadata = ctx.job.metadata if ctx.job.metadata else {}
        logger.info(f"Starting agent with metadata: {self.metadata}")
        
        # Connect to room first
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        
        # Create agent with instructions and tools
        from livekit.agents import Agent
        agent = Agent(
            instructions=self._get_system_instructions(),
            tools=[self.take_screenshot]  # Register the screenshot tool
        )
        
        # Create agent session with OpenAI Realtime (text-only) + ElevenLabs TTS
        # According to LiveKit docs: use modalities=["text"] for separate TTS
        self.session = AgentSession(
            llm=openai.realtime.RealtimeModel(
                model="gpt-4o-realtime-preview",
                modalities=["text"],  # Text-only mode for use with separate TTS
                input_audio_transcription=InputAudioTranscription(
                    model="whisper-1",
                    language="en",
                ),
            ),
            tts=elevenlabs.TTS(
                voice_id="EXAVITQu4vr4xnSDxMaL",  # Rachel voice
                model="eleven_turbo_v2",
                language="en",
            ),
            vad=silero.VAD.load(
                min_speech_duration=0.2,
                min_silence_duration=0.5, 
                activation_threshold=0.6,
            ),
        )
        
        # Start the session with the agent
        await self.session.start(agent=agent, room=ctx.room)
        
        # Send initial greeting if specified
        if self.metadata.get("send_greeting", True):
            await self._send_greeting()
            
    async def _send_greeting(self):
        """Send initial greeting to user"""
        greeting = self.metadata.get(
            "greeting",
            "Hello! I'm your Halo assistant. How can I help you today?"
        )
        
        # Send greeting - let RealtimeModel handle turn detection
        handle = await self.session.generate_reply(
            instructions=f"Say EXACTLY this and nothing else: '{greeting}'"
        )
        
        # Wait for greeting to complete
        if hasattr(handle, "wait_for_initialization"):
            await handle.wait_for_initialization()
            
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
        
        After taking a screenshot, naturally describe what you see in a conversational way.
        Be specific about UI elements, text, errors, or whatever is relevant to their query."""
        
        # Add any custom instructions from metadata
        custom_instructions = self.metadata.get("instructions", "")
        if custom_instructions:
            return f"{base_instructions}\n\n{custom_instructions}"
        return base_instructions
        
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
                                "detail": "auto"  # Let GPT-4o decide detail level
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
    
    async def handle_tools(self):
        """Handle tool calls from the agent"""
        # This can be extended to handle various tools
        # For now, we'll keep it simple
        pass


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the agent worker"""
    logger.info(f"Agent started for room: {ctx.room.name}")
    
    # Create and start agent
    agent = HaloVoiceAgent()
    
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
        if agent.session:
            await agent.session.stop()
        logger.info("Agent stopped")


def main():
    """Main function to run the agent"""
    # Set up environment variables if not already set
    if not os.getenv("OPENAI_API_KEY"):
        logger.warning("OPENAI_API_KEY not set in environment")
    if not os.getenv("ELEVENLABS_API_KEY"):
        logger.warning("ELEVENLABS_API_KEY not set in environment")
        
    # Run the agent worker
    # Use the correct JobProcess enum value for the latest LiveKit SDK
    # In newer versions, it's either JOB_NAMESPACE_ONLY or JOB_ROOM_ONLY
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        ),
    )


if __name__ == "__main__":
    main()