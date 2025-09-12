"""
Action Namer - Converts tool names and arguments to human-friendly descriptions
No tool names are exposed to users, only natural language descriptions
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import re

logger = logging.getLogger("action-namer")

class ActionNamer:
    """Converts MCP tool calls to human-friendly descriptions"""
    
    def __init__(self):
        # Map tool patterns to description templates
        self.patterns = {
            # AppleScript tools
            "reminders": {
                "create": "create a reminder for {title}",
                "list": "check your reminders",
                "complete": "mark the reminder as done",
                "delete": "remove that reminder"
            },
            "calendar": {
                "create": "add a calendar event for {title}",
                "list": "check your calendar",
                "update": "update the calendar event",
                "delete": "remove that calendar event"
            },
            "messages": {
                "send": "send a message to {recipient}",
                "read": "check your messages",
                "search": "search your messages"
            },
            "spotlight": {
                "search": "search for {query}",
                "files": "find files matching {pattern}",
                "apps": "search for applications"
            },
            "file": {
                "read": "read the file {path}",
                "write": "save content to {path}",
                "create": "create a new file",
                "delete": "delete that file",
                "move": "move the file",
                "copy": "copy the file"
            },
            "shell": {
                "exec": "run a system command",
                "script": "execute a script"
            },
            "screenshot": {
                "capture": "take a screenshot",
                "save": "save the screenshot"
            },
            "system": {
                "info": "check system information",
                "battery": "check your battery level",
                "wifi": "check WiFi status",
                "volume": "adjust the volume",
                "brightness": "adjust screen brightness"
            },
            # Generic MCP tools
            "web": {
                "search": "search the web for {query}",
                "fetch": "get information from {url}"
            },
            "filesystem": {
                "list": "list files in {directory}",
                "read": "read {file}",
                "write": "write to {file}"
            }
        }
    
    def describe(self, tool_name: str, args: Dict[str, Any]) -> str:
        """
        Convert tool name and arguments to human-friendly description
        
        Args:
            tool_name: Name of the MCP tool
            args: Arguments being passed to the tool
            
        Returns:
            Human-friendly description of the action
        """
        try:
            # Clean tool name (remove server prefix if present)
            clean_name = tool_name.split('.')[-1] if '.' in tool_name else tool_name
            
            # Try specific patterns first
            description = self._match_pattern(clean_name, args)
            if description:
                return description
            
            # Fallback to generic descriptions
            return self._generic_description(clean_name, args)
            
        except Exception as e:
            logger.error(f"Error generating description: {e}")
            return "perform that action"
    
    def _match_pattern(self, tool_name: str, args: Dict[str, Any]) -> Optional[str]:
        """Match tool name against known patterns"""
        
        # Extract category and action from tool name
        # Examples: reminders_create, calendar.event.create, file-read
        parts = re.split(r'[._\-]', tool_name.lower())
        
        for category, actions in self.patterns.items():
            if category in parts:
                for action, template in actions.items():
                    if action in parts:
                        return self._fill_template(template, args)
        
        # Special cases for AppleScript MCP
        if "reminder" in tool_name.lower():
            return self._describe_reminder(tool_name, args)
        elif "calendar" in tool_name.lower() or "event" in tool_name.lower():
            return self._describe_calendar(tool_name, args)
        elif "message" in tool_name.lower():
            return self._describe_message(tool_name, args)
        elif "spotlight" in tool_name.lower() or "search" in tool_name.lower():
            return self._describe_search(tool_name, args)
        elif "shell" in tool_name.lower() or "exec" in tool_name.lower():
            return self._describe_shell(tool_name, args)
        elif "file" in tool_name.lower():
            return self._describe_file(tool_name, args)
        
        return None
    
    def _describe_reminder(self, tool_name: str, args: Dict[str, Any]) -> str:
        """Generate description for reminder actions"""
        if "create" in tool_name.lower() or "add" in tool_name.lower():
            title = args.get("title", args.get("name", "a reminder"))
            due = args.get("due_date", args.get("date", ""))
            if due:
                return f"create a reminder for {title} on {self._format_date(due)}"
            return f"create a reminder for {title}"
        elif "complete" in tool_name.lower() or "done" in tool_name.lower():
            return "mark that reminder as done"
        elif "delete" in tool_name.lower() or "remove" in tool_name.lower():
            return "remove that reminder"
        elif "list" in tool_name.lower() or "get" in tool_name.lower():
            return "check your reminders"
        return "manage your reminders"
    
    def _describe_calendar(self, tool_name: str, args: Dict[str, Any]) -> str:
        """Generate description for calendar actions"""
        if "create" in tool_name.lower() or "add" in tool_name.lower():
            title = args.get("title", args.get("event", "an event"))
            start = args.get("start_time", args.get("start", ""))
            if start:
                return f"add '{title}' to your calendar at {self._format_time(start)}"
            return f"add '{title}' to your calendar"
        elif "delete" in tool_name.lower() or "remove" in tool_name.lower():
            return "remove that calendar event"
        elif "update" in tool_name.lower() or "modify" in tool_name.lower():
            return "update that calendar event"
        elif "list" in tool_name.lower() or "get" in tool_name.lower():
            return "check your calendar"
        return "manage your calendar"
    
    def _describe_message(self, tool_name: str, args: Dict[str, Any]) -> str:
        """Generate description for message actions"""
        if "send" in tool_name.lower():
            recipient = args.get("recipient", args.get("to", "someone"))
            message = args.get("message", args.get("text", ""))
            if message and len(message) > 30:
                message = message[:27] + "..."
            if message:
                return f"send '{message}' to {recipient}"
            return f"send a message to {recipient}"
        elif "read" in tool_name.lower() or "get" in tool_name.lower():
            return "check your messages"
        elif "search" in tool_name.lower():
            query = args.get("query", "")
            if query:
                return f"search messages for '{query}'"
            return "search your messages"
        return "manage messages"
    
    def _describe_search(self, tool_name: str, args: Dict[str, Any]) -> str:
        """Generate description for search actions"""
        query = args.get("query", args.get("q", args.get("search", "")))
        location = args.get("location", args.get("folder", ""))
        
        if "file" in tool_name.lower():
            if location:
                return f"search for files in {location}"
            return f"search for '{query}'" if query else "search for files"
        elif "app" in tool_name.lower():
            return f"search for applications"
        else:
            if query:
                return f"search for '{query}'"
            return "perform a search"
    
    def _describe_shell(self, tool_name: str, args: Dict[str, Any]) -> str:
        """Generate description for shell/system actions"""
        command = args.get("command", args.get("cmd", ""))
        
        # Recognize common commands
        if command:
            if "battery" in command.lower() or "pmset" in command:
                return "check your battery level"
            elif "wifi" in command.lower() or "airport" in command:
                return "check WiFi status"
            elif "volume" in command.lower():
                return "adjust the volume"
            elif "brightness" in command.lower():
                return "adjust screen brightness"
            elif "df" in command or "disk" in command.lower():
                return "check disk space"
            elif "ps" in command or "process" in command.lower():
                return "check running processes"
            elif "ls" in command:
                return "list files"
            elif "cat" in command or "less" in command:
                return "read a file"
        
        return "run a system command"
    
    def _describe_file(self, tool_name: str, args: Dict[str, Any]) -> str:
        """Generate description for file operations"""
        path = args.get("path", args.get("file", args.get("filename", "")))
        
        if "read" in tool_name.lower():
            if path:
                filename = path.split('/')[-1] if '/' in path else path
                return f"read {filename}"
            return "read a file"
        elif "write" in tool_name.lower() or "save" in tool_name.lower():
            if path:
                filename = path.split('/')[-1] if '/' in path else path
                return f"save content to {filename}"
            return "save content to a file"
        elif "create" in tool_name.lower():
            return f"create a new file"
        elif "delete" in tool_name.lower() or "remove" in tool_name.lower():
            if path:
                filename = path.split('/')[-1] if '/' in path else path
                return f"delete {filename}"
            return "delete a file"
        elif "move" in tool_name.lower():
            return "move a file"
        elif "copy" in tool_name.lower():
            return "copy a file"
        elif "list" in tool_name.lower():
            return f"list files in {path}" if path else "list files"
        
        return "manage files"
    
    def _generic_description(self, tool_name: str, args: Dict[str, Any]) -> str:
        """Generate generic description when no pattern matches"""
        
        # Special handling for applescript_execute tool
        if "applescript" in tool_name.lower() or tool_name == "applescript_execute":
            code = args.get("code_snippet", "")
            
            # Parse common AppleScript patterns
            if "display notification" in code.lower():
                return "show a notification on your screen"
            elif "tell application \"Notes\"" in code.lower():
                if "make new note" in code.lower():
                    return "create a new note"
                elif "get notes" in code.lower():
                    return "retrieve your notes"
            elif "tell application \"Calendar\"" in code.lower():
                if "make new event" in code.lower():
                    # Try to extract event details
                    import re
                    summary_match = re.search(r'summary:"([^"]+)"', code)
                    if summary_match:
                        return f"add '{summary_match.group(1)}' to your calendar"
                    return "add an event to your calendar"
                elif "get events" in code.lower():
                    return "check your calendar"
            elif "tell application \"Reminders\"" in code.lower():
                if "make new reminder" in code.lower():
                    # Try to extract reminder details
                    import re
                    name_match = re.search(r'name:"([^"]+)"', code)
                    if name_match:
                        return f"create a reminder for '{name_match.group(1)}'"
                    return "create a reminder"
                elif "get reminders" in code.lower():
                    return "check your reminders"
            elif "tell application \"Messages\"" in code.lower():
                return "send a message"
            elif "tell application \"Mail\"" in code.lower():
                return "handle email"
            elif "tell application \"Finder\"" in code.lower():
                return "work with files"
            elif "tell application \"Safari\"" in code.lower():
                return "interact with Safari"
            elif "system info" in code.lower() or "system information" in code.lower():
                return "get system information"
            else:
                return "run an automation script"
        
        # Try to make it somewhat meaningful
        action_words = {
            "create": "create",
            "add": "add",
            "delete": "remove",
            "remove": "remove",
            "update": "update",
            "modify": "modify",
            "get": "check",
            "list": "list",
            "read": "read",
            "write": "write",
            "send": "send",
            "search": "search for",
            "find": "find",
            "exec": "execute",
            "run": "run"
        }
        
        # Find action word
        tool_lower = tool_name.lower()
        for key, value in action_words.items():
            if key in tool_lower:
                # Try to find a target from args
                target = self._extract_target(args)
                if target:
                    return f"{value} {target}"
                return f"{value} that"
        
        # Ultimate fallback
        return "perform that action"
    
    def _fill_template(self, template: str, args: Dict[str, Any]) -> str:
        """Fill template with argument values"""
        result = template
        
        for key, value in args.items():
            placeholder = f"{{{key}}}"
            if placeholder in result:
                # Format value appropriately
                if isinstance(value, str) and len(value) > 50:
                    value = value[:47] + "..."
                result = result.replace(placeholder, str(value))
        
        # Remove any unfilled placeholders
        result = re.sub(r'\{[^}]+\}', 'that', result)
        
        return result
    
    def _extract_target(self, args: Dict[str, Any]) -> Optional[str]:
        """Extract the main target/object from arguments"""
        
        # Common argument names for targets
        target_keys = ["title", "name", "file", "path", "query", "recipient", "to", "target", "object"]
        
        for key in target_keys:
            if key in args and args[key]:
                value = str(args[key])
                # Shorten if too long
                if len(value) > 30:
                    value = value[:27] + "..."
                return value
        
        return None
    
    def _format_date(self, date_str: str) -> str:
        """Format date string to human-readable"""
        try:
            # Try to parse various formats
            # This is simplified - extend as needed
            if "tomorrow" in date_str.lower():
                return "tomorrow"
            elif "today" in date_str.lower():
                return "today"
            else:
                # Try to extract day/time
                return date_str
        except:
            return date_str
    
    def _format_time(self, time_str: str) -> str:
        """Format time string to human-readable"""
        try:
            # Simplified time formatting
            return time_str
        except:
            return time_str

class ActionSummarizer:
    """Summarizes action results in natural language"""
    
    def summarize(self, action: str, result: Any) -> str:
        """
        Create a human-friendly summary of action results
        
        Args:
            action: The action description that was performed
            result: The result from the tool execution
            
        Returns:
            Brief, natural summary of what happened
        """
        
        # Check for common success patterns
        if isinstance(result, dict):
            if result.get("success") or result.get("ok"):
                return self._success_summary(action)
            elif result.get("error"):
                return self._error_summary(action, result.get("error"))
            elif result.get("canceled"):
                return "Okay, I won't do that."
        
        # Action-specific summaries
        if "reminder" in action.lower():
            return "Your reminder is set."
        elif "calendar" in action.lower() or "event" in action.lower():
            return "Your calendar event is added."
        elif "message" in action.lower():
            if "send" in action.lower():
                return "Message sent."
            else:
                return self._message_summary(result)
        elif "search" in action.lower():
            return self._search_summary(result)
        elif "battery" in action.lower():
            return self._battery_summary(result)
        elif "file" in action.lower():
            if "read" in action.lower():
                return self._file_read_summary(result)
            elif "save" in action.lower() or "write" in action.lower():
                return "File saved."
            elif "delete" in action.lower():
                return "File deleted."
            elif "list" in action.lower():
                return self._file_list_summary(result)
        
        # Generic success
        return "Done."
    
    def _success_summary(self, action: str) -> str:
        """Generate success summary"""
        if "create" in action or "add" in action:
            return "Created successfully."
        elif "delete" in action or "remove" in action:
            return "Removed successfully."
        elif "update" in action or "modify" in action:
            return "Updated successfully."
        elif "send" in action:
            return "Sent successfully."
        else:
            return "Done."
    
    def _error_summary(self, action: str, error: str) -> str:
        """Generate error summary"""
        if "permission" in error.lower():
            return "I don't have permission to do that."
        elif "not found" in error.lower():
            return "I couldn't find what you're looking for."
        elif "timeout" in error.lower():
            return "That took too long to complete."
        else:
            return "Something went wrong with that."
    
    def _search_summary(self, result: Any) -> str:
        """Summarize search results"""
        if isinstance(result, list):
            count = len(result)
            if count == 0:
                return "No results found."
            elif count == 1:
                return "Found one result."
            else:
                return f"Found {count} results."
        elif isinstance(result, dict) and "results" in result:
            return self._search_summary(result["results"])
        else:
            return "Search completed."
    
    def _message_summary(self, result: Any) -> str:
        """Summarize message results"""
        if isinstance(result, list):
            count = len(result)
            if count == 0:
                return "No messages."
            elif count == 1:
                return "You have one message."
            else:
                return f"You have {count} messages."
        else:
            return "Checked messages."
    
    def _battery_summary(self, result: Any) -> str:
        """Summarize battery status"""
        if isinstance(result, dict):
            level = result.get("level", result.get("percentage"))
            if level:
                return f"Battery is at {level}%."
            charging = result.get("charging", result.get("plugged_in"))
            if charging:
                return "Battery is charging."
        elif isinstance(result, str):
            # Try to extract percentage from string
            import re
            match = re.search(r'(\d+)%', result)
            if match:
                return f"Battery is at {match.group(1)}%."
        return "Checked battery status."
    
    def _file_read_summary(self, result: Any) -> str:
        """Summarize file read results"""
        if isinstance(result, str):
            length = len(result)
            if length > 500:
                return f"Read the file ({length} characters)."
            else:
                return "Read the file."
        else:
            return "File read completed."
    
    def _file_list_summary(self, result: Any) -> str:
        """Summarize file listing results"""
        if isinstance(result, list):
            count = len(result)
            if count == 0:
                return "No files found."
            elif count == 1:
                return "Found one file."
            else:
                return f"Found {count} files."
        else:
            return "Listed files."