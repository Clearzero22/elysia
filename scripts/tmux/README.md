# Tmux Development Environment Scripts

多角色开发环境脚本集合，支持多种 AI 助手。

## 目录结构

```
scripts/tmux/
├── tmux-project.sh          # Claude Code 版本
├── tmux-project-kimi.sh     # Kimi 版本
├── tmux-project-qwen.sh     # Qwen 版本
├── tmux-project-opencode.sh # OpenCode 版本
├── tmux-project-gemini.sh   # Gemini 版本
├── tmux-dev.sh              # Elysia 专用（5 窗口）
├── memory-leak-test.sh      # 内存泄漏测试环境
└── README.md                # 本文档

scripts/
├── tmux-select.sh           # 会话快速选择器
└── install-tools.sh         # 工具安装脚本
```

## 快速开始

### 1. 启动开发环境

```bash
# Claude Code 版本
./scripts/tmux/tmux-project.sh /path/to/project

# Kimi 版本
./scripts/tmux/tmux-project-kimi.sh /path/to/project

# Qwen 版本
./scripts/tmux/tmux-project-qwen.sh /path/to/project

# OpenCode 版本
./scripts/tmux/tmux-project-opencode.sh /path/to/project

# Gemini 版本
./scripts/tmux/tmux-project-gemini.sh /path/to/project

# 当前目录
./scripts/tmux/tmux-project.sh .
```

### 2. 会话选择器

```bash
# 快速选择并连接会话
./scripts/tmux-select.sh
```

需要安装 fzf 以获得最佳体验：
```bash
sudo apt install fzf
```

### 3. 添加别名（推荐）

```bash
# 添加到 ~/.bashrc
echo 'alias ts="~/my_projects/elysia/scripts/tmux-select.sh"' >> ~/.bashrc
echo 'alias tdev="~/my_projects/elysia/scripts/tmux/tmux-project.sh"' >> ~/.bashrc
source ~/.bashrc
```

使用：
```bash
ts          # 选择会话
tdev .      # 启动开发环境
```

## 8 个角色窗口

| # | Window | 角色 | 职责 |
|---|--------|------|------|
| 0 | architect | 架构师 | 系统设计、架构决策 |
| 1 | ux-ui | UX/UI | 用户体验、界面设计 |
| 2 | backend | 后端工程师 | API、数据库、服务逻辑 |
| 3 | frontend | 前端工程师 | UI 组件、客户端逻辑 |
| 4 | review | 代码审阅 | 代码审查、质量保证 |
| 5 | devops | DevOps | CI/CD、部署、基础设施 |
| 6 | qa | QA | 测试、质量保证 |
| 7 | docs | 文档 | README、指南、API 文档 |

## 窗口布局

每个窗口分为 3 个 pane：

```
+-------------------+-------------------+
|                   |                   |
|    AI Assistant   |                   |
|      (pane1)      |     Neovim        |
+-------------------+     (pane3)       |
|                   |                   |
|     Lazygit       |                   |
|      (pane2)      |                   |
+-------------------+-------------------+
```

| Pane | 工具 | 说明 |
|------|------|------|
| pane1 | AI 助手 | Claude/Kimi/Qwen/OpenCode/Gemini |
| pane2 | Lazygit | Git 可视化操作 |
| pane3 | Neovim | 代码编辑 |

## Tmux 快捷键

### 窗口操作

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+b 0-7` | 切换到指定窗口 |
| `Ctrl+b n` | 下一个窗口 |
| `Ctrl+b p` | 上一个窗口 |
| `Ctrl+b w` | 窗口列表 |

### Pane 操作

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+b o` | 下一个 pane |
| `Ctrl+b q` | 显示 pane 编号 |
| `Ctrl+b z` | 全屏当前 pane |
| `Ctrl+b x` | 关闭当前 pane |
| `Ctrl+b ↑/↓/←/→` | 切换 pane |

### 会话操作

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+b d` | 分离会话（后台运行） |
| `Ctrl+b s` | 会话列表 |
| `Ctrl+b $` | 重命名会话 |
| `Ctrl+b :` | 命令模式 |

### 鼠标操作（已启用）

- **点击 pane**: 选择 pane
- **拖拽边框**: 调整大小
- **滚轮**: 滚动内容
- **点击窗口名**: 切换窗口

## 命令行操作

```bash
# 列出所有会话
tmux ls

# 连接会话
tmux attach -t <session-name>

# 分离会话（在 tmux 内）
Ctrl+b d

# 关闭会话
tmux kill-session -t <session-name>

# 关闭所有会话
tmux kill-server
```

## 依赖工具

| 工具 | 必需 | 说明 |
|------|------|------|
| tmux | ✅ | 终端复用器 |
| nvim | ✅ | 编辑器 |
| lazygit | ✅ | Git UI |
| fzf | 推荐 | 模糊搜索 |
| claude/kimi/qwen/opencode/gemini | 可选 | AI 助手 |

## 安装依赖

```bash
# 安装 fzf（推荐）
sudo apt install fzf

# 安装 lazygit（已安装可跳过）
# 见 ~/.config/lazygit/config.yml
```

## 示例工作流

### 启动新项目

```bash
# 1. 启动开发环境
./scripts/tmux/tmux-project.sh ~/my-projects/new-app

# 2. 在 architect 窗口设计架构
# 3. 在 backend 窗口开发 API
# 4. 在 frontend 窗口开发 UI
# 5. 在 review 窗口审阅代码
```

### 恢复工作

```bash
# 方法一：使用选择器
./scripts/tmux-select.sh

# 方法二：直接连接
tmux attach -t dev-new-app
```

### 切换 AI 助手

```bash
# 使用 Claude Code
./scripts/tmux/tmux-project.sh .

# 使用 Kimi
./scripts/tmux/tmux-project-kimi.sh .

# 使用 Qwen
./scripts/tmux/tmux-project-qwen.sh .
```

## 配置文件

### Tmux 配置

位置：`~/.tmux.conf`

已启用：
- 鼠标支持
- 256 色
- Vim 键绑定

### Lazygit 配置

位置：`~/.config/lazygit/config.yml`

已配置：
- Neovim 作为编辑器
- 主题设置

## 故障排除

### 会话无法连接

```bash
# 检查会话是否存在
tmux ls

# 如果不存在，重新创建
./scripts/tmux/tmux-project.sh .
```

### AI 助手未启动

检查是否安装：
```bash
which claude kimi qwen opencode gemini
```

### 鼠标无法使用

重新加载配置：
```bash
tmux source-file ~/.tmux.conf
# 或
Ctrl+b r
```

## 相关链接

- [Tmux 官方文档](https://github.com/tmux/tmux)
- [Lazygit](https://github.com/jesseduffield/lazygit)
- [Claude Code](https://code.claude.com)
- [Neovim](https://neovim.io)
