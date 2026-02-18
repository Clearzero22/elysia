#!/bin/bash

# Zig 一键安装脚本
# 支持 Linux x86_64，安装到 ~/.local/bin

set -e

# 配置
ZIG_VERSION="0.15.2"
ZIG_ARCH="x86_64-linux"
ZIG_TARBALL="zig-${ZIG_ARCH}-${ZIG_VERSION}.tar.xz"
ZIG_URL="https://ziglang.org/download/${ZIG_VERSION}/${ZIG_TARBALL}"
INSTALL_DIR="$HOME/.local/zig-${ZIG_VERSION}"
BIN_DIR="$HOME/.local/bin"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# 检查依赖
check_deps() {
    info "检查依赖..."
    command -v curl >/dev/null 2>&1 || error "需要 curl，请先安装"
    command -v tar >/dev/null 2>&1 || error "需要 tar，请先安装"
    success "依赖检查通过"
}

# 检查是否已安装
check_existing() {
    if command -v zig >/dev/null 2>&1; then
        local current_version
        current_version=$(zig version)
        warn "检测到已安装 Zig ${current_version}"
        read -rp "是否覆盖安装? [y/N]: " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            info "取消安装"
            exit 0
        fi
    fi
}

# 下载 Zig
download_zig() {
    local temp_dir
    temp_dir=$(mktemp -d)
    cd "$temp_dir"
    
    info "下载 Zig ${ZIG_VERSION}..."
    info "URL: ${ZIG_URL}"
    
    if curl -fsSL --progress-bar -o "${ZIG_TARBALL}" "${ZIG_URL}"; then
        success "下载完成"
    else
        error "下载失败，请检查网络连接"
    fi
    
    info "解压中..."
    tar -xf "${ZIG_TARBALL}"
    
    # 获取解压后的目录名
    ZIG_EXTRACT_DIR=$(tar -tf "${ZIG_TARBALL}" | head -1 | cut -f1 -d'/')
    
    cd - >/dev/null
    
    # 保存路径到变量，而不是 echo
    SOURCE_DIR="${temp_dir}/${ZIG_EXTRACT_DIR}"
}

# 安装
install_zig() {
    local source_dir=$1
    
    info "安装到 ${INSTALL_DIR}..."
    
    # 创建目录
    mkdir -p "$BIN_DIR"
    
    # 如果已存在，备份
    if [[ -d "$INSTALL_DIR" ]]; then
        local backup_dir="${INSTALL_DIR}.backup.$(date +%Y%m%d%H%M%S)"
        warn "目录已存在，备份到 ${backup_dir}"
        mv "$INSTALL_DIR" "$backup_dir"
    fi
    
    # 移动文件
    mv "$source_dir" "$INSTALL_DIR"
    
    # 创建软链
    ln -sf "${INSTALL_DIR}/zig" "${BIN_DIR}/zig"
    
    success "安装完成"
}

# 配置 PATH
setup_path() {
    info "配置 PATH..."
    
    local shell_rc=""
    local current_shell
    current_shell=$(basename "$SHELL")
    
    case "$current_shell" in
        bash)
            shell_rc="$HOME/.bashrc"
            ;;
        zsh)
            shell_rc="$HOME/.zshrc"
            ;;
        fish)
            shell_rc="$HOME/.config/fish/config.fish"
            ;;
        *)
            shell_rc="$HOME/.bashrc"
            ;;
    esac
    
    # 检查是否已配置
    if [[ -f "$shell_rc" ]] && grep -q "${BIN_DIR}" "$shell_rc" 2>/dev/null; then
        info "PATH 已配置在 ${shell_rc}"
    else
        info "添加 PATH 到 ${shell_rc}..."
        mkdir -p "$(dirname "$shell_rc")"
        echo "" >> "$shell_rc"
        echo "# Zig" >> "$shell_rc"
        echo "export PATH=\"${BIN_DIR}:\$PATH\"" >> "$shell_rc"
        success "PATH 配置完成"
    fi
    
    # 立即生效（当前会话）
    export PATH="${BIN_DIR}:$PATH"
}

# 验证安装
verify_install() {
    info "验证安装..."
    
    if command -v zig >/dev/null 2>&1; then
        local version
        version=$(zig version)
        success "Zig ${version} 安装成功！"
        
        # 测试编译
        local test_file
        test_file=$(mktemp /tmp/test_XXXXXX.zig)
        cat > "$test_file" << 'EOF'
const std = @import("std");

pub fn main() void {
    std.debug.print("Hello from Zig!\n", .{});
}
EOF
        
        if zig run "$test_file" 2>/dev/null; then
            success "编译测试通过！"
        else
            warn "编译测试失败"
        fi
        
        rm -f "$test_file"
    else
        error "验证失败，zig 命令未找到"
    fi
}

# 清理
cleanup() {
    if [[ -n "${TEMP_DIR:-}" && -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}

# 主函数
main() {
    echo "========================================"
    echo "     Zig ${ZIG_VERSION} 一键安装脚本"
    echo "========================================"
    echo ""
    
    # 注册清理函数
    trap cleanup EXIT
    
    check_deps
    check_existing
    
    TEMP_DIR=$(mktemp -d)
    SOURCE_DIR=""
    download_zig
    
    install_zig "$SOURCE_DIR"
    setup_path
    verify_install
    
    echo ""
    echo "========================================"
    success "安装完成！"
    echo ""
    echo "使用说明:"
    echo "  zig version    # 查看版本"
    echo "  zig run xxx.zig # 运行程序"
    echo "  zig build      # 构建项目"
    echo ""
    echo "注意：如果 zig 命令未找到，请运行:"
    echo "  source ~/.bashrc  # 或 ~/.zshrc"
    echo "========================================"
}

main "$@"
