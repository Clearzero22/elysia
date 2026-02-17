#!/bin/bash

# ========================================
# Issue #1744: Memory Leak Test with Tmux
# Multi-window test environment
# ========================================

SESSION_NAME="elysia-memleak"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="$SCRIPT_DIR/test-file.bin"

cleanup() {
    echo ""
    echo "Cleaning up..."
    tmux kill-session -t $SESSION_NAME 2>/dev/null || true
    rm -f "$TEST_FILE"
    exit 0
}

trap cleanup INT TERM

echo "========================================"
echo " Issue #1744: Memory Leak Tmux Test"
echo "========================================"

# Check tmux
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux not found. Please install tmux first."
    echo "   Ubuntu/Debian: sudo apt install tmux"
    echo "   macOS: brew install tmux"
    exit 1
fi

# Kill existing session if any
tmux kill-session -t $SESSION_NAME 2>/dev/null

# 1. Generate test file
echo ""
echo "Generating 50MB test file..."
dd if=/dev/urandom of="$TEST_FILE" bs=1M count=50 2>/dev/null
echo "Created: $TEST_FILE"

# 2. Create tmux session
echo ""
echo "Starting tmux session: $SESSION_NAME"

# Window 0: Server
tmux new-session -d -s $SESSION_NAME -c "$SCRIPT_DIR" -n "server"
tmux send-keys -t $SESSION_NAME:server "echo 'Starting Elysia Server...'" Enter
tmux send-keys -t $SESSION_NAME:server "bun run server.ts" Enter

# Window 1: Memory Monitor
tmux new-window -t $SESSION_NAME -n "monitor" -c "$SCRIPT_DIR"
tmux send-keys -t $SESSION_NAME:monitor "echo 'Memory Monitor (updates every 1s)'" Enter
tmux send-keys -t $SESSION_NAME:monitor "echo ''" Enter
tmux send-keys -t $SESSION_NAME:monitor "watch -n 1 'echo \"=== Elysia Server Memory ===\"; ps aux | grep -E \"bun.*server\" | grep -v grep | awk \"{print \\\"PID: \\\"\\\$2 \\\"  CPU: \\\"\\\$3\\\"%  MEM: \\\"\\\$4\\\"%  RSS: \\\"int(\\\$6/1024)\\\" MB\\\"}\"; echo \"\"; echo \"=== System Memory ===\"; free -h 2>/dev/null || echo \"free not available\"'" Enter

# Window 2: Leak Test Endpoint
tmux new-window -t $SESSION_NAME -n "leak-test" -c "$SCRIPT_DIR"
tmux send-keys -t $SESSION_NAME:leak-test "echo 'Testing LEAKY endpoint: /upload-default'" Enter
tmux send-keys -t $SESSION_NAME:leak-test "echo 'Running 10 requests with 50MB file...'" Enter
tmux send-keys -t $SESSION_NAME:leak-test "echo ''" Enter
tmux send-keys -t $SESSION_NAME:leak-test "sleep 3 && for i in {1..10}; do echo \"Request \$i\"; curl -s -w 'HTTP: %{http_code}  Time: %{time_total}s\n' -X POST http://localhost:3001/upload-default -F 'file=@test-file.bin' | head -1; sleep 1; done" Enter

# Window 3: OK Test Endpoint
tmux new-window -t $SESSION_NAME -n "ok-test" -c "$SCRIPT_DIR"
tmux send-keys -t $SESSION_NAME:ok-test "echo 'Testing OK endpoint: /upload-noparse'" Enter
tmux send-keys -t $SESSION_NAME:ok-test "echo 'Running 10 requests with 50MB file...'" Enter
tmux send-keys -t $SESSION_NAME:ok-test "echo ''" Enter
tmux send-keys -t $SESSION_NAME:ok-test "echo '(Waiting for leak test to finish... run manually if needed)'" Enter
tmux send-keys -t $SESSION_NAME:ok-test "echo 'Manual test command:'" Enter
tmux send-keys -t $SESSION_NAME:ok-test "echo '  for i in {1..10}; do curl -s -X POST http://localhost:3001/upload-noparse -F \"file=@test-file.bin\"; done'" Enter

# Window 4: Interactive Shell
tmux new-window -t $SESSION_NAME -n "shell" -c "$SCRIPT_DIR"
tmux send-keys -t $SESSION_NAME:shell "echo 'Interactive Shell'" Enter
tmux send-keys -t $SESSION_NAME:shell "echo ''" Enter
tmux send-keys -t $SESSION_NAME:shell "echo 'Useful commands:'" Enter
tmux send-keys -t $SESSION_NAME:shell "echo '  curl -X POST http://localhost:3001/upload-default -F \"file=@test-file.bin\"'" Enter
tmux send-keys -t $SESSION_NAME:shell "echo '  curl -X POST http://localhost:3001/upload-noparse -F \"file=@test-file.bin\"'" Enter
tmux send-keys -t $SESSION_NAME:shell "echo '  curl http://localhost:3001/health'" Enter
tmux send-keys -t $SESSION_NAME:shell "echo ''" Enter

# Set initial window
tmux select-window -t $SESSION_NAME:server

# Show usage
echo ""
echo "Tmux session created!"
echo ""
echo "Session: $SESSION_NAME"
echo ""
echo "Windows:"
echo "   0. server     - Elysia test server"
echo "   1. monitor    - Real-time memory monitor"
echo "   2. leak-test  - Leaky endpoint test (auto run)"
echo "   3. ok-test    - OK endpoint test (manual)"
echo "   4. shell      - Interactive shell"
echo ""
echo "Tmux shortcuts:"
echo "   Ctrl+b 0-4    Switch to window 0-4"
echo "   Ctrl+b n      Next window"
echo "   Ctrl+b p      Previous window"
echo "   Ctrl+b d      Detach session (keep running)"
echo "   Ctrl+b :      Command mode"
echo "   Ctrl+b [      Copy mode (q to exit)"
echo ""
echo "Attach/Detach:"
echo "   tmux attach -t $SESSION_NAME        # Reconnect"
echo "   tmux kill-session -t $SESSION_NAME  # Kill session"
echo ""

# Auto attach
echo "Press Enter to attach to tmux session..."
read -r
tmux attach -t $SESSION_NAME
