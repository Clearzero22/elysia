# LazyVim 插件管理完全指南

## 核心概念

LazyVim 使用 **lazy.nvim** 作为插件管理器，它是目前 Neovim 最快、最先进的插件管理器。

### 关键特性
- ⏱️ **异步加载** - 插件按需加载，启动飞快
- 🔒 **自动锁定** - 锁定版本，确保环境一致
- 📊 **性能分析** - 内置启动时间分析
- 🔄 **自动更新** - 一键更新所有插件

---

## 插件配置文件结构

```
~/.config/nvim/
├── lua/
│   ├── config/
│   │   ├── lazy.lua      # lazy.nvim 初始化
│   │   └── options.lua   # Vim 选项
│   └── plugins/          # 插件配置目录 ⭐
│       ├── init.lua      # 插件列表
│       ├── lsp.lua       # LSP 相关
│       ├── treesitter.lua
│       └── ...           # 其他插件配置
└── init.lua              # 入口文件
```

---

## 插件安装方法

### 方法 1：基本安装（推荐）

创建 `~/.config/nvim/lua/plugins/插件名.lua`：

```lua
-- 最简单的安装
return {
  "nvim-telescope/telescope.nvim",
}
```

### 方法 2：带配置的安装

```lua
return {
  "nvim-telescope/telescope.nvim",
  -- 加载条件
  cmd = "Telescope",           -- 执行命令时加载
  event = "BufReadPost",       -- 事件触发时加载
  ft = "python",               -- 文件类型触发
  
  -- 依赖
  dependencies = {
    "nvim-lua/plenary.nvim",
    { "nvim-telescope/telescope-fzf-native.nvim", build = "make" },
  },
  
  -- 配置函数
  config = function()
    require("telescope").setup({
      defaults = {
        layout_strategy = "horizontal",
      },
    })
  end,
  
  -- 或者使用 opts（推荐）
  opts = {
    defaults = {
      layout_strategy = "horizontal",
    },
  },
}
```

### 方法 3：多插件配置（init.lua）

```lua
-- lua/plugins/init.lua
return {
  -- 主题
  { "catppuccin/nvim", name = "catppuccin", priority = 1000 },
  
  -- 文件树
  {
    "nvim-neo-tree/neo-tree.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-tree/nvim-web-devicons",
      "MunifTanjim/nui.nvim",
    },
  },
  
  -- 模糊查找
  { "nvim-telescope/telescope.nvim", tag = "0.1.5" },
}
```

---

## 插件配置详解

### 配置选项（opts vs config）

```lua
return {
  "插件作者/插件名",
  
  -- 方式 1：opts（推荐，会自动调用 setup）
  opts = {
    option1 = "value1",
    option2 = "value2",
  },
  
  -- 方式 2：config（需要手动调用 setup）
  config = function(_, opts)
    require("插件名").setup(opts)
    -- 额外配置
  end,
  
  -- 方式 3：带参数的 config
  config = function(plugin, opts)
    require("插件名").setup(vim.tbl_deep_extend("force", opts, {
      extra_option = "value",
    }))
  end,
}
```

### 按键映射（keys）

```lua
return {
  "插件作者/插件名",
  keys = {
    -- 基本映射
    { "<leader>ff", "<cmd>Telescope find_files<cr>", desc = "Find Files" },
    
    -- 带模式的映射
    { "<leader>fg", "<cmd>Telescope live_grep<cr>", desc = "Live Grep", mode = { "n", "v" } },
    
    -- 函数映射
    {
      "<leader>fe",
      function()
        require("neo-tree").toggle()
      end,
      desc = "Toggle Explorer",
    },
  },
}
```

### 延迟加载策略

