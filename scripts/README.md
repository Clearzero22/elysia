# Terminal Tools

开发者终端工具集合 - 提升 CLI 工作效率的脚本和配置。

## 功能特性

- **一键安装工具** - 自动安装 btop、binsider 等系统监控工具
- **Tmux 会话管理** - 交互式会话选择器，支持 fzf 预览
- **AI 项目模板** - 针对不同 AI 模型的 tmux 工作区配置
- **现代工具指南** - 终端工具使用文档和最佳实践

## 安装

```bash
# 安装系统工具
./install-tools.sh
```

## 使用

```bash
# 选择并附加到 tmux 会话
./tmux-select.sh

# 使用 AI 项目工作区
./tmux/tmux-project.sh      # 通用项目
./tmux/tmux-project-gemini.sh  # Gemini 项目
./tmux/tmux-project-kimi.sh    # Kimi 项目
./tmux/tmux-project-qwen.sh    # Qwen 项目
./tmux/tmux-project-opencode.sh # OpenCode 项目
```

## 目录结构

```
scripts/
├── install-tools.sh       # 工具安装脚本
├── tmux-select.sh         # Tmux 会话选择器
├── dev_tools.md          # 终端工具指南
├── tmux/                 # Tmux 配置和脚本
├── config-backup/        # 配置备份
└── other_btop_content/   # btop 配置
```

## 推荐工具

详见 [dev_tools.md](./dev_tools.md)：

| 工具 | 用途 |
|------|------|
| fzf | 模糊搜索 |
| ripgrep (rg) | 快速代码搜索 |
| bat | 语法高亮的 cat |
| eza / lsd | 现代 ls 替代 |
| lazygit | Git 交互界面 |
| zoxide | 智能目录跳转 |

## 许可证

MIT
