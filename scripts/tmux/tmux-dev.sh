#!/bin/bash

# ========================================
# Elysia Project Development Environment
# Multi-role Tmux Workspace
# ========================================

SESSION_NAME="elysia-dev"
PROJECT_DIR="/home/clearzero22/my_projects/elysia"

cleanup() {
    echo ""
    echo "Cleaning up..."
    tmux kill-session -t $SESSION_NAME 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

echo "========================================"
echo " Elysia Development Environment"
echo "========================================"

# Check dependencies
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "Warning: $1 not found"
        return 1
    fi
    return 0
}

check_command "tmux" || { echo "Error: tmux required"; exit 1; }
check_command "nvim" || echo "Warning: nvim not found"
check_command "lazygit" || echo "Warning: lazygit not found"
check_command "claude" || echo "Warning: claude not found"

# Kill existing session
tmux kill-session -t $SESSION_NAME 2>/dev/null

echo ""
echo "Creating tmux session: $SESSION_NAME"
echo "Project directory: $PROJECT_DIR"
echo ""

# ========================================
# Helper function to setup window layout
#
# Split order:
#   1. split-window -h  -> pane1(left), pane2(right)
#   2. select pane1, split-window -v -> pane1(top-left), pane2(bottom-left), pane3(right)
#
# Final layout:
#   +-------------------+-------------------+
#   |                   |                   |
#   |   Claude Code     |                   |
#   |     (pane1)       |     Neovim        |
#   +-------------------+     (pane3)       |
#   |                   |                   |
#   |     Lazygit       |                   |
#   |     (pane2)       |                   |
#   +-------------------+-------------------+
# ========================================
setup_window() {
    local window_name=$1
    local role_description=$2

    # Create window
    tmux new-window -t $SESSION_NAME -n "$window_name" -c "$PROJECT_DIR"

    # Step 1: Split horizontally (left | right)
    tmux split-window -h -t $SESSION_NAME:"$window_name" -c "$PROJECT_DIR"

    # Step 2: Select left pane and split vertically (top | bottom)
    tmux select-pane -t $SESSION_NAME:"$window_name".1
    tmux split-window -v -t $SESSION_NAME:"$window_name" -c "$PROJECT_DIR"

    # Now: pane1(top-left) | pane2(bottom-left) | pane3(right)

    # Pane 1: Claude Code (top-left)
    tmux send-keys -t $SESSION_NAME:"$window_name".1 "clear && echo '=== $window_name - Claude Code ===' && echo 'Role: $role_description' && echo ''" Enter
    if command -v claude &> /dev/null; then
        tmux send-keys -t $SESSION_NAME:"$window_name".1 "claude" Enter
    else
        tmux send-keys -t $SESSION_NAME:"$window_name".1 "echo 'claude not installed'"
    fi

    # Pane 2: Lazygit (bottom-left)
    tmux send-keys -t $SESSION_NAME:"$window_name".2 "clear && echo '=== $window_name - Lazygit ==='" Enter
    if command -v lazygit &> /dev/null; then
        tmux send-keys -t $SESSION_NAME:"$window_name".2 "lazygit" Enter
    else
        tmux send-keys -t $SESSION_NAME:"$window_name".2 "echo 'lazygit not installed'"
    fi

    # Pane 3: Neovim (right, full height)
    tmux send-keys -t $SESSION_NAME:"$window_name".3 "clear && echo '=== $window_name - Neovim ==='" Enter
    if command -v nvim &> /dev/null; then
        tmux send-keys -t $SESSION_NAME:"$window_name".3 "nvim ." Enter
    else
        tmux send-keys -t $SESSION_NAME:"$window_name".3 "echo 'nvim not installed'"
    fi
}

# ========================================
# Create session with first window (Architect)
# ========================================
tmux new-session -d -s $SESSION_NAME -c "$PROJECT_DIR" -n "architect"

# Step 1: Split horizontally (left | right)
tmux split-window -h -t $SESSION_NAME:architect -c "$PROJECT_DIR"

