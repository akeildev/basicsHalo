#!/usr/bin/env python3
"""
Test creating a reminder using AppleScript MCP
"""

import asyncio
import logging
from datetime import datetime, timedelta
from mcp_router import McpToolRouter

logging.basicConfig(level=logging.INFO)

async def create_reminder():
    router = McpToolRouter('mcp.config.json')
    await router.start()
    
    print(f'Tools available: {len(router.tools)}')
    
    if router.tools:
        tool = router.tools[0]
        
        # Get today's date at 5pm
        today_5pm = datetime.now().replace(hour=17, minute=0, second=0)
        date_str = today_5pm.strftime("%m/%d/%Y %I:%M %p")
        
        # AppleScript to create a reminder
        applescript = f'''
        tell application "Reminders"
            set newReminder to make new reminder
            set name of newReminder to "Test Reminder from Halo"
            set remind me date of newReminder to date "{date_str}"
            set body of newReminder to "This is a test reminder created by the Halo MCP system"
            return "Reminder created: " & name of newReminder
        end tell
        '''
        
        print(f"Creating reminder for: {date_str}")
        print("Executing AppleScript...")
        
        result = await router.call_tool(
            tool,
            {'code_snippet': applescript},
            timeout=10
        )
        
        print(f'Result: {result}')
        
        # Also try a simpler version that might work better
        simple_script = '''
        tell application "Reminders"
            make new reminder with properties {name:"Test Reminder - 5pm Today", remind me date:current date}
            return "Reminder created successfully"
        end tell
        '''
        
        print("\nTrying simpler version...")
        result2 = await router.call_tool(
            tool,
            {'code_snippet': simple_script},
            timeout=10
        )
        print(f'Simple result: {result2}')
    
    await router.stop()

if __name__ == "__main__":
    asyncio.run(create_reminder())