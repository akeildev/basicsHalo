"""
Confirmation and Execution Handler
Manages user confirmation and provides filler speech during tool execution
"""

import asyncio
import hashlib
import json
import logging
import pathlib
import time
from typing import Callable, Optional, Dict, Any
from mcp_router import McpToolRouter, ToolSpec
from action_namer import ActionNamer, ActionSummarizer
from mcp_logger import MCPErrorLogger

logger = logging.getLogger("confirm-execute")

class ConfirmThenExecute:
    """Handles confirmation prompts and tool execution with filler speech"""
    
    def __init__(
        self,
        router: McpToolRouter,
        say_func: Callable[[str], asyncio.Task],
        listen_yes_no_func: Callable[[float], asyncio.Task],
        policy: dict
    ):
        self.router = router
        self.say = say_func
        self.listen_yes_no = listen_yes_no_func
        self.policy = policy
        self.execution_history = []  # Track recent executions
        self.action_namer = ActionNamer()
        self.summarizer = ActionSummarizer()
        self.error_logger = MCPErrorLogger('confirm-execute')
        
    async def _filler_speech(self, cancel_event: asyncio.Event):
        """Provide filler speech while tool is executing"""
        if not self.policy.get("filler", {}).get("enabled", True):
            return
            
        filler_config = self.policy.get("filler", {})
        first_delay = filler_config.get("first_after_ms", 600) / 1000
        interval = filler_config.get("interval_ms", 3000) / 1000
        
        # Default filler phrases
        phrases = filler_config.get("phrases", [
            "Let me work on that.",
            "Still processing...",
            "One moment...",
            "Almost there...",
            "Working on it..."
        ])
        
        # Wait before first filler
        await asyncio.sleep(first_delay)
        
        phrase_index = 0
        while not cancel_event.is_set():
            if phrase_index < len(phrases):
                await self.say(phrases[phrase_index])
                phrase_index += 1
            else:
                # Loop back to later phrases
                await self.say(phrases[-2] if len(phrases) > 1 else phrases[0])
            
            # Wait for next filler
            try:
                await asyncio.wait_for(
                    cancel_event.wait(),
                    timeout=interval
                )
                break  # Event was set
            except asyncio.TimeoutError:
                continue  # Continue with next filler
    
    def _hash_arguments(self, args: dict) -> str:
        """Create a hash of arguments for logging"""
        try:
            args_str = json.dumps(args, sort_keys=True)
            return hashlib.sha256(args_str.encode()).hexdigest()[:8]
        except Exception:
            return "unknown"
    
    def _validate_path(self, path: str) -> bool:
        """Check if a path is allowed by policy"""
        allowed_roots = self.policy.get("allowed_roots", [])
        if not allowed_roots:
            return True  # No restrictions
            
        # Expand user home directory
        path = pathlib.Path(path).expanduser()
        
        for root in allowed_roots:
            root_path = pathlib.Path(root).expanduser()
            try:
                # Check if path is within allowed root
                path.resolve().relative_to(root_path.resolve())
                return True
            except (ValueError, OSError):
                continue
                
        return False
    
    def _validate_arguments(self, tool: ToolSpec, args: dict) -> Optional[str]:
        """Validate tool arguments against policy"""
        # Check for path-based arguments
        path_keys = ["path", "file", "directory", "target", "source", "dest", "destination"]
        
        for key in path_keys:
            if key in args:
                path_value = args[key]
                if isinstance(path_value, str) and not self._validate_path(path_value):
                    return f"The path '{path_value}' is not in an allowed directory."
        
        # Additional validation can be added here
        # For example, checking against tool schema
        
        return None  # No validation errors
    
    def _needs_confirmation(self, tool: ToolSpec) -> bool:
        """Determine if a tool needs user confirmation"""
        # Always confirm sensitive tools
        if tool.sensitive:
            return True
        
        # Check if tool name contains sensitive operations
        sensitive_ops = ["delete", "remove", "write", "create", "modify", "execute"]
        tool_name_lower = tool.name.lower()
        if any(op in tool_name_lower for op in sensitive_ops):
            return True
        
        # Default policy setting
        return self.policy.get("require_confirmation", True)
    
    def _format_confirmation_prompt(self, tool: ToolSpec, args: dict) -> str:
        """Create a human-friendly confirmation prompt"""
        # Use ActionNamer to get natural description
        action = self.action_namer.describe(tool.name, args)
        
        # Special handling for calendar/reminder operations to be extra clear
        if "applescript" in tool.name.lower():
            code = args.get("code_snippet", "")
            if "calendar" in code.lower() and "make new event" in code.lower():
                # Extract event details from AppleScript if possible
                import re
                summary_match = re.search(r'summary:"([^"]+)"', code)
                event_name = summary_match.group(1) if summary_match else "this event"
                
                # Try to extract time info
                time_info = "to your calendar"
                if "current date" in code:
                    if "+ (5 * hours)" in code:
                        time_info = "for 5 hours from now"
                    elif "hours of" in code:
                        hour_match = re.search(r'hours of \w+ to (\d+)', code)
                        if hour_match:
                            hour = int(hour_match.group(1))
                            time_str = f"{hour % 12 or 12}{'pm' if hour >= 12 else 'am'}"
                            time_info = f"for {time_str} today"
                
                # Speak more clearly with emphasis
                return f"I understand. You want me to add '{event_name}' {time_info}. Should I add this event to your calendar now? Say yes or no."
                
            elif "reminders" in code.lower() and "make new reminder" in code.lower():
                # Extract reminder details from AppleScript if possible
                import re
                name_match = re.search(r'name:"([^"]+)"', code)
                reminder_name = name_match.group(1) if name_match else "this reminder"
                
                # Try to extract time info
                time_info = ""
                if "+ (5 * hours)" in code:
                    time_info = " for 5 hours from now"
                elif "hours of" in code:
                    hour_match = re.search(r'hours of \w+ to (\d+)', code)
                    if hour_match:
                        hour = int(hour_match.group(1))
                        time_str = f"{hour % 12 or 12}{'pm' if hour >= 12 else 'am'}"
                        time_info = f" for {time_str}"
                
                # Speak more clearly with emphasis
                return f"I understand. You want me to create a reminder '{reminder_name}'{time_info}. Should I create this reminder now? Say yes or no."
        
        return f"Do you want me to {action}?"
    
    async def execute(
        self,
        tool: ToolSpec,
        arguments: dict,
        timeout: Optional[float] = None,
        skip_confirmation: bool = False
    ) -> Dict[str, Any]:
        """Execute a tool with confirmation and filler speech"""
        
        # Get human-friendly action description
        action = self.action_namer.describe(tool.name, arguments)
        
        # Validate arguments
        validation_error = self._validate_arguments(tool, arguments)
        if validation_error:
            logger.warning(f"Validation failed for {tool.name}: {validation_error}")
            self.error_logger.log_validation_error(tool.name, arguments, validation_error)
            await self.say(validation_error)
            return {
                "success": False,
                "error": validation_error,
                "tool": tool.name,
                "action": action
            }
        
        # Special handling for calendar/reminder operations - skip redundant announcement
        skip_announcement = False
        if "applescript" in tool.name.lower():
            code = arguments.get("code_snippet", "")
            if ("calendar" in code.lower() and "make new event" in code.lower()) or \
               ("reminders" in code.lower() and "make new reminder" in code.lower()):
                skip_announcement = True
        
        # Announce the action first (no tool names) - unless it's calendar/reminder
        if not skip_announcement:
            await self.say(f"I'll {action}.")
        
        # Check if confirmation is needed
        if not skip_confirmation and self._needs_confirmation(tool):
            # Ask for confirmation using natural language
            prompt = self._format_confirmation_prompt(tool, arguments)
            logger.info(f"[CONFIRMATION] Speaking prompt: '{prompt}'")
            
            # Ensure the prompt is spoken clearly
            await self.say(prompt)
            
            # Give user a moment to process the question
            await asyncio.sleep(0.5)
            
            # Listen for yes/no response
            confirm_timeout = self.policy.get("confirm_timeout_sec", 6)
            logger.info(f"[CONFIRMATION] Waiting for user response (timeout: {confirm_timeout}s)")
            try:
                confirmed = await self.listen_yes_no(confirm_timeout)
                logger.info(f"[CONFIRMATION] User responded: {'YES' if confirmed else 'NO'}")
            except asyncio.TimeoutError:
                logger.info(f"Confirmation timeout for {tool.name}")
                self.error_logger.log_confirmation_timeout(tool.name, confirm_timeout)
                await self.say("I didn't hear a response, so I'll cancel that.")
                return {
                    "success": False,
                    "error": "Confirmation timeout",
                    "tool": tool.name,
                    "action": action
                }
            
            if not confirmed:
                logger.info(f"User declined {tool.name}")
                await self.say("Okay, I won't do that.")
                return {
                    "success": False,
                    "error": "User declined",
                    "tool": tool.name,
                    "action": action,
                    "canceled": True
                }
        
        # Start execution with filler speech
        cancel_event = asyncio.Event()
        filler_task = asyncio.create_task(self._filler_speech(cancel_event))
        
        try:
            # Execute the tool
            if timeout is None:
                timeout = self.policy.get("tool_timeout_sec", 25)
            
            logger.info(f"Executing {tool.name}: {action}")
            start_time = time.time()
            
            result = await self.router.call_tool(tool, arguments, timeout)
            
            duration = time.time() - start_time
            logger.info(f"✓ {tool.name} completed in {duration:.2f}s")
            self.error_logger.log_successful_execution(tool.name, duration)
            
            # Stop filler speech
            cancel_event.set()
            await asyncio.sleep(0.1)  # Let filler task finish
            
            # Use summarizer for natural language result
            summary = self.summarizer.summarize(action, result)
            await self.say(summary)
            
            # Record in history
            self.execution_history.append({
                "tool": tool.name,
                "action": action,
                "args_hash": self._hash_arguments(arguments),
                "success": True,
                "timestamp": asyncio.get_event_loop().time(),
                "duration": duration
            })
            
            return {
                "success": True,
                "tool": tool.name,
                "action": action,
                "result": result,
                "summary": summary,
                "args_hash": self._hash_arguments(arguments)
            }
            
        except asyncio.TimeoutError as e:
            cancel_event.set()
            await asyncio.sleep(0.1)
            logger.error(f"Timeout executing {tool.name} after {timeout}s")
            self.error_logger.log_tool_execution_error(tool.name, arguments, e)
            await self.say("The tool is taking too long to respond.")
            return {
                "success": False,
                "error": "Tool timeout",
                "tool": tool.name,
                "action": action
            }
            
        except Exception as e:
            cancel_event.set()
            await asyncio.sleep(0.1)
            logger.error(f"Error executing {tool.name}: {e}")
            self.error_logger.log_tool_execution_error(tool.name, arguments, e)
            
            error_msg = str(e)
            if "not found" in error_msg.lower():
                await self.say("I couldn't find what you're looking for.")
            elif "permission" in error_msg.lower():
                await self.say("I don't have permission to do that.")
            else:
                await self.say("Something went wrong with that tool.")
            
            logger.error(f"Tool execution error: {e}")
            
            return {
                "success": False,
                "error": str(e),
                "tool": tool.name
            }
            
        finally:
            # Ensure filler task is cancelled
            if not filler_task.done():
                filler_task.cancel()
                try:
                    await filler_task
                except asyncio.CancelledError:
                    pass
    
    def get_recent_executions(self, limit: int = 5) -> list:
        """Get recent tool executions for context"""
        return self.execution_history[-limit:] if self.execution_history else []