```lua
return {
  "插件作者/插件名",
  
  -- 命令延迟（推荐）
  cmd = { "Command1", "Command2" },
  
  -- 事件延迟
  event = "VeryLazy",           -- 启动后延迟加载
  event = "BufReadPre",         -- 读文件前
  event = "InsertEnter",        -- 进入插入模式
  event = { "BufReadPost", "BufNewFile" },
  
  -- 文件类型延迟
  ft = "python",
  ft = { "javascript", "typescript" },
  
  -- 组合延迟
  cmd = "Telescope",
  event = "BufReadPost",
  ft = { "lua", "python" },
}
```

### 条件加载

```lua
return {
  "插件作者/插件名",
  
  -- 只在 VS Code 中启用
  cond = function()
    return vim.g.vscode ~= nil
  end,
  
  -- 只在非 VS Code 中启用
  cond = function()
    return vim.g.vscode == nil
  end,
  
  -- 根据可执行文件
  cond = function()
    return vim.fn.executable("git") == 1
  end,
}
```

---

## Lazy 命令

### 基础命令

| 命令 | 功能 |
|------|------|
| `:Lazy` | 打开 Lazy 管理界面 |
| `:Lazy install` | 安装新插件 |
| `:Lazy update` | 更新所有插件 |
| `:Lazy sync` | 同步（安装+更新+清理）|
| `:Lazy clean` | 清理未使用的插件 |
| `:Lazy check` | 检查插件更新 |
| `:Lazy restore` | 从 lockfile 恢复 |
| `:Lazy reload 插件名` | 重载插件 |
| `:Lazy home` | 显示首页 |
| `:Lazy profile` | 启动性能分析 |
| `:Lazy debug` | 调试信息 |
| `:Lazy help` | 帮助 |

### 快捷键（在 Lazy 界面中）

| 按键 | 功能 |
|------|------|
| `?` | 显示帮助 |
| `i` | 安装插件 |
| `u` | 更新插件 |
| `x` | 卸载插件 |
| `r` | 恢复插件 |
| `s` | 筛选插件 |
| `f` | 筛选条件 |
| `p` | 插件详情 |
| `l` | 日志 |
| `q` | 退出 |

---

## 插件管理实践

### 1. 查看插件状态

```vim
:Lazy
```

界面说明：
- 🟢 已加载
- ⚪ 未加载
- 🔵 更新中
- 🟡 可更新
- 🔴 错误

### 2. 更新插件

```vim
:Lazy update
```

### 3. 解决冲突

```vim
" 查看日志
:Lazy log

" 回滚到之前版本
:Lazy restore

" 清理缓存
:Lazy clean
```

### 4. 性能优化

```vim
" 查看启动时间
:Lazy profile

" 查看详情
:Lazy profile debug
```

---

## 常用插件推荐

### 主题外观

```lua
-- 热门主题
{ "catppuccin/nvim", name = "catppuccin", priority = 1000 }
{ "folke/tokyonight.nvim", priority = 1000 }
{ "rebelot/kanagawa.nvim" }
{ "EdenEast/nightfox.nvim" }
{ "sainnhe/everforest" }
```

### 文件管理

```lua
-- 文件树
{ "nvim-neo-tree/neo-tree.nvim" }

-- 模糊查找
{ "nvim-telescope/telescope.nvim" }

-- 文件书签
{ "ThePrimeagen/harpoon", branch = "harpoon2" }
```

### 编辑增强

```lua
-- 多光标
{ "mg979/vim-visual-multi" }

-- 快速跳转
{ "folke/flash.nvim" }

-- 成对编辑
{ "echasnovski/mini.pairs" }

--  surround
{ "echasnovski/mini.surround" }

-- 注释
{ "echasnovski/mini.comment" }

-- 缩进线
{ "lukas-reineke/indent-blankline.nvim" }
```

### Git 集成

```lua
-- Git 标记
{ "lewis6991/gitsigns.nvim" }

-- Git 管理
{ "tpope/vim-fugitive" }

-- LazyGit
{ "kdheepak/lazygit.nvim" }

-- Diff 查看
{ "sindrets/diffview.nvim" }
```

### 代码开发

