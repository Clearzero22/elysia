# Tmux Scripts

Development environment and testing scripts for Elysia project.

## Scripts

### tmux-project.sh (Universal)

通用开发环境脚本，可以打开任意项目目录，包含 8 个角色窗口。

**Windows (8 Roles):**
| # | Window | Role |
|---|--------|------|
| 0 | architect | System design, architecture |
| 1 | ux-ui | User experience, interface |
| 2 | backend | API, database, server |
| 3 | frontend | UI components, client |
| 4 | review | Code review, QA |
| 5 | devops | CI/CD, deployment, infra |
| 6 | qa | Testing, quality assurance |
| 7 | docs | Documentation |

**Usage:**
```bash
# 打开指定项目
./scripts/tmux/tmux-project.sh /path/to/project

# 当前目录
./scripts/tmux/tmux-project.sh .

# 指定会话名称
./scripts/tmux/tmux-project.sh -n my-session /path/to/project

# 帮助
./scripts/tmux/tmux-project.sh -h
```

### tmux-dev.sh (Elysia专用)

Multi-role development workspace with 5 windows:

| Window | Role | Description |
|--------|------|-------------|
| 0 | architect | System design, architecture decisions |
| 1 | ux-ui | User experience, interface design |
| 2 | backend | API, database, server logic |
| 3 | frontend | UI components, client logic |
| 4 | review | Code review, quality assurance |

**Layout per window:**
```
+-------------------+-------------------+
|                   |                   |
|   Claude Code     |                   |
|     (pane1)       |     Neovim        |
+-------------------+     (pane3)       |
|                   |                   |
|     Lazygit       |                   |
|     (pane2)       |                   |
+-------------------+-------------------+
```

**Usage:**
```bash
./scripts/tmux/tmux-dev.sh
```

### memory-leak-test.sh

Tmux-based test environment for reproducing issue #1744 (Memory Leak in Multipart parser).

**Usage:**
```bash
./scripts/tmux/memory-leak-test.sh
```

## Requirements

- tmux
- nvim
- lazygit
- claude (Claude Code CLI)

## Tmux Shortcuts

| Shortcut | Description |
|----------|-------------|
| `Ctrl+b 0-4` | Switch window |
| `Ctrl+b o` | Next pane |
| `Ctrl+b z` | Toggle pane fullscreen |
| `Ctrl+b d` | Detach session |
| `Ctrl+b q` | Show pane numbers |
