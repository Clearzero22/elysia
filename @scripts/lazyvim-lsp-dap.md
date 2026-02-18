# LazyVim LSP & DAP 完全指南

## 概念解释

### LSP (Language Server Protocol)
语言服务器协议，提供代码智能功能：
- 代码补全、语法检查
- 跳转到定义/引用
- 重命名重构
- 悬浮文档提示
- 代码格式化

### DAP (Debug Adapter Protocol)
调试适配器协议，提供调试功能：
- 断点设置
- 单步执行
- 变量查看
- 调用堆栈
- 表达式求值

### Mason
LazyVim 使用的包管理器，用于安装：
- LSP Servers（语言服务器）
- DAP Adapters（调试适配器）
- Linters（代码检查器）
- Formatters（代码格式化工具）

---

## Mason 管理工具

### 打开 Mason

```vim
: Mason
```

或快捷键：
```vim
<Space> m     # 打开 Mason
```

### Mason 界面操作

| 按键 | 功能 |
|------|------|
| `i` | 安装选中的包 |
| `u` | 更新选中的包 |
| `X` | 卸载选中的包 |
| `f` | 筛选（LSP/DAP/Linter/Formatter）|
| `g?` | 帮助 |
| `q` / `<Esc>` | 退出 |

---

## LSP 管理

### 常用 LSP Servers

| 语言 | LSP Server | 安装命令 |
|------|-----------|---------|
| TypeScript/JavaScript | `typescript-language-server` | `:Mason` → 找到后按 `i` |
| Python | `pyright` 或 `ruff-lsp` | Mason 中安装 |
| Rust | `rust-analyzer` | Mason 中安装 |
| Go | `gopls` | Mason 中安装 |
| Lua | `lua-language-server` | Mason 中安装 |
| C/C++ | `clangd` | Mason 中安装 |
| Zig | `zls` | Mason 中安装 |
| Bash | `bash-language-server` | Mason 中安装 |
| JSON | `json-lsp` | Mason 中安装 |
| YAML | `yaml-language-server` | Mason 中安装 |

### LSP 快捷键

| 快捷键 | 功能 |
|--------|------|
| `gd` | Go to Definition（跳转到定义）|
| `gD` | Go to Declaration（跳转到声明）|
| `gr` | Find References（查找引用）|
| `gi` | Go to Implementation（跳转到实现）|
| `gt` | Go to Type Definition（跳转到类型定义）|
| `K` | Hover Documentation（悬浮文档）|
| `<Space>ca` | Code Action（代码动作）|
| `<Space>cr` | Rename（重命名）|
| `<Space>cf` | Format（格式化）|
| `<Space>cd` | Show Diagnostics（显示诊断）|
| `]d` | Next Diagnostic（下一个诊断）|
| `[d` | Previous Diagnostic（上一个诊断）|
| `<Space>cs` | LSP Info（LSP 信息）|
| `<Space>cR` | Restart LSP（重启 LSP）|

### LSP 配置示例

```lua
-- ~/.config/nvim/lua/plugins/lsp.lua
return {
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        -- TypeScript
        tsserver = {
          settings = {
            typescript = {
              inlayHints = {
                includeInlayParameterNameHints = "all",
              },
            },
          },
        },
        -- Python
        pyright = {
          settings = {
            python = {
              analysis = {
                typeCheckingMode = "basic",
              },
            },
          },
        },
        -- Lua
        lua_ls = {
          settings = {
            Lua = {
              diagnostics = {
                globals = { "vim" },
              },
            },
          },
        },
      },
    },
  },
}
```

---

## DAP 管理

### 打开 DAP 调试

```vim
<Space> d     # DAP 相关命令
```

### DAP 安装调试适配器

在 Mason 中安装 DAP adapters：

| 语言 | DAP Adapter | Mason 名称 |
|------|------------|-----------|
| Python | debugpy | `debugpy` |
| Node.js | node-debug2 | `node-debug2-adapter` |
| C/C++/Rust | codelldb | `codelldb` |
| Go | delve | `delve` |
| Bash | bash-debug-adapter | `bash-debug-adapter` |

### DAP 快捷键

