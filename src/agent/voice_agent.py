#!/usr/bin/env python3
"""
LiveKit Voice Agent for Halo
Integrates OpenAI Realtime (STT/LLM), ElevenLabs (TTS), and Silero VAD
"""

import asyncio
import logging
import os
from typing import Annotated, Optional
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.voice import AgentSession
from livekit.plugins import openai, elevenlabs, silero
from openai.types.beta.realtime.session import InputAudioTranscription
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
        
    async def start_agent_session(self, ctx: JobContext):
        """Initialize and start the agent session"""
        self.context = ctx
        
        # Parse metadata from job
        self.metadata = ctx.job.metadata if ctx.job.metadata else {}
        logger.info(f"Starting agent with metadata: {self.metadata}")
        
        # Connect to room first
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        
        # Create agent with instructions
        from livekit.agents import Agent
        agent = Agent(
            instructions=self._get_system_instructions()
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
        clear, actionable responses. You have access to their screen context when they share it."""
        
        # Add any custom instructions from metadata
        custom_instructions = self.metadata.get("instructions", "")
        if custom_instructions:
            return f"{base_instructions}\n\n{custom_instructions}"
        return base_instructions
        
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