# LazyVim 使用技巧大全

## 核心快捷键

###  Leader 键
- `Space` 是默认的 Leader 键

---

## 文件操作

| 快捷键 | 功能 |
|--------|------|
| `<Space>e` | 打开/关闭目录树 (Neo-tree) |
| `<Space>ff` | 查找文件 (Telescope) |
| `<Space>fr` | 查找最近文件 |
| `<Space>fg` | 全局搜索 (live_grep) |
| `<Space>fb` | 查找 buffer |
| `<Space>fn` | 新建文件 |
| `<Space>fs` | 保存文件 |

---

## 窗口管理

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+h/j/k/l` | 切换窗口（左/下/上/右）|
| `<Space>w` | 窗口相关操作 |
| `<Space>wd` | 关闭当前窗口 |
| `<Space>wo` | 只保留当前窗口 |
| `<Space>-` | 水平分割 |
| `<Space>\|` | 垂直分割 |

---

## Buffer 管理

| 快捷键 | 功能 |
|--------|------|
| `<Space>bb` | 切换 buffer |
| `<Space>bd` | 关闭当前 buffer |
| `<Space>bD` | 关闭其他 buffer |
| `<Space>bl` | 切换到最后一个 buffer |
| `]b` / `[b` | 下一个/上一个 buffer |
| `H` / `L` | 切换到上一个/下一个 buffer |

---

## 代码编辑

### 智能提示与补全
| 快捷键 | 功能 |
|--------|------|
| `Ctrl+n/p` | 选择下/上一个补全项 |
| `Ctrl+y` | 确认补全 |
| `Ctrl+e` | 取消补全 |
| `K` | 悬浮显示文档 |
| `gd` | 跳转到定义 |
| `gD` | 跳转到声明 |
| `gr` | 查找所有引用 |
| `gi` | 跳转到实现 |

### 代码操作
| 快捷键 | 功能 |
|--------|------|
| `<Space>ca` | 代码动作 (Code Action) |
| `<Space>cr` | 重命名 |
| `<Space>cf` | 格式化代码 |
| `<Space>cd` | 显示诊断信息 |
| `]d` / `[d` | 下一个/上一个诊断 |
| `<Space>cs` | 切换 LSP 服务器 |

---

## 搜索与替换

| 快捷键 | 功能 |
|--------|------|
| `<Space>sg` | 全局搜索 (grep) |
| `<Space>sw` | 搜索当前单词 |
| `<Space>ss` | 搜索符号 |
| `<Space>sS` | 搜索工作区符号 |
| `<Space>sr` |  resume 上次搜索 |
| `:%s/old/new/g` | 全局替换 |
| `*` / `#` | 搜索当前单词（下/上）|

---

## Git 集成

| 快捷键 | 功能 |
|--------|------|
| `<Space>gg` | 打开 LazyGit |
| `<Space>gb` | 查看 blame |
| `<Space>gB` | 查看 branch |
| `<Space>gd` | 查看 diff |
| `<Space>gs` | 查看 git status |
| `]g` / `[g` | 下一个/上一个 git hunk |
| `<Space>ghp` | 预览 hunk |
| `<Space>ghr` | 重置 hunk |
| `<Space>ghs` | 暂存 hunk |

---

## 终端

| 快捷键 | 功能 |
|--------|------|
| `<Space>ft` | 打开浮动终端 |
| `<Space>fT` | 打开底部终端 |
| `<Ctrl>\<Ctrl>n` | 从终端模式切换到普通模式 |
| `<Esc><Esc>` | 退出终端模式 |

---

## 会话管理

| 快捷键 | 功能 |
|--------|------|
| `<Space>Ss` | 保存会话 |
| `<Space>Sr` | 恢复会话 |
| `<Space>Sd` | 删除会话 |
| `<Space>Sf` | 查找会话 |

---

## 插件管理

| 快捷键 | 功能 |
|--------|------|
| `<Space>l` | 打开 Lazy (插件管理器) |
| `:Lazy sync` | 同步插件 |
| `:Lazy update` | 更新所有插件 |
| `:Lazy clean` | 清理无用插件 |
| `:Lazy profile` | 查看启动时间 |
| `<Space>m` | 打开 Mason (LSP/DAP 管理) |

---

## 快速移动

| 快捷键 | 功能 |
|--------|------|
| `s` | Flash 快速跳转 |
| `S` | Flash 选择文本 |
| `f/F` | 行内查找字符 |
| `t/T` | 行内查找字符（到字符前）|
| `;` / `,` | 重复上/下次查找 |

---

## 文本操作

### 多光标 (mini.surround / visual-multi)
| 快捷键 | 功能 |
|--------|------|
| `<Ctrl>n` | 选择下一个相同单词 |
| `<Ctrl>Up/Down` | 垂直多光标 |

### 环绕字符
| 快捷键 | 功能 |
|--------|------|
| `ysiw"` | 给单词添加 " (yank surround inner word) |
| `cs"'` | 把 " 改成 ' (change surround) |
| `ds"` | 删除 " (delete surround) |
| `S"` (可视模式) | 给选中文本添加 " |

---

## 折叠代码

| 快捷键 | 功能 |
|--------|------|
| `za` | 切换折叠 |
| `zM` | 折叠所有 |
| `zR` | 展开所有 |
| `zc` / `zo` | 关闭/打开折叠 |

---

## 注释

| 快捷键 | 功能 |
|--------|------|
| `gcc` | 切换当前行注释 |
| `gc` (可视模式) | 切换选中文本注释 |
| `gbc` | 切换块注释 |

---

## 有用的命令

```vim
" 查看所有快捷键
:Telescope keymaps

" 查看所有命令
:Telescope commands

" 查看帮助
:Telescope help_tags

" 查看文件类型
:set filetype?

" 查看当前配置
:Lazy

" 重新加载配置
:source %
```

---

## 故障排查

| 问题 | 解决方法 |
|------|---------|
| 插件加载慢 | `:Lazy profile` 查看启动时间 |
| LSP 不工作 | `:Mason` 检查 LSP 是否安装 |
| 配置报错 | `:checkhealth` 检查健康状态 |
| 重置配置 | 删除 `~/.local/share/nvim` 和 `~/.cache/nvim` |

---

## 参考链接

- [LazyVim 官方文档](https://www.lazyvim.org/)
- [LazyVim GitHub](https://github.com/LazyVim/LazyVim)
- [Neovim 文档](https://neovim.io/doc/)
