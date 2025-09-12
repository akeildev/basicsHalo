#!/usr/bin/env python3
"""
Test AppleScript MCP server connection
"""

import asyncio
import json
import logging
from mcp_router import McpToolRouter
from pathlib import Path

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("test-mcp")

async def test_applescript_mcp():
    """Test the AppleScript MCP server"""
    
    config_path = Path(__file__).parent / "mcp.config.json"
    logger.info(f"Loading config from: {config_path}")
    
    # Create router
    router = McpToolRouter(str(config_path))
    
    try:
        # Start router
        logger.info("Starting MCP router...")
        await router.start()
        
        # Wait for tools to be discovered
        await asyncio.sleep(2)
        
        # Check tools
        logger.info(f"Total tools available: {len(router.tools)}")
        
        if router.tools:
            logger.info("Available tools:")
            for tool in router.tools:
                logger.info(f"  - {tool.name}: {tool.description}")
                logger.info(f"    Server: {tool.server_id}")
                logger.info(f"    Schema: {json.dumps(tool.schema, indent=4)}")
        else:
            logger.warning("No tools discovered!")
            
        # Try a simple AppleScript if tools are available
        applescript_tool = router.get_tool_by_name("run_applescript")
        if applescript_tool:
            logger.info("Testing AppleScript execution...")
            result = await router.call_tool(
                applescript_tool,
                {"script": 'display notification "MCP Test" with title "Hello from MCP"'},
                timeout=10
            )
            logger.info(f"AppleScript result: {result}")
        
    except Exception as e:
        logger.error(f"Test failed: {e}", exc_info=True)
    finally:
        logger.info("Stopping router...")
        await router.stop()

if __name__ == "__main__":
    asyncio.run(test_applescript_mcp())