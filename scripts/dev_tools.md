# 终端的文件管理器

1. yazi  is a terminal file manager written in Rust, baased on non-blocking async I/O..It amis to provide an efficient, use friendly, and customizable file management experience.

2. fzf 模糊查找神器 几乎所有的工具都会集成它 历史 文件 git记录

3. ripgrep 超级快的grep 比grep/ag 快几倍到几十倍，支持.gitignore

4. bat 到待语法高亮的cat 看代码、diff、log舒服太多

5. eza / lsd 现代ls代替, 颜色、图标、git 状态、一键tree

6. fd 现代 find 替代，比find快+默认忽略.git/ .node_ modules

7. 系统信息查看 btop / bottom 

8. zellij 比tmux 配置简单+自带UI+鼠标支持
  Rust 写的很快




# 常用指南

1. 搜索/查找/跳转 核心三人组 (每天用几十次，强烈了建议全装)

- zoxide + fzf + fd + ripgrep (rg)
- z proj 智能去经常去的目录
- fd . | fzf 快速找文件
- rg "pattern" | fzf 代码内搜索+预览

2. 查看/美化/阅读 工具 (代码/log/文档/输出)

- bat + delta + glow / mdless

bat 看代码/配置文件, delta 看 git diff / pathch, glow 看markdown README

- jq / yq /jless / fx 处理JSON /YAML时必备

3. Git / 版本控制 效率工具 (Lazy git 是天花板)

- lazygit + delta + gitui 必选

4. 任务/构建/脚本 运行器 (取代Makefile 的现代选择

-just 或task just 语法简单，像写markdown

5. 系统/资源/进程 监控 (取代htop)

- bottom (btm)
- dua / dust / tokei

dua 交互式查看磁盘占用,tokei 统计代码行数/语言分布

6. Shell / Prompt / 体验升级 (让终端本身变强)

- Starship (prompt) + zellij 

- Nushell 

7. AI 终端代替

- Claude code 

- codex

- Gemini CLI

- Qwen CLI

- kimi CLI

- opencode CLI

核心必装的一些的终端工具 

zoxide fzf ripgrep bat eza fd tldr lazygit git-delta bottom just starship zellij mise