| 快捷键 | 功能 |
|--------|------|
| `<Space>db` | Toggle Breakpoint（切换断点）|
| `<Space>dB` | Conditional Breakpoint（条件断点）|
| `<Space>dc` | Continue（继续运行）|
| `<Space>dC` | Run to Cursor（运行到光标）|
| `<Space>di` | Step Into（步入）|
| `<Space>do` | Step Over（步过）|
| `<Space>dO` | Step Out（步出）|
| `<Space>dt` | Terminate（终止调试）|
| `<Space>dr` | Toggle REPL（打开交互式控制台）|
| `<Space>dw` | Hover Variables（悬浮显示变量）|
| `<Space>df` | Show Frames（显示调用堆栈）|
| `<Space>ds` | Show Scopes（显示作用域）|

### DAP UI

调试时自动显示：
- **Scopes** - 变量作用域
- **Breakpoints** - 断点列表
- **Stacks** - 调用堆栈
- **Watches** - 监视表达式

### DAP 配置示例

```lua
-- ~/.config/nvim/lua/plugins/dap.lua
return {
  {
    "mfussenegger/nvim-dap",
    dependencies = {
      "rcarriga/nvim-dap-ui",
    },
    config = function()
      local dap = require("dap")
      local dapui = require("dapui")
      
      -- Python 配置
      dap.adapters.python = {
        type = "executable",
        command = "python",
        args = { "-m", "debugpy.adapter" },
      }
      
      dap.configurations.python = {
        {
          type = "python",
          request = "launch",
          name = "Launch file",
          program = "${file}",
          pythonPath = function()
            return "/usr/bin/python"
          end,
        },
      }
      
      -- 自动打开/关闭 DAP UI
      dap.listeners.after.event_initialized["dapui_config"] = function()
        dapui.open()
      end
      dap.listeners.before.event_terminated["dapui_config"] = function()
        dapui.close()
      end
      dap.listeners.before.event_exited["dapui_config"] = function()
        dapui.close()
      end
    end,
  },
}
```

---

## 代码检查器 (Linter) & 格式化工具 (Formatter)

### 常用工具

| 语言 | Linter | Formatter |
|------|--------|-----------|
| Python | `ruff`, `pylint` | `black`, `ruff` |
| JavaScript/TypeScript | `eslint` | `prettier` |
| Lua | `luacheck` | `stylua` |
| Go | `golangci-lint` | `gofmt` |
| Rust | `clippy` | `rustfmt` |
| Bash | `shellcheck` | `shfmt` |
| JSON | `jsonlint` | `jq` |
| YAML | `yamllint` | `yamlfmt` |

### 在 Mason 中安装

```vim
:Mason
```

然后按 `f` 筛选：
- `l` - 显示 Linters
- `f` - 显示 Formatters

---

## 故障排查

### LSP 问题

```vim
:checkhealth lspconfig    # 检查 LSP 健康状态
:LspInfo                  # 查看当前 LSP 状态
:LspLog                   # 查看 LSP 日志
:LspRestart               # 重启 LSP
```

**常见问题：**

1. **LSP 没有启动**
   - 检查是否在 Mason 中安装了对应 server
   - 检查 `:LspInfo` 看是否有客户端连接
   - 确认文件类型被识别（`:set filetype?`）

2. **补全不工作**
   - 检查 `nvim-cmp` 是否正常工作
   - 检查 LSP 是否已 attach（`:LspInfo`）

3. **格式化不工作**
   - 检查是否安装了 formatter（Mason 或系统）
   - 尝试 `<Space>cf` 手动格式化
   - 检查 null-ls 配置

### DAP 问题

```vim
:DapShowLog               # 查看 DAP 日志
```

**常见问题：**

1. **无法启动调试**
   - 检查是否在 Mason 中安装了对应的 debug adapter
   - 检查配置中的 `program` 路径是否正确
   - 检查是否有权限执行目标文件

2. **断点不生效**
   - 确保启动了正确的调试配置
   - 检查是否开启了优化（某些编译器优化会改变代码位置）

---

## 快速安装命令

```bash
# 在 Neovim 中执行

" 打开 Mason 安装界面
:Mason

" 安装所有推荐工具（LazyVim 自带）
:MasonInstallAll

" 常用一键安装
:MasonInstall lua-language-server typescript-language-server pyright rust-analyzer gopls
:MasonInstall black prettier stylua rustfmt
:MasonInstall debugpy codelldb delve
```

---

## 参考链接

- [Mason.nvim](https://github.com/williamboman/mason.nvim)
- [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
- [nvim-dap](https://github.com/mfussenegger/nvim-dap)
- [nvim-dap-ui](https://github.com/rcarriga/nvim-dap-ui)
