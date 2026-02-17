# Config Backup

配置文件备份

## Files

| File | Location | Description |
|------|----------|-------------|
| `.tmux.conf` | `~/.tmux.conf` | Tmux 配置 |
| `config.yml` | `~/.config/lazygit/config.yml` | Lazygit 配置 |

## Restore

```bash
# Restore tmux config
cp .tmux.conf ~/.tmux.conf
tmux source-file ~/.tmux.conf

# Restore lazygit config
mkdir -p ~/.config/lazygit
cp config.yml ~/.config/lazygit/config.yml
```

## Backup Date

2026-02-18
