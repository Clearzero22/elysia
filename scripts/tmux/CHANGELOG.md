# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Cross-platform installer (`install.sh`) supporting macOS and Linux
- Makefile for managing install/uninstall/update commands
- Core commands: `tk` (Kimi dev environment), `ts` (session selector)
- Extra commands with `--all` flag: `tdev`, `tclaude`, `tqwen`, `tgemini`, `topencode`
- 8-window development environment with role-based layout
- Automatic PATH configuration for bash/zsh

### Changed
- Updated README.md with installation documentation

---

## [1.0.0] - 2026-02-20

### Added
- Initial release of tmux-project-kimi.sh
- 8 role-based windows: architect, ux-ui, backend, frontend, review, devops, qa, docs
- 3-pane layout: AI assistant + Lazygit + Neovim
- Session selector with fzf support
- Multiple AI tool variants (Claude, Kimi, Qwen, Gemini, OpenCode)

---

## Version Planning

| Version | Target Date | Focus |
|---------|-------------|-------|
| v1.1.0 | 2026-02-28 | User experience enhancements |
| v1.2.0 | 2026-03-07 | Configuration system |
| v1.3.0 | 2026-03-15 | Smart features |
| v2.0.0 | 2026-04-01 | Ecosystem expansion |

---

[Unreleased]: https://github.com/YOUR_USERNAME/YOUR_REPO/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/YOUR_USERNAME/YOUR_REPO/releases/tag/v1.0.0
