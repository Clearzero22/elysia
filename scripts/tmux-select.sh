#!/bin/bash

# ========================================
# Tmux Session Selector
# Quick select and attach to tmux sessions
# ========================================

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux not installed"
    exit 1
fi

# Get list of sessions
sessions=$(tmux list-sessions -F "#{session_name}" 2>/dev/null)

if [ -z "$sessions" ]; then
    echo "No tmux sessions found"
    echo ""
    echo "Create a new session:"
    echo "  tmux new -s <name>"
    exit 0
fi

# Convert to array
mapfile -t session_array <<< "$sessions"
count=${#session_array[@]}

# Use fzf if available (best experience)
if command -v fzf &> /dev/null; then
    selected=$(echo "$sessions" | fzf --height=~100% \
        --prompt="Select session> " \
        --preview="tmux capture-pane -t {} -p | head -50" \
        --header="↑↓:Navigate  Enter:Select  Esc:Cancel")
    if [ -n "$selected" ]; then
        tmux attach -t "$selected"
    fi
    exit 0
fi

# Fallback: simple select menu with numbers
echo "========================================"
echo " Tmux Sessions"
echo "========================================"
echo ""

for i in "${!session_array[@]}"; do
    printf "  [%d] %s\n" $((i+1)) "${session_array[$i]}"
done
echo ""
echo "  [q] Quit"
echo ""
echo "========================================"

read -p "Select (1-$count or q): " choice

if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
    echo "Bye!"
    exit 0
fi

if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "$count" ]; then
    index=$((choice-1))
    selected="${session_array[$index]}"
    echo "Attaching to: $selected"
    tmux attach -t "$selected"
else
    echo "Invalid choice"
    exit 1
fi
