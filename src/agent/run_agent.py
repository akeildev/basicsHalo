#!/usr/bin/env python3
"""
Runner script for Halo Voice Agent
This script starts the agent worker and connects to LiveKit Cloud
"""

import os
import sys
import logging
import subprocess
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from config import AgentConfig

# Set up logging
log_level = os.environ.get('LOG_LEVEL', 'INFO')
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("agent-runner")

# Startup banner
logger.info("="*50)
logger.info("🤖 HALO VOICE AGENT RUNNER STARTING")
logger.info("="*50)


def setup_environment():
    """Set up environment variables for the agent"""
    logger.info("Setting up environment variables...")
    
    # Set LiveKit environment variables
    os.environ["LIVEKIT_URL"] = AgentConfig.LIVEKIT_URL
    os.environ["LIVEKIT_API_KEY"] = AgentConfig.LIVEKIT_API_KEY
    os.environ["LIVEKIT_API_SECRET"] = AgentConfig.LIVEKIT_API_SECRET
    
    # Log LiveKit configuration
    logger.info(f"  LiveKit URL: {AgentConfig.LIVEKIT_URL}")
    logger.info(f"  LiveKit API Key: {AgentConfig.LIVEKIT_API_KEY[:10]}..." if AgentConfig.LIVEKIT_API_KEY else "  LiveKit API Key: NOT SET")
    logger.info(f"  LiveKit Secret: {'SET' if AgentConfig.LIVEKIT_API_SECRET else 'NOT SET'}")
    
    # Set API keys - prioritize the one from Electron
    openai_key = os.environ.get("OPENAI_API_KEY") or AgentConfig.OPENAI_API_KEY
    if openai_key:
        os.environ["OPENAI_API_KEY"] = openai_key
        logger.info(f"  OpenAI API Key: {openai_key[:7]}... (received from Electron)")
    else:
        logger.warning("  ⚠️  OpenAI API Key: NOT SET - Agent will not function properly!")
        
    os.environ["ELEVENLABS_API_KEY"] = AgentConfig.ELEVENLABS_API_KEY
    logger.info(f"  ElevenLabs Key: {AgentConfig.ELEVENLABS_API_KEY[:10]}..." if AgentConfig.ELEVENLABS_API_KEY else "  ElevenLabs Key: NOT SET")
    
    logger.info("✅ Environment variables configured")


def run_agent():
    """Run the voice agent"""
    logger.info("\n" + "="*50)
    logger.info("🚀 STARTING VOICE AGENT")
    logger.info("="*50)
    
    # Validate configuration
    logger.info("Validating configuration...")
    if not AgentConfig.validate():
        logger.error("❌ Configuration validation failed")
        logger.error("Please ensure all required API keys are set")
        sys.exit(1)
    logger.info("✅ Configuration validated")
    
    # Set up environment
    setup_environment()
    
    # Get the path to the voice agent script WITH MCP support
    agent_path = Path(__file__).parent / "voice_agent_with_mcp.py"
    
    logger.info("\n" + "="*50)
    logger.info(f"📍 Agent script: {agent_path}")
    logger.info(f"🌐 LiveKit URL: {AgentConfig.LIVEKIT_URL}")
    logger.info(f"🏠 Room: {os.environ.get('AGENT_ROOM_NAME', 'unknown')}")
    logger.info("="*50 + "\n")
    
    # Run the agent
    try:
        # Use subprocess to run the agent with proper environment
        result = subprocess.run(
            [sys.executable, str(agent_path), "start"],
            env=os.environ.copy(),
            check=True
        )
        return result.returncode
    except subprocess.CalledProcessError as e:
        logger.error(f"Agent failed with error: {e}")
        return e.returncode
    except KeyboardInterrupt:
        logger.info("Agent stopped by user")
        return 0
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(run_agent())