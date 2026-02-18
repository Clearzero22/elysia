#!/bin/bash

# QEMU 一键安装脚本
# 支持 Ubuntu/Debian、CentOS/RHEL/Fedora、Arch Linux

set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 检测发行版
detect_distro() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        echo "$ID"
    elif [[ -f /etc/redhat-release ]]; then
        echo "rhel"
    elif [[ -f /etc/debian_version ]]; then
        echo "debian"
    else
        echo "unknown"
    fi
}

# 检查是否已安装
check_existing() {
    if command -v qemu-system-x86_64 >/dev/null 2>&1; then
        local version
        version=$(qemu-system-x86_64 --version | head -1)
        warn "检测到已安装: $version"
        read -rp "是否重新安装/更新? [y/N]: " confirm
        [[ "$confirm" =~ ^[Yy]$ ]] || { info "取消安装"; exit 0; }
    fi
}

# Ubuntu/Debian 安装
install_debian() {
    info "使用 apt 安装 QEMU..."
    
    sudo apt-get update
    
    # 安装 QEMU 及常用工具
    sudo apt-get install -y \
        qemu-system \
        qemu-utils \
        qemu-kvm \
        libvirt-daemon-system \
        virt-manager \
        bridge-utils
    
    # 添加用户到 kvm 组
    sudo usermod -aG kvm "$(whoami)"
    sudo usermod -aG libvirt "$(whoami)"
}

# CentOS/RHEL/Fedora 安装
install_rhel() {
    info "使用 dnf/yum 安装 QEMU..."
    
    local pkg_manager="dnf"
    command -v dnf >/dev/null 2>&1 || pkg_manager="yum"
    
    sudo $pkg_manager install -y \
        qemu-kvm \
        qemu-img \
        virt-manager \
        libvirt \
        libvirt-python \
        libguestfs-tools \
        bridge-utils
    
    # 启动 libvirtd
    sudo systemctl start libvirtd
    sudo systemctl enable libvirtd
    
    # 添加用户到 kvm 组
    sudo usermod -aG kvm "$(whoami)"
    sudo usermod -aG libvirt "$(whoami)"
}

# Arch Linux 安装
install_arch() {
    info "使用 pacman 安装 QEMU..."
    
    sudo pacman -Sy --noconfirm \
        qemu-full \
        virt-manager \
        virt-viewer \
        dnsmasq \
        bridge-utils \
        libguestfs
    
    # 启动 libvirtd
    sudo systemctl start libvirtd.service
    sudo systemctl enable libvirtd.service
    
    # 添加用户到 kvm 组
    sudo usermod -aG kvm "$(whoami)"
}

# 通用安装（源码编译）- 可选
install_from_source() {
    warn "从源码编译安装 QEMU（耗时较长）..."
    
    # 安装依赖
    case "$(detect_distro)" in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y git build-essential ninja-build \
                libglib2.0-dev libfdt-dev libpixman-1-dev zlib1g-dev \
                libslirp-dev libkrb5-dev libgtk-3-dev libsdl2-dev
            ;;
        fedora|rhel|centos)
            sudo dnf install -y git gcc make ninja-build \
                glib2-devel pixman-devel zlib-devel libslirp-devel \
                gtk3-devel SDL2-devel
            ;;
        arch)
            sudo pacman -Sy --noconfirm git base-devel ninja \
                glib2 pixman zlib libslirp gtk3 sdl2
            ;;
    esac
    
    # 下载源码
    local temp_dir=$(mktemp -d)
    cd "$temp_dir"
    
    git clone --depth 1 --branch v9.2.0 https://gitlab.com/qemu-project/qemu.git
    cd qemu
    
    # 编译安装
    ./configure \
        --prefix=/usr/local \
        --target-list=x86_64-softmmu,aarch64-softmmu,riscv64-softmmu \
        --enable-kvm \
        --enable-slirp \
        --enable-gtk \
        --enable-sdl
    
    make -j"$(nproc)"
    sudo make install
    
    cd /
    rm -rf "$temp_dir"
}

# 验证安装
verify_install() {
    info "验证 QEMU 安装..."
    
    if command -v qemu-system-x86_64 >/dev/null 2>&1; then
        local version
        version=$(qemu-system-x86_64 --version | head -1)
        success "$version"
        
        # 显示支持的架构
        info "支持的架构:"
        qemu-system-x86_64 --target-list 2>/dev/null | head -5 || true
        
        # 检查 KVM 支持
        if [[ -e /dev/kvm ]]; then
            success "KVM 加速已启用"
        else
            warn "KVM 未启用（虚拟机中运行或 CPU 不支持虚拟化）"
        fi
    else
        error "QEMU 安装失败"
    fi
}

# 显示使用帮助
show_usage() {
    echo ""
    echo "========================================"
    success "QEMU 安装完成！"
    echo ""
    echo "常用命令:"
    echo "  qemu-system-x86_64 --version     # 查看版本"
    echo "  qemu-system-x86_64 -h            # 帮助信息"
    echo ""
    echo "创建虚拟机示例:"
    echo "  qemu-img create -f qcow2 disk.img 20G"
    echo "  qemu-system-x86_64 -hda disk.img -boot d -cdrom os.iso -m 4G -enable-kvm"
    echo ""
    echo "注意: 需要重新登录以应用用户组权限变更"
    echo "========================================"
}

# 主函数
main() {
    echo "========================================"
    echo "     QEMU 一键安装脚本"
    echo "========================================"
    echo ""
    
    # 检查 sudo 权限
    if ! sudo -n true 2>/dev/null; then
        warn "需要 sudo 权限进行安装"
        sudo -v || error "无法获取 sudo 权限"
    fi
    
    # 检测发行版
    DISTRO=$(detect_distro)
    info "检测到系统: $DISTRO"
    
    # 检查现有安装
    check_existing
    
    # 安装方式选择
    local install_method="package"
    if [[ "$1" == "--source" ]]; then
        install_method="source"
    fi
    
    # 执行安装
    if [[ "$install_method" == "source" ]]; then
        install_from_source
    else
        case "$DISTRO" in
            ubuntu|debian)
                install_debian
                ;;
            fedora|rhel|centos|rocky|almalinux)
                install_rhel
                ;;
            arch|manjaro)
                install_arch
                ;;
            *)
                error "不支持的发行版: $DISTRO\n请使用 --source 从源码编译安装"
                ;;
        esac
    fi
    
    # 验证
    verify_install
    
    # 显示使用帮助
    show_usage
}

main "$@"
