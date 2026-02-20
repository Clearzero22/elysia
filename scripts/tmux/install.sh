#!/bin/bash

# ========================================
# Tmux Dev Tools - Universal Installer
# Supports: macOS, Linux (Ubuntu/Debian, Fedora, Arch)
# Usage: curl -fsSL <url> | bash
#        or: ./install.sh
# ========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="$HOME/.local/bin"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"  # elysia/

# Commands to install: "command_name:script_path"
declare -A COMMANDS=(
    ["tk"]="scripts/tmux/tmux-project-kimi.sh"
    ["ts"]="scripts/tmux-select.sh"
)

# Optional: Install all AI variants
declare -A EXTRA_COMMANDS=(
    ["tdev"]="scripts/tmux/tmux-dev.sh"
    ["tclaude"]="scripts/tmux/tmux-project.sh"
    ["tqwen"]="scripts/tmux/tmux-project-qwen.sh"
    ["tgemini"]="scripts/tmux/tmux-project-gemini.sh"
    ["topencode"]="scripts/tmux/tmux-project-opencode.sh"
)

# Check dependencies
check_dependencies() {
    echo -e "${BLUE}Checking dependencies...${NC}"

    local missing=()

    # Required: tmux
    if ! command -v tmux &> /dev/null; then
        missing+=("tmux")
    else
        echo -e "${GREEN}  ✓ tmux${NC}"
    fi

    # Optional tools
    local optional=("nvim" "lazygit" "kimi" "fzf")
    for tool in "${optional[@]}"; do
        if ! command -v $tool &> /dev/null; then
            echo -e "${YELLOW}  ⚠ $tool not found (optional)${NC}"
        else
            echo -e "${GREEN}  ✓ $tool${NC}"
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo -e "${RED}Missing required: ${missing[*]}${NC}"
        echo ""
        echo "Install commands:"

        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "  macOS:   brew install tmux fzf"
        elif command -v apt-get &> /dev/null; then
            echo "  Ubuntu:  sudo apt install tmux fzf"
        elif command -v dnf &> /dev/null; then
            echo "  Fedora:  sudo dnf install tmux fzf"
        elif command -v pacman &> /dev/null; then
            echo "  Arch:    sudo pacman -S tmux fzf"
        fi

        echo ""
        read -p "Continue anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Create installation directory
setup_install_dir() {
    if [[ ! -d "$INSTALL_DIR" ]]; then
        echo -e "${BLUE}Creating $INSTALL_DIR...${NC}"
        mkdir -p "$INSTALL_DIR"
    fi
}

# Configure PATH
setup_path() {
    local shell_rc=""
    local path_export="export PATH=\"\$HOME/.local/bin:\$PATH\""

    # Detect shell and config file
    if [[ "$SHELL" == */zsh ]]; then
        shell_rc="$HOME/.zshrc"
    elif [[ "$SHELL" == */bash ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            shell_rc="$HOME/.bash_profile"
        else
            shell_rc="$HOME/.bashrc"
        fi
    fi

    # Check if PATH already configured
    if [[ -f "$shell_rc" ]] && grep -q 'HOME/.local/bin' "$shell_rc" 2>/dev/null; then
        echo -e "${GREEN}PATH already configured in $shell_rc${NC}"
        return 0
    fi

    echo -e "${BLUE}Adding ~/.local/bin to PATH in $shell_rc...${NC}"
    echo "" >> "$shell_rc"
    echo "# Added by tmux-dev-tools installer" >> "$shell_rc"
    echo "$path_export" >> "$shell_rc"

    echo -e "${GREEN}✓ PATH configured${NC}"
    echo -e "${YELLOW}  Run: source $shell_rc${NC}"
}

# Install a single command
install_command() {
    local cmd="$1"
    local script_rel="$2"
    local script_path="$PROJECT_ROOT/$script_rel"
    local target="$INSTALL_DIR/$cmd"

    if [[ ! -f "$script_path" ]]; then
        echo -e "${YELLOW}  ⚠ Script not found: $script_path${NC}"
        return 1
    fi

    # Make source executable
    chmod +x "$script_path"

    # Create symlink
    ln -sf "$script_path" "$target"

    echo -e "${GREEN}  ✓ $cmd${NC} → $script_rel"
}

# Install all commands
install_all() {
    echo -e "${BLUE}Installing core commands...${NC}"

    for cmd in "${!COMMANDS[@]}"; do
        install_command "$cmd" "${COMMANDS[$cmd]}"
    done

    if [[ "$INSTALL_ALL" == "true" ]]; then
        echo ""
        echo -e "${BLUE}Installing extra commands...${NC}"
        for cmd in "${!EXTRA_COMMANDS[@]}"; do
            install_command "$cmd" "${EXTRA_COMMANDS[$cmd]}"
        done
    fi
}

# Uninstall function
uninstall() {
    echo -e "${YELLOW}Uninstalling tmux-dev-tools...${NC}"

    local all_cmds=("${!COMMANDS[@]}" "${!EXTRA_COMMANDS[@]}")
    for cmd in "${all_cmds[@]}"; do
        if [[ -L "$INSTALL_DIR/$cmd" || -f "$INSTALL_DIR/$cmd" ]]; then
            rm -f "$INSTALL_DIR/$cmd"
            echo -e "${GREEN}  ✓ Removed $cmd${NC}"
        fi
    done

    echo -e "${YELLOW}Note: PATH configuration in shell rc file preserved${NC}"
    exit 0
}

# Show help
show_help() {
    echo "Tmux Dev Tools Installer"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help"
    echo "  -u, --uninstall Remove all installed commands"
    echo "  --all           Install all commands (including AI variants)"
    echo "  --no-path       Skip PATH configuration"
    echo ""
    echo "Core commands:"
    echo "  tk              Tmux Kimi dev environment"
    echo "  ts              Tmux session selector"
    echo ""
    echo "Extra commands (with --all):"
    echo "  tdev            Elysia dev environment (5 windows)"
    echo "  tclaude         Claude Code dev environment"
    echo "  tqwen           Qwen dev environment"
    echo "  tgemini         Gemini dev environment"
    echo "  topencode       OpenCode dev environment"
    echo ""
    exit 0
}

# Parse arguments
NO_PATH=false
INSTALL_ALL=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            ;;
        -u|--uninstall)
            uninstall
            ;;
        --all)
            INSTALL_ALL=true
            shift
            ;;
        --no-path)
            NO_PATH=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Main installation
main() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Tmux Dev Tools Installer${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    check_dependencies
    setup_install_dir

    if [[ "$NO_PATH" != "true" ]]; then
        setup_path
    fi

    echo ""
    install_all

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Installation Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}Core commands:${NC}"
    echo "  tk .              # Start Kimi dev env in current dir"
    echo "  tk ~/my-project   # Start in specific project"
    echo "  ts                # Select and attach to session"
    echo ""

    if [[ "$INSTALL_ALL" == "true" ]]; then
        echo -e "${BLUE}Extra commands:${NC}"
        echo "  tdev .            # Elysia dev (5 windows)"
        echo "  tclaude .         # Claude Code env"
        echo "  tqwen .           # Qwen env"
        echo "  tgemini .         # Gemini env"
        echo "  topencode .       # OpenCode env"
        echo ""
    fi

    echo -e "${BLUE}Management:${NC}"
    echo "  make update       # Re-install (update)"
    echo "  make uninstall    # Remove all commands"
    echo ""
}

main
