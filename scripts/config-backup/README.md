# Config Backup

配置文件备份

## Files

| File/Dir | Location | Description |
|----------|----------|-------------|
| `.tmux.conf` | `~/.tmux.conf` | Tmux 配置 |
| `config.yml` | `~/.config/lazygit/config.yml` | Lazygit 配置 |
| `nvim/` | `~/.config/nvim/` | LazyVim (Neovim) 配置 |
| `alacritty/` | `~/.config/alacritty/` | Alacritty 终端配置 |

## Nvim Config Structure

```
nvim/
├── init.lua           # 入口文件
├── lazy-lock.json     # 插件锁定文件
├── lua/
│   ├── config/        # 核心配置
│   │   ├── options.lua
│   │   ├── keymaps.lua
│   │   ├── autocmds.lua
│   │   └── lazy.lua
│   └── plugins/       # 插件配置
│       └── theme.lua  # Gruvbox 主题
└── stylua.toml        # Lua 格式化配置
```

## Restore

```bash
# Restore tmux config
cp .tmux.conf ~/.tmux.conf
tmux source-file ~/.tmux.conf

# Restore lazygit config
mkdir -p ~/.config/lazygit
cp config.yml ~/.config/lazygit/config.yml

# Restore nvim config (LazyVim)
rm -rf ~/.config/nvim
cp -r nvim ~/.config/nvim

# Restore alacritty config
rm -rf ~/.config/alacritty
cp -r alacritty ~/.config/alacritty
```

## Backup Date

2026-02-18
