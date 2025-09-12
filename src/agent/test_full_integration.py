#!/usr/bin/env python3
"""
Test full MCP integration with AppleScript
"""

import asyncio
import json
import logging
from pathlib import Path
from mcp_router import McpToolRouter
from confirm_then_execute import ConfirmThenExecute
from action_namer import ActionNamer

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test-integration")

async def say_mock(text: str):
    """Mock say function"""
    logger.info(f"[WOULD SAY]: {text}")

async def listen_mock(timeout: float) -> bool:
    """Mock listen function - always returns True for testing"""
    logger.info(f"[WOULD LISTEN for {timeout}s]")
    return True

async def test_integration():
    """Test the complete MCP integration"""
    
    config_path = Path(__file__).parent / "mcp.config.json"
    
    # Create router
    router = McpToolRouter(str(config_path))
    
    try:
        # Start router
        logger.info("Starting MCP router...")
        await router.start()
        
        # Wait for tools
        await asyncio.sleep(2)
        
        logger.info(f"✓ Connected with {len(router.tools)} tools")
        
        if not router.tools:
            logger.error("No tools available!")
            return
        
        # Create confirmer with policy
        confirmer = ConfirmThenExecute(
            router,
            say_mock,
            listen_mock,
            router.policy
        )
        
        # Test 1: Simple notification
        logger.info("\n" + "="*60)
        logger.info("TEST 1: Display notification")
        logger.info("="*60)
        
        tool = router.get_tool_by_name("applescript_execute")
        if tool:
            result = await confirmer.execute(
                tool,
                {
                    "code_snippet": 'display notification "MCP is working!" with title "Halo Assistant"'
                },
                skip_confirmation=True
            )
            logger.info(f"Result: {json.dumps(result, indent=2)}")
        
        # Test 2: Get system info
        logger.info("\n" + "="*60)
        logger.info("TEST 2: Get battery level")
        logger.info("="*60)
        
        if tool:
            result = await confirmer.execute(
                tool,
                {
                    "code_snippet": '''
                    set batteryLevel to do shell script "pmset -g batt | grep -o '[0-9]*%'"
                    return "Battery: " & batteryLevel
                    '''
                },
                skip_confirmation=True
            )
            logger.info(f"Result: {json.dumps(result, indent=2)}")
        
    except Exception as e:
        logger.error(f"Test failed: {e}", exc_info=True)
    finally:
        logger.info("\nStopping router...")
        await router.stop()

if __name__ == "__main__":
    asyncio.run(test_integration())