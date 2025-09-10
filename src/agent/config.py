"""Configuration management for Halo Voice Agent"""

import os
from dotenv import load_dotenv
from typing import Optional

# Load environment variables
load_dotenv()


class AgentConfig:
    """Configuration for the voice agent"""
    
    # LiveKit Configuration - Fixed the API secret
    LIVEKIT_URL: str = os.getenv("LIVEKIT_URL", "wss://halo-ecujaon7.livekit.cloud")
    LIVEKIT_API_KEY: str = os.getenv("LIVEKIT_API_KEY", "APIudWnyrLubj9x")
    LIVEKIT_API_SECRET: str = os.getenv("LIVEKIT_API_SECRET", "vgedviCrLgHGL2lNbLs9xcj5M5LRR5hFfXKrhKykjDE")
    
    # OpenAI Configuration
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-realtime-preview")
    
    # ElevenLabs Configuration
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "sk_a0a2444bdfa08d1dabfa394b6cf36634d99d7c5de8ef72b7")
    ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")  # Rachel voice
    
    # VAD Configuration
    VAD_MIN_SPEECH_DURATION: float = float(os.getenv("VAD_MIN_SPEECH_DURATION", "0.2"))
    VAD_MIN_SILENCE_DURATION: float = float(os.getenv("VAD_MIN_SILENCE_DURATION", "0.5"))
    VAD_ACTIVATION_THRESHOLD: float = float(os.getenv("VAD_ACTIVATION_THRESHOLD", "0.6"))
    
    # Agent Configuration
    AGENT_NAME: str = os.getenv("AGENT_NAME", "Halo")
    AGENT_LANGUAGE: str = os.getenv("AGENT_LANGUAGE", "en")
    AGENT_DEFAULT_GREETING: str = os.getenv(
        "AGENT_DEFAULT_GREETING",
        "Hello! I'm Halo, your AI assistant. How can I help you today?"
    )
    
    @classmethod
    def validate(cls) -> bool:
        """Validate required configuration"""
        errors = []
        
        if not cls.OPENAI_API_KEY:
            errors.append("OPENAI_API_KEY is not set")
        if not cls.ELEVENLABS_API_KEY:
            errors.append("ELEVENLABS_API_KEY is not set")
        if not cls.LIVEKIT_URL:
            errors.append("LIVEKIT_URL is not set")
        if not cls.LIVEKIT_API_KEY:
            errors.append("LIVEKIT_API_KEY is not set")
        if not cls.LIVEKIT_API_SECRET:
            errors.append("LIVEKIT_API_SECRET is not set")
            
        if errors:
            for error in errors:
                print(f"Configuration Error: {error}")
            return False
        return True
    
    @classmethod
    def get_openai_key_from_electron(cls) -> Optional[str]:
        """
        Attempt to get OpenAI key from Electron app's settings
        This would be called from the Electron side to pass the key
        """
        # This is a placeholder - the actual implementation would
        # receive the key from the Electron app via IPC or environment variable
        return cls.OPENAI_API_KEY