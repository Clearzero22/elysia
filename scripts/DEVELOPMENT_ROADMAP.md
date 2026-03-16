# Terminal Tools - 开发优化路线图

> 版本: v1.0.0 | 更新日期: 2026-03-17

---

## 目录

1. [项目概述](#1-项目概述)
2. [当前架构分析](#2-当前架构分析)
3. [问题清单](#3-问题清单)
4. [优化路线图](#4-优化路线图)
5. [技术债务](#5-技术债务)
6. [实施计划](#6-实施计划)

---

## 1. 项目概述

### 1.1 项目结构

```
scripts/
├── install-tools.sh       # 工具安装脚本
├── tmux-select.sh         # Tmux 会话选择器
├── dev_tools.md          # 终端工具指南
├── tmux/                 # Tmux 配置和脚本
│   ├── install.sh               # 一键安装脚本
│   ├── tmux-project.sh          # Claude Code 版本
│   ├── tmux-project-kimi.sh     # Kimi 版本
│   ├── tmux-project-qwen.sh     # Qwen 版本
│   ├── tmux-project-gemini.sh   # Gemini 版本
│   ├── tmux-project-opencode.sh # OpenCode 版本
│   ├── tmux-dev.sh              # Elysia 专用
│   ├── memory-leak-test.sh      # 内存泄漏测试
│   ├── .tmux.conf               # Tmux 配置
│   └── Makefile                 # 管理命令
├── config-backup/        # 配置备份 (nvim, alacritty)
└── other_btop_content/   # btop 配置
```

### 1.2 功能定位

- **核心功能**: 为不同 AI 项目提供 tmux 多窗口开发环境
- **辅助功能**: 工具安装、会话管理、配置备份
- **目标用户**: 使用 AI 辅助开发的开发者

---

## 2. 当前架构分析

### 2.1 代码质量评估

| 脚本 | LOC | 重复率 | 可维护性 | 评分 |
|------|-----|--------|----------|------|
| `tmux-project.sh` | 248 | - | B | 7/10 |
| `tmux-project-kimi.sh` | 247 | 98% | B | 7/10 |
| `tmux-project-qwen.sh` | ~247 | 98% | B | 7/10 |
| `tmux-project-gemini.sh` | ~247 | 98% | B | 7/10 |
| `tmux-project-opencode.sh` | ~247 | 98% | B | 7/10 |
| `tmux-dev.sh` | 219 | 85% | C | 5/10 |
| `install.sh` | 276 | - | A | 8/10 |
| `tmux-select.sh` | 71 | - | A | 8/10 |
| `memory-leak-test.sh` | 117 | - | C | 6/10 |

### 2.2 设计原则违背

| 原则 | 违背情况 | 严重程度 |
|------|----------|----------|
| **DRY** | 5 个 AI 项目脚本重复 98% 代码 | 🔴 高 |
| **SOLID-S** | 单个脚本承担配置、布局、启动多重职责 | 🟡 中 |
| **OCP** | 添加新 AI 需要复制整个文件 | 🔴 高 |
| **KISS** | 配置硬编码，缺乏抽象 | 🟡 中 |
| **YAGNI** | memory-leak-test.sh 与项目目标不符 | 🟢 低 |

---

## 3. 问题清单

### 3.1 代码重复 (DRY 违背)

**问题**: 5 个 AI 项目脚本几乎完全相同

```bash
# tmux-project.sh
SESSION_NAME="dev-${PROJECT_NAME}"
if command -v claude &> /dev/null; then
    tmux send-keys ... "claude" Enter
fi

# tmux-project-kimi.sh
SESSION_NAME="kimi-${PROJECT_NAME}"
if command -v kimi &> /dev/null; then
    tmux send-keys ... "kimi" Enter
fi
```

**影响**:
- 修改需要同步 5 个文件
- 增加维护成本
- 容易出现不一致

### 3.2 硬编码路径

**位置**: `tmux-dev.sh:9`
```bash
PROJECT_DIR="/home/clearzero22/my_projects/elysia"
```

**问题**: 无法在其他环境使用

### 3.3 缺乏配置系统

**问题**: 所有配置硬编码在脚本中
- 窗口定义
- 窗格布局
- AI 命令
- 会话命名规则

**影响**: 无法灵活配置

### 3.4 错误处理不足

**示例**: `tmux-select.sh:38`
```bash
selected=$(echo "$sessions" | fzf ...)
if [ -n "$selected" ]; then
    tmux attach -t "$selected"
fi
# 没有处理 attach 失败的情况
```

### 3.5 依赖检查分散

**问题**: 每个脚本独立检查依赖

```bash
# 每个脚本都有
check_command "tmux" || { echo "Error: tmux required"; exit 1; }
check_command "nvim" || echo "Warning: nvim not found"
```

### 3.6 测试覆盖不足

**Makefile test 目标**:
```makefile
test:
    @bash -n tmux-project-kimi.sh && echo "✓ tmux-project-kimi.sh OK"
```

**问题**: 仅检查语法，无功能测试

### 3.7 文档语言不统一

- README.md: 中文
- 脚本注释: 英文
- dev_tools.md: 中文

---

## 4. 优化路线图

### Phase 1: 代码重构 (优先级: 🔴 高)

#### 1.1 统一核心脚本

**目标**: 消除代码重复，单一脚本支持所有 AI

**设计**:
```bash
# tmux-project-unified.sh
AI_VARIANT="${1:-claude}"  # claude, kimi, qwen, gemini, opencode
PROJECT_DIR="${2:-$(pwd)}"

# AI 命令映射
declare -A AI_COMMANDS=(
    ["claude"]="claude"
    ["kimi"]="kimi"
    ["qwen"]="qwen"
    ["gemini"]="gemini"
    ["opencode"]="opencode"
)

declare -A SESSION_PREFIXES=(
    ["claude"]="dev"
    ["kimi"]="kimi"
    ["qwen"]="qwen"
    ["gemini"]="gemini"
    ["opencode"]="opencode"
)
```

**迁移命令**:
```bash
# 旧
./tmux-project-kimi.sh ~/my-project

# 新
./tmux-project.sh kimi ~/my-project
```

#### 1.2 配置文件系统

**新增** `~/.config/terminal-tools/config.yaml`:
```yaml
# AI 助手配置
ai:
  default: claude
  commands:
    claude: claude
    kimi: kimi
    qwen: qwen
    gemini: gemini
    opencode: opencode

# 窗口配置
windows:
  - name: architect
    description: System design, architecture
  - name: ux-ui
    description: User experience, interface
  # ...

# 布局配置
layout:
  type: triple-pane  # triple-pane, dual-pane, single
  pane1:
    tool: ai
    position: top-left
  pane2:
    tool: lazygit
    position: bottom-left
  pane3:
    tool: nvim
    position: right
```

#### 1.3 模块化架构

```
lib/
├── core.sh              # 核心函数
│   ├── check_dependencies()
│   ├── create_session()
│   └── setup_window()
├── config.sh            # 配置加载
│   ├── load_config()
│   └── validate_config()
├── layout.sh            # 布局管理
│   ├── apply_layout()
│   └── get_layout()
└── ai.sh                # AI 助手管理
    ├── get_ai_command()
    └── detect_ai_tools()
```

### Phase 2: 增强功能 (优先级: 🟡 中)

#### 2.1 模板系统

**新增** `templates/`:
```
templates/
├── fullstack.yaml       # 全栈项目 (8 窗口)
├── backend.yaml         # 后端项目 (4 窗口)
├── frontend.yaml        # 前端项目 (3 窗口)
├── docs.yaml            # 文档项目 (2 窗口)
└── custom.yaml          # 用户自定义
```

**使用**:
```bash
./tmux-project.sh --template backend ~/my-api
```

#### 2.2 会话持久化

**新增功能**:
```bash
# 保存当前会话布局
./tmux-project.sh --save my-session

# 恢复会话
./tmux-project.sh --restore my-session

# 列出保存的会话
./tmux-project.sh --list-saved
```

#### 2.3 插件系统

**设计**:
```bash
# plugins/before-start.sh
# 在会话创建前执行

# plugins/after-start.sh
# 在会话创建后执行

# plugins/custom-layout.sh
# 自定义布局
```

### Phase 3: 生态完善 (优先级: 🟢 低)

#### 3.1 包管理器

```bash
# 安装社区模板
tctl template install github:user/template

# 更新工具
tctl update

# 管理配置
tctl config edit
```

#### 3.2 CI/CD 集成

- GitHub Actions 自动测试
- 自动发布到 Homebrew
- 跨平台兼容性测试

---

## 5. 技术债务

### 5.1 需要偿还的债务

| 债务 | 影响 | 工作量 | 优先级 |
|------|------|--------|--------|
| 5 个 AI 脚本重复 | 维护困难 | 4h | 🔴 |
| 硬编码路径 | 不可移植 | 1h | 🔴 |
| 缺乏测试 | 质量风险 | 8h | 🟡 |
| 文档不统一 | 用户体验 | 2h | 🟢 |
| memory-leak-test.sh 无关 | 代码混乱 | 0.5h | 🟢 |

### 5.2 建议删除

- `memory-leak-test.sh` - 与项目目标无关，应移到单独仓库

### 5.3 建议合并

- `config-backup/` - 应移到独立的 dotfiles 仓库

---

## 6. 实施计划

### Sprint 1: 核心重构 (Week 1)

**目标**: 消除代码重复

- [ ] 创建 `lib/` 目录
- [ ] 实现 `lib/core.sh`
- [ ] 实现 `lib/config.sh`
- [ ] 合并 5 个 AI 脚本为 `tmux-project.sh`
- [ ] 添加向后兼容的软链接
- [ ] 更新文档

**验收标准**:
```bash
# 新命令可用
./tmux-project.sh claude ~/project
./tmux-project.sh kimi ~/project

# 旧命令仍可用（软链接）
./tmux-project-kimi.sh ~/project
```

### Sprint 2: 配置系统 (Week 2)

**目标**: 实现配置文件支持

- [ ] 设计 YAML 配置格式
- [ ] 实现 `lib/config.sh`
- [ ] 添加默认配置
- [ ] 实现配置验证
- [ ] 添加 `--config` 选项

**验收标准**:
```bash
# 使用自定义配置
./tmux-project.sh --config ~/my-config.yaml ~/project
```

### Sprint 3: 模板系统 (Week 3)

**目标**: 支持项目模板

- [ ] 创建 `templates/` 目录
- [ ] 实现 4 个默认模板
- [ ] 添加 `--template` 选项
- [ ] 实现模板继承

**验收标准**:
```bash
./tmux-project.sh --template backend ~/my-api
```

### Sprint 4: 测试与文档 (Week 4)

**目标**: 完善测试和文档

- [ ] 实现 BATS 测试框架
- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 统一文档语言
- [ ] 生成 man page

**验收标准**:
```bash
make test  # 所有测试通过
```

---

## 7. 代码示例

### 7.1 重构前

```bash
# tmux-project-kimi.sh (247 行)
#!/bin/bash
SESSION_NAME="kimi-${PROJECT_NAME}"
# ... 200+ 行重复代码
if command -v kimi &> /dev/null; then
    tmux send-keys ... "kimi" Enter
fi
```

### 7.2 重构后

```bash
# tmux-project.sh (统一脚本)
#!/bin/bash
source lib/core.sh
source lib/config.sh

AI_VARIANT="${1:-claude}"
PROJECT_DIR="${2:-$(pwd)}"

main() {
    load_config
    create_session "$AI_VARIANT" "$PROJECT_DIR"
    setup_windows
    attach_session
}

main "$@"
```

```bash
# lib/ai.sh
get_ai_command() {
    local variant=$1
    case "$variant" in
        claude)   echo "claude" ;;
        kimi)     echo "kimi" ;;
        qwen)     echo "qwen" ;;
        gemini)   echo "gemini" ;;
        opencode) echo "opencode" ;;
        *)        error "Unknown AI: $variant" ;;
    esac
}
```

---

## 8. 优先级总结

### 立即执行 (本周)

1. ✅ 创建 GitHub 私有仓库
2. 🔧 消除 5 个 AI 脚本重复
3. 🔧 移除硬编码路径

### 短期 (本月)

4. 📦 实现配置系统
5. 🧪 添加测试框架
6. 📖 统一文档语言

### 长期 (本季度)

7. 🎨 实现模板系统
8. 🔌 设计插件架构
9. 🚀 社区化准备

---

## 9. 成功指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 代码重复率 | 85% | <10% |
| 测试覆盖率 | 0% | >80% |
| 添加新 AI 工作量 | 复制 247 行 | 修改 5 行配置 |
| 配置灵活性 | 硬编码 | YAML 配置 |
| 文档语言 | 混乱 | 统一英文 |

---

*文档生成时间: 2026-03-17*
*维护者: Clearzero22*