# Step 2: Select left pane and split vertically
tmux select-pane -t $SESSION_NAME:architect.1
tmux split-window -v -t $SESSION_NAME:architect -c "$PROJECT_DIR"

# Pane 1: Claude Code (top-left)
tmux send-keys -t $SESSION_NAME:architect.1 "clear && echo '=== ARCHITECT - Claude Code ===' && echo 'Role: System design, architecture decisions' && echo ''" Enter
if command -v claude &> /dev/null; then
    tmux send-keys -t $SESSION_NAME:architect.1 "claude" Enter
else
    tmux send-keys -t $SESSION_NAME:architect.1 "echo 'claude not installed'"
fi

# Pane 2: Lazygit (bottom-left)
tmux send-keys -t $SESSION_NAME:architect.2 "clear && echo '=== ARCHITECT - Lazygit ==='" Enter
if command -v lazygit &> /dev/null; then
    tmux send-keys -t $SESSION_NAME:architect.2 "lazygit" Enter
else
    tmux send-keys -t $SESSION_NAME:architect.2 "echo 'lazygit not installed'"
fi

# Pane 3: Neovim (right, full height)
tmux send-keys -t $SESSION_NAME:architect.3 "clear && echo '=== ARCHITECT - Neovim ==='" Enter
if command -v nvim &> /dev/null; then
    tmux send-keys -t $SESSION_NAME:architect.3 "nvim ." Enter
else
    tmux send-keys -t $SESSION_NAME:architect.3 "echo 'nvim not installed'"
fi

# ========================================
# Window 2: UX/UI Designer
# ========================================
setup_window "ux-ui" "User experience, interface design"

# ========================================
# Window 3: Backend Engineer
# ========================================
setup_window "backend" "API, database, server logic"

# ========================================
# Window 4: Frontend Engineer
# ========================================
setup_window "frontend" "UI components, client logic"

# ========================================
# Window 5: Code Reviewer
# ========================================
setup_window "review" "Code review, quality assurance"

# ========================================
# Set default window and pane
# ========================================
tmux select-window -t $SESSION_NAME:architect
tmux select-pane -t $SESSION_NAME:architect.1

# Show usage
echo "Tmux session created successfully!"
echo ""
echo "Session: $SESSION_NAME"
echo "Project: $PROJECT_DIR"
echo ""
echo "========================================"
echo " Windows (Roles)"
echo "========================================"
echo "  0. architect  - System design, architecture"
echo "  1. ux-ui      - User experience, interface"
echo "  2. backend    - API, database, server"
echo "  3. frontend   - UI components, client"
echo "  4. review     - Code review, QA"
echo ""
echo "========================================"
echo " Pane Layout (each window)"
echo "========================================"
echo "  +-------------------+-------------------+"
echo "  |                   |                   |"
echo "  |   Claude Code     |                   |"
echo "  |     (pane1)       |     Neovim        |"
echo "  +-------------------+     (pane3)       |"
echo "  |                   |                   |"
echo "  |     Lazygit       |                   |"
echo "  |     (pane2)       |                   |"
echo "  +-------------------+-------------------+"
echo ""
echo "========================================"
echo " Tmux Shortcuts"
echo "========================================"
echo "  Ctrl+b q         Show pane numbers"
echo "  Ctrl+b o         Next pane"
echo "  Ctrl+b up/down   Switch pane vertical"
echo "  Ctrl+b left/right Switch pane horizontal"
echo "  Ctrl+b 0-4       Switch window (role)"
echo "  Ctrl+b n/p       Next/Previous window"
echo "  Ctrl+b d         Detach (keep running)"
echo "  Ctrl+b z         Toggle pane fullscreen"
echo "  Ctrl+b x         Close current pane"
echo ""
echo "========================================"
echo " Commands"
echo "========================================"
echo "  tmux attach -t $SESSION_NAME        # Reconnect"
echo "  tmux kill-session -t $SESSION_NAME  # Kill"
echo ""

# Auto attach
echo "Press Enter to attach to tmux session..."
read -r
tmux attach -t $SESSION_NAME
