#!/bin/bash
set -euo pipefail

# EmberMux — Linux / macOS 一键安装/更新/卸载脚本

REPO="snnabb/embermux"
INSTALL_DIR="/opt/embermux"
SERVICE_NAME="embermux"
BIN_NAME="embermux"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

prompt_read() {
    local __var_name="$1"
    local __prompt="$2"
    local __value=""

    if [ -t 0 ]; then
        read -r -p "$__prompt" __value || error "读取输入失败"
    elif [ "${0##*/}" = "bash" ] || [ "${0##*/}" = "sh" ]; then
        [ -r /dev/tty ] || error "交互模式需要终端，请下载脚本后再执行: bash install.sh"
        read -r -p "$__prompt" __value < /dev/tty || error "读取终端输入失败"
    else
        read -r -p "$__prompt" __value || error "读取输入失败"
    fi

    printf -v "$__var_name" '%s' "$__value"
}

check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        error "请使用 root 用户或 sudo 执行此脚本"
    fi
}

detect_arch() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64|amd64) echo "amd64" ;;
        aarch64|arm64) echo "arm64" ;;
        *) error "不支持的架构: $arch" ;;
    esac
}

detect_os() {
    local os
    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    case "$os" in
        linux) echo "linux" ;;
        darwin) echo "darwin" ;;
        *) error "不支持的操作系统: $os" ;;
    esac
}

get_latest_version() {
    curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
        | grep '"tag_name"' | sed -E 's/.*"tag_name":\s*"([^"]+)".*/\1/'
}

get_current_version() {
    if [ -f "${INSTALL_DIR}/${BIN_NAME}" ]; then
        "${INSTALL_DIR}/${BIN_NAME}" --version 2>/dev/null | awk '{print $NF}' || echo "unknown"
    else
        echo ""
    fi
}

is_installed() {
    [ -f "${INSTALL_DIR}/${BIN_NAME}" ]
}

show_banner() {
    echo ""
    echo -e "${CYAN}  ╔═══════════════════════════════════════╗${NC}"
    echo -e "${CYAN}  ║       EmberMux 安装管理工具            ║${NC}"
    echo -e "${CYAN}  ║     Emby 多上游聚合代理                ║${NC}"
    echo -e "${CYAN}  ╚═══════════════════════════════════════╝${NC}"
    echo ""
}

show_menu() {
    if is_installed; then
        local cur
        cur=$(get_current_version)
        echo -e "  当前状态: ${GREEN}已安装${NC} (${cur})"
        echo ""
        echo "  1) 更新到最新版"
        echo "  2) 卸载"
        echo "  3) 退出"
        echo ""
        prompt_read choice "  请选择操作 [1-3]: "
        case "$choice" in
            1) do_update ;;
            2) do_uninstall ;;
            3) echo "  退出"; exit 0 ;;
            *) error "无效选择" ;;
        esac
    else
        echo -e "  当前状态: ${YELLOW}未安装${NC}"
        echo ""
        echo "  1) 安装 EmberMux"
        echo "  2) 退出"
        echo ""
        prompt_read choice "  请选择操作 [1-2]: "
        case "$choice" in
            1) do_install ;;
            2) echo "  退出"; exit 0 ;;
            *) error "无效选择" ;;
        esac
    fi
}

