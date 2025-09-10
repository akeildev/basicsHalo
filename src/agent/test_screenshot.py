#!/usr/bin/env python3
"""
Test script for screenshot functionality
Run this to verify the screenshot tool is working correctly
"""

import asyncio
import aiohttp
import json
import base64
from datetime import datetime

async def test_screenshot_bridge():
    """Test the WebSocket connection to the screenshot bridge"""
    ws_url = "ws://127.0.0.1:8765"
    
    print(f"\n{'='*60}")
    print("Screenshot Bridge Test")
    print(f"{'='*60}\n")
    
    try:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Connecting to {ws_url}...")
        
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.ws_connect(ws_url) as ws:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Connected successfully!")
                
                # Test 1: Ping test
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Test 1: Sending ping...")
                await ws.send_json({"action": "ping"})
                response = await ws.receive_json()
                if response.get("action") == "pong":
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Ping successful!")
                else:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Unexpected ping response:", response)
                
                # Test 2: Screenshot capture
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Test 2: Requesting screenshot...")
                await ws.send_json({
                    "action": "capture_screenshot",
                    "region": "full",
                    "quality": 85
                })
                
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Waiting for screenshot...")
                response = await ws.receive_json()
                
                if response.get("success"):
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Screenshot captured successfully!")
                    
                    # Display metadata
                    metadata = response.get("metadata", {})
                    print(f"\nScreenshot Details:")
                    print(f"  - Resolution: {metadata.get('width')}x{metadata.get('height')}")
                    print(f"  - Capture time: {metadata.get('captureTime')}ms")
                    print(f"  - Data size: {metadata.get('dataSize')} bytes")
                    
                    # Verify base64 data
                    base64_data = response.get("base64", "")
                    if base64_data:
                        # Try to decode to verify it's valid base64
                        try:
                            decoded = base64.b64decode(base64_data)
                            print(f"  - Decoded size: {len(decoded)} bytes")
                            print(f"  - Base64 valid: ✅")
                        except Exception as e:
                            print(f"  - Base64 validation failed: {e}")
                    
                    # Optional: Save screenshot to file for manual verification
                    save_screenshot = input("\nSave screenshot to file for verification? (y/n): ")
                    if save_screenshot.lower() == 'y':
                        filename = f"test_screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                        with open(filename, 'wb') as f:
                            f.write(base64.b64decode(base64_data))
                        print(f"Screenshot saved to: {filename}")
                else:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Screenshot failed:", response.get("error"))
                
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Closing connection...")
                
    except aiohttp.ClientError as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Connection error: {e}")
        print("\nMake sure:")
        print("1. The Electron app is running")
        print("2. The screenshot bridge is initialized")
        print("3. No firewall is blocking port 8765")
        
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Unexpected error: {e}")
    
    print(f"\n{'='*60}")
    print("Test Complete")
    print(f"{'='*60}\n")

async def test_vision_api():
    """Test the OpenAI Vision API integration"""
    print(f"\n{'='*60}")
    print("OpenAI Vision API Test")
    print(f"{'='*60}\n")
    
    from openai import AsyncOpenAI
    import os
    
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY not set in environment")
        print("Please set your OpenAI API key first")
        return
    
    client = AsyncOpenAI()
    
    # Create a simple test image (base64 encoded 1x1 red pixel)
    test_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
    
    try:
        print("Testing GPT-4o vision capabilities...")
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "What color is this image?"},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{test_image}",
                            "detail": "auto"
                        }
                    }
                ]
            }],
            max_tokens=100,
            temperature=0.7
        )
        
        result = response.choices[0].message.content
        print(f"✅ Vision API test successful!")
        print(f"Response: {result}")
        
    except Exception as e:
        print(f"❌ Vision API test failed: {e}")

async def main():
    """Run all tests"""
    print("\n🚀 Starting Screenshot Integration Tests\n")
    
    # Test 1: WebSocket Bridge
    await test_screenshot_bridge()
    
    # Test 2: Vision API (optional)
    test_vision = input("\nTest OpenAI Vision API? (y/n): ")
    if test_vision.lower() == 'y':
        await test_vision_api()
    
    print("\n✨ All tests complete!\n")

if __name__ == "__main__":
    asyncio.run(main())