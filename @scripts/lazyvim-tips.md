# LazyVim 使用技巧

## 目录树显示隐藏文件

### 方法 1：快捷键（临时）

在 Neo-tree 目录树窗口中按：

```
H    # 切换显示/隐藏隐藏文件（以 . 开头的文件）
```

### 方法 2：永久配置

创建/编辑配置文件：

```bash
mkdir -p ~/.config/nvim/lua/plugins
cat > ~/.config/nvim/lua/plugins/neo-tree.lua << 'EOF'
return {
  "nvim-neo-tree/neo-tree.nvim",
  opts = {
    filesystem = {
      filtered_items = {
        visible = true,           -- 显示隐藏文件
        hide_dotfiles = false,    -- 不隐藏 . 开头的文件
        hide_gitignored = false,  -- 显示 gitignore 的文件
      },
    },
  },
}
EOF
```

重启 Neovim 生效。

### 方法 3：命令模式

在 Neo-tree 窗口中：

```
?           # 查看所有快捷键
```

---

## Neo-tree 常用快捷键

| 快捷键 | 功能 |
|--------|------|
| `H` | 显示/隐藏隐藏文件 |
| `?` | 显示帮助 |
| `<CR>` / `o` | 打开文件/目录 |
| `a` | 新建文件 |
| `A` | 新建目录 |
| `d` | 删除 |
| `r` | 重命名 |
| `c` | 复制 |
| `m` | 移动 |
| `y` | 复制到剪贴板 |
| `x` | 剪切到剪贴板 |
| `p` | 粘贴 |
| `R` | 刷新 |
| `q` | 关闭目录树 |

---

## 参考

- [neo-tree.nvim 文档](https://github.com/nvim-neo-tree/neo-tree.nvim)
- [LazyVim 文档](https://www.lazyvim.org/)
