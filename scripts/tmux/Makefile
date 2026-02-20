# ========================================
# Tmux Dev Tools - Makefile
# ========================================

.PHONY: install install-all uninstall update help test

# Default target
help:
	@echo "Tmux Dev Tools Manager"
	@echo ""
	@echo "Usage:"
	@echo "  make install      Install core commands (tk, ts)"
	@echo "  make install-all  Install all commands (including AI variants)"
	@echo "  make uninstall    Remove all commands"
	@echo "  make update       Re-install (update)"
	@echo "  make test         Test the scripts"
	@echo ""

# Install core commands only
install:
	@chmod +x tmux-project-kimi.sh install.sh
	@./install.sh

# Install all commands (including AI variants)
install-all:
	@chmod +x tmux-project-kimi.sh install.sh
	@./install.sh --all

# Uninstall
uninstall:
	@./install.sh --uninstall

# Update (reinstall)
update: install

# Quick test
test:
	@echo "Testing script syntax..."
	@bash -n tmux-project-kimi.sh && echo "✓ tmux-project-kimi.sh OK"
	@bash -n ../../scripts/tmux-select.sh && echo "✓ tmux-select.sh OK"
	@./tmux-project-kimi.sh --help