```lua
-- 语法高亮
{ "nvim-treesitter/nvim-treesitter", build = ":TSUpdate" }

-- 自动补全
{ "hrsh7th/nvim-cmp" }

-- LSP
{ "neovim/nvim-lspconfig" }

-- 格式化
{ "stevearc/conform.nvim" }

-- Linting
{ "mfussenegger/nvim-lint" }

-- AI 辅助
{ "github/copilot.vim" }
{ "supermaven-inc/supermaven-nvim" }
```

### 终端与工具

```lua
-- 浮动终端
{ "akinsho/toggleterm.nvim" }

-- 会话管理
{ "rmagatti/auto-session" }

-- 项目管理
{ "ahmedkhalf/project.nvim" }

-- 快捷键提示
{ "folke/which-key.nvim" }

-- 通知
{ "rcarriga/nvim-notify" }
```

---

## 完整配置示例

```lua
-- lua/plugins/my-config.lua
return {
  -- 主题
  {
    "catppuccin/nvim",
    name = "catppuccin",
    priority = 1000,
    config = function()
      require("catppuccin").setup({
        flavour = "mocha",
        transparent_background = true,
      })
      vim.cmd.colorscheme "catppuccin"
    end,
  },

  -- Telescope 配置
  {
    "nvim-telescope/telescope.nvim",
    cmd = "Telescope",
    keys = {
      { "<leader>ff", "<cmd>Telescope find_files<cr>", desc = "Find Files" },
      { "<leader>fg", "<cmd>Telescope live_grep<cr>", desc = "Live Grep" },
      { "<leader>fb", "<cmd>Telescope buffers<cr>", desc = "Buffers" },
    },
    opts = {
      defaults = {
        layout_strategy = "horizontal",
        layout_config = {
          prompt_position = "top",
        },
        sorting_strategy = "ascending",
      },
    },
  },

  -- 只在特定文件类型加载
  {
    "iamcco/markdown-preview.nvim",
    ft = "markdown",
    build = function()
      vim.fn["mkdp#util#install"]()
    end,
  },

  -- 延迟加载的插件
  {
    "tpope/vim-surround",
    event = "VeryLazy",
  },
}
```

---

## 故障排查

### 插件无法加载

```vim
" 检查错误
:messages

" 查看详细日志
:Lazy log

" 检查配置语法
:luafile %
```

### 启动变慢

```vim
" 分析启动时间
:Lazy profile

" 查看哪些插件慢
:Lazy profile debug
```

### 插件冲突

```lua
-- 禁用 LazyVim 默认插件
{ "folke/flash.nvim", enabled = false }

-- 或者用优先级覆盖
{ "folke/flash.nvim", priority = 1001 }
```

### 清理缓存

```bash
# 删除所有缓存
rm -rf ~/.local/share/nvim/lazy
rm -rf ~/.cache/nvim

# 重启后重新安装
nvim
:Lazy restore
```

---

## 最佳实践

### 1. 延迟加载优先
```lua
-- ✅ 好：延迟加载
{ "插件", cmd = "命令" }
{ "插件", event = "VeryLazy" }

-- ❌ 差：立即加载
{ "插件" }
```

### 2. 使用 opts 而不是 config
```lua
-- ✅ 好：使用 opts
opts = { option = "value" }

-- ❌ 差：手动 setup
config = function()
  require("plugin").setup({ option = "value" })
end
```

### 3. 一个插件一个文件
```lua
-- lua/plugins/
--   ├── telescope.lua
--   ├── treesitter.lua
--   ├── lsp.lua
--   └── colorscheme.lua
```

### 4. 版本锁定（生产环境）
```lua
{ "插件", version = "v2.0.0" }  -- 指定版本
{ "插件", commit = "abc123" }    -- 指定 commit
{ "插件", pin = true }           -- 锁定当前版本
```

---

## 参考链接

- [lazy.nvim 文档](https://github.com/folke/lazy.nvim)
- [LazyVim 插件文档](https://www.lazyvim.org/plugins)
- [Awesome Neovim](https://github.com/rockerBOO/awesome-neovim)
