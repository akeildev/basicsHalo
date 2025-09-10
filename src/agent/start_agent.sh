#!/bin/bash

# Activate virtual environment and run the agent
echo "Starting LiveKit Voice Agent..."

# Navigate to agent directory
cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Run the agent
python run_agent.py

# Deactivate when done
deactivate