do_install() {
    local os arch version url
    os=$(detect_os)
    arch=$(detect_arch)
    info "检测到平台: ${os}/${arch}"

    # 平台限制
    if [ "$os" = "linux" ] && [ "$arch" = "arm64" ]; then
        warn "linux/arm64 暂不提供预编译二进制"
        echo -e "  请使用 Docker 部署: ${CYAN}docker run -d -p 8096:8096 ghcr.io/snnabb/embermux:latest${NC}"
        exit 1
    fi
    if [ "$os" = "darwin" ] && [ "$arch" = "amd64" ]; then
        error "仅提供 darwin/arm64 (Apple Silicon) 二进制，Intel Mac 请使用 Docker"
    fi

    version=$(get_latest_version)
    if [ -z "$version" ]; then
        error "无法获取最新版本号，请检查网络连接"
    fi
    info "最新版本: ${version}"

    url="https://github.com/${REPO}/releases/download/${version}/${BIN_NAME}-${os}-${arch}"
    info "下载: ${url}"
    curl -fSL "$url" -o /tmp/${BIN_NAME} || error "下载失败，请检查网络"
    chmod +x /tmp/${BIN_NAME}

    # 创建目录
    mkdir -p "${INSTALL_DIR}"/{config,data,log}
    mv /tmp/${BIN_NAME} "${INSTALL_DIR}/${BIN_NAME}"
    info "已安装到 ${INSTALL_DIR}/${BIN_NAME}"

    # 首次安装：生成配置和随机密码
    if [ ! -f "${INSTALL_DIR}/config/config.yaml" ]; then
        local pw server_id
        pw=$(head -c 18 /dev/urandom | base64 | tr -d '=+/' | head -c 18)
        server_id=$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')
        cat > "${INSTALL_DIR}/config/config.yaml" <<YAML
server:
  port: 8096
  name: "EmberMux"
  id: "embermux-${server_id}"

admin:
  username: "admin"
  password: "${pw}"

playback:
  mode: "proxy"

timeouts:
  api: 30000
  global: 15000
  login: 10000
  healthCheck: 10000
  healthInterval: 60000

proxies: []
upstream: []
YAML
        echo ""
        echo -e "  ${BOLD}══════════════════════════════════════${NC}"
        echo -e "  ${BOLD}  首次安装 — 管理员凭据${NC}"
        echo -e "  ${BOLD}══════════════════════════════════════${NC}"
        echo -e "  用户名: ${CYAN}admin${NC}"
        echo -e "  密  码: ${CYAN}${pw}${NC}"
        echo -e "  ${BOLD}══════════════════════════════════════${NC}"
        echo ""
        warn "请立即保存此密码！登录后可在「系统设置」中修改。"
    fi

    # systemd 服务（仅 Linux）
    if [ "$os" = "linux" ]; then
        cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=EmberMux Emby Aggregation Proxy
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/${BIN_NAME}
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
        systemctl daemon-reload
        systemctl enable ${SERVICE_NAME} >/dev/null 2>&1
        systemctl restart ${SERVICE_NAME}
        info "systemd 服务已启动"
    else
        info "macOS 用户请手动启动: ${INSTALL_DIR}/${BIN_NAME}"
    fi

    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    echo ""
    info "安装完成！"
    echo -e "  管理面板: ${CYAN}http://${ip}:8096/admin${NC}"
    echo ""
}

do_update() {
    if ! is_installed; then
        error "EmberMux 未安装，请先执行安装"
    fi

    local cur latest
    cur=$(get_current_version)
    latest=$(get_latest_version)

    if [ -z "$latest" ]; then
        error "无法获取最新版本号，请检查网络连接"
    fi

    if [ "$cur" = "$latest" ]; then
        info "当前已是最新版本 (${cur})，无需更新"
        exit 0
    fi

    info "当前版本: ${cur}"
    info "最新版本: ${latest}"
    info "开始更新..."

    systemctl stop ${SERVICE_NAME} 2>/dev/null || true
    do_install
}

do_uninstall() {
    if ! is_installed; then
        warn "EmberMux 未安装"
        exit 0
    fi

    echo ""
    warn "即将卸载 EmberMux"
    prompt_read yn "  确认卸载？配置和数据将保留 [y/N]: "
    case "$yn" in
        [Yy]*) ;;
        *) echo "  取消卸载"; exit 0 ;;
    esac

    info "停止服务..."
    systemctl stop ${SERVICE_NAME} 2>/dev/null || true
    systemctl disable ${SERVICE_NAME} 2>/dev/null || true
    rm -f /etc/systemd/system/${SERVICE_NAME}.service
    systemctl daemon-reload 2>/dev/null || true
    rm -f "${INSTALL_DIR}/${BIN_NAME}"

    echo ""
    info "卸载完成"
    warn "配置和数据保留在 ${INSTALL_DIR}"
    warn "如需彻底清除: rm -rf ${INSTALL_DIR}"
    echo ""
}

# ── 入口 ──
check_root

case "${1:-}" in
    install)   do_install ;;
    update)    do_update ;;
    uninstall) do_uninstall ;;
    "")
        # 无参数：显示交互菜单（支持 curl | bash）
        show_banner
        show_menu
        ;;
    *)
        echo "用法: $0 {install|update|uninstall}"
        echo "  或直接运行进入交互菜单"
        exit 1
        ;;
esac
