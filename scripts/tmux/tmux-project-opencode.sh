#!/bin/bash

# ========================================
# Universal Tmux Development Environment (OpenCode Version)
# Usage: ./tmux-project-opencode.sh [project-directory]
# 8 Windows: architect, ux-ui, backend, frontend, review, devops, qa, docs
# ========================================

# Default to current directory if no argument provided
PROJECT_DIR="${1:-$(pwd)}"
PROJECT_NAME=$(basename "$PROJECT_DIR" | tr '.' '-')
SESSION_NAME="opencode-${PROJECT_NAME}"

cleanup() {
    echo ""
    echo "Cleaning up..."
    tmux kill-session -t $SESSION_NAME 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

# Help message
show_help() {
    echo "Usage: $0 [options] [project-directory]"
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo "  -n, --name      Specify session name"
    echo ""
    echo "Windows (8 roles):"
    echo "  0. architect  - System design, architecture"
    echo "  1. ux-ui      - User experience, interface"
    echo "  2. backend    - API, database, server"
    echo "  3. frontend   - UI components, client"
    echo "  4. review     - Code review, QA"
    echo "  5. devops     - CI/CD, deployment, infra"
    echo "  6. qa         - Testing, quality assurance"
    echo "  7. docs       - Documentation"
    echo ""
    echo "Examples:"
    echo "  $0 ~/my-projects/my-app"
    echo "  $0 ."
    echo "  $0 -n my-session /path/to/project"
    echo ""
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            ;;
        -n|--name)
            SESSION_NAME="$2"
            shift 2
            ;;
        *)
            PROJECT_DIR="$1"
            shift
            ;;
    esac
done

# Validate project directory
if [[ ! -d "$PROJECT_DIR" ]]; then
    echo "Error: Directory '$PROJECT_DIR' does not exist"
    exit 1
fi

# Convert to absolute path
PROJECT_DIR=$(cd "$PROJECT_DIR" && pwd)
PROJECT_NAME=$(basename "$PROJECT_DIR" | tr '.' '-')

# Window definitions
declare -A WINDOWS=(
    ["architect"]="System design, architecture decisions"
    ["ux-ui"]="User experience, interface design"
    ["backend"]="API, database, server logic"
    ["frontend"]="UI components, client logic"
    ["review"]="Code review, quality assurance"
    ["devops"]="CI/CD, deployment, infrastructure"
    ["qa"]="Testing, quality assurance"
    ["docs"]="Documentation, README, guides"
)

WINDOW_NAMES=("architect" "ux-ui" "backend" "frontend" "review" "devops" "qa" "docs")

echo "========================================"
echo " Universal Dev Environment (OpenCode)"
echo "========================================"
echo ""
echo "Project: $PROJECT_DIR"
echo "Session: $SESSION_NAME"
echo ""

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
check_command "opencode" || echo "Warning: opencode not found"

# Kill existing session with same name
tmux kill-session -t $SESSION_NAME 2>/dev/null

# ========================================
# Helper function to setup window layout
# Layout:
#   +-------------------+-------------------+
#   |                   |                   |
#   |     OpenCode      |                   |
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
    local is_first=$3

    if [ "$is_first" = "true" ]; then
        # First window is created with session
        tmux rename-window -t $SESSION_NAME:1 "$window_name"
    else
        # Create new window
        tmux new-window -t $SESSION_NAME -n "$window_name" -c "$PROJECT_DIR"
    fi

    # Step 1: Split horizontally (left | right)
    tmux split-window -h -t $SESSION_NAME:"$window_name" -c "$PROJECT_DIR"

    # Step 2: Select left pane and split vertically (top | bottom)
    tmux select-pane -t $SESSION_NAME:"$window_name".1
    tmux split-window -v -t $SESSION_NAME:"$window_name" -c "$PROJECT_DIR"

    # Result: pane1(top-left) | pane2(bottom-left) | pane3(right)

    # Pane 1: OpenCode (top-left)
    tmux send-keys -t $SESSION_NAME:"$window_name".1 "clear && echo '=== $window_name - OpenCode ===' && echo 'Role: $role_description' && echo ''" Enter
    if command -v opencode &> /dev/null; then
        tmux send-keys -t $SESSION_NAME:"$window_name".1 "opencode" Enter
    else
        tmux send-keys -t $SESSION_NAME:"$window_name".1 "echo 'opencode not installed'"
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
# Create session and windows
# ========================================

# Create first session with first window
tmux new-session -d -s $SESSION_NAME -c "$PROJECT_DIR"

# Setup all windows
for i in "${!WINDOW_NAMES[@]}"; do
    window_name="${WINDOW_NAMES[$i]}"
    role_description="${WINDOWS[$window_name]}"
    is_first="false"

    if [ $i -eq 0 ]; then
        is_first="true"
    fi

    setup_window "$window_name" "$role_description" "$is_first"
done

# Select first window and OpenCode pane
tmux select-window -t $SESSION_NAME:architect
tmux select-pane -t $SESSION_NAME:architect.1

# Show usage
echo "Tmux session created!"
echo ""
echo "========================================"
echo " Windows (8 Roles)"
echo "========================================"
echo "  0. architect  - System design, architecture"
echo "  1. ux-ui      - User experience, interface"
echo "  2. backend    - API, database, server"
echo "  3. frontend   - UI components, client"
echo "  4. review     - Code review, QA"
echo "  5. devops     - CI/CD, deployment, infra"
echo "  6. qa         - Testing, quality assurance"
echo "  7. docs       - Documentation"
echo ""
echo "========================================"
echo " Pane Layout (each window)"
echo "========================================"
echo "  +-------------------+-------------------+"
echo "  |                   |                   |"
echo "  |     OpenCode      |                   |"
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
echo "  Ctrl+b 0-7       Switch window (role)"
echo "  Ctrl+b q         Show pane numbers"
echo "  Ctrl+b o         Next pane"
echo "  Ctrl+b z         Toggle pane fullscreen"
echo "  Ctrl+b d         Detach (keep running)"
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
