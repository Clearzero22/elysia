# Development Tools

The development tooling scripts have been extracted to a separate repository for better maintainability and reusability.

## Terminal Tools

All tmux development environment scripts, installers, and configuration are now maintained at:

**[github.com/Clearzero22/terminal-tools](https://github.com/Clearzero22/terminal-tools)**

### Features

- Multi-window tmux development environments
- AI assistant integration (Claude, Kimi, Qwen, Gemini, OpenCode)
- Session management tools
- Cross-platform installer

### Quick Start

```bash
# Clone the tools repository
git clone https://github.com/Clearzero22/terminal-tools.git ~/terminal-tools
cd ~/terminal-tools/scripts/tmux

# Install
make install

# Use
tk .                    # Start Kimi dev environment
ts                      # Select tmux session
```

### Migration

The `scripts/` directory has been removed from this repository. Please update any local references:

```bash
# Old (removed)
./scripts/tmux/tmux-project-kimi.sh

# New (use terminal-tools repo)
tk .                    # or
~/terminal-tools/scripts/tmux/tmux-project.sh kimi .
```

---

## Why Separate?

- **Reusability**: Tools can be used across multiple projects
- **Maintainability**: Single source of truth for updates
- **Clarity**: Separates project code from development tooling
- **Collaboration**: Easier for others to contribute to tools

---

For Elysia contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md)
