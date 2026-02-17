#!/bin/bash

# ========================================
# Tools Installation Script
# btop + binsider
# ========================================

set -e

INSTALL_DIR="$HOME/.local/bin"
TEMP_DIR="/tmp/install-tools-$$"

echo "========================================"
echo " Tools Installation Script"
echo "========================================"
echo ""
echo "Installing to: $INSTALL_DIR"
echo ""

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$TEMP_DIR"

cleanup() {
    echo ""
    echo "Cleaning up..."
    rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

# ========================================
# Install btop
# ========================================
install_btop() {
    echo "[1/2] Installing btop..."

    cd "$TEMP_DIR"
    curl -sLO https://github.com/aristocratos/btop/releases/download/v1.4.6/btop-x86_64-unknown-linux-musl.tbz

    tar -xjf btop-x86_64-unknown-linux-musl.tbz

    cd btop
    sudo make install PREFIX=/usr/local

    echo "btop installed: $(which btop)"
}

# ========================================
# Install binsider
# ========================================
install_binsider() {
    echo ""
    echo "[2/2] Installing binsider..."

    cd "$TEMP_DIR"
    curl -sLO https://github.com/orhun/binsider/releases/download/v0.3.2/binsider-0.3.2-x86_64-unknown-linux-musl.tar.gz

    tar -xzf binsider-0.3.2-x86_64-unknown-linux-musl.tar.gz

    mv binsider-0.3.2/binsider "$INSTALL_DIR/"
    chmod +x "$INSTALL_DIR/binsider"

    echo "binsider installed: $INSTALL_DIR/binsider"
}

# ========================================
# Main
# ========================================
install_btop
install_binsider

echo ""
echo "========================================"
echo " Installation Complete!"
echo "========================================"
echo ""
echo "Installed tools:"
echo "  - btop     : $(which btop 2>/dev/null || echo 'not found')"
echo "  - binsider : $(which binsider 2>/dev/null || echo "$INSTALL_DIR/binsider")"
echo ""
echo "Usage:"
echo "  btop       # System monitor"
echo "  binsider   # Binary analyzer"
echo ""
