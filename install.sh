#!/bin/bash
set -euo pipefail

# EmberMux — Linux 一键安装/更新/卸载脚本

REPO="snnabb/embermux"
INSTALL_DIR="/opt/embermux"
SERVICE_NAME="embermux"
BIN_NAME="embermux"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

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
    curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"tag_name":\s*"([^"]+)".*/\1/'
}

do_install() {
    local os arch version url
    os=$(detect_os)
    arch=$(detect_arch)
    info "检测到平台: ${os}/${arch}"

    version=$(get_latest_version)
    if [ -z "$version" ]; then
        error "无法获取最新版本号"
    fi
    info "最新版本: ${version}"

    url="https://github.com/${REPO}/releases/download/${version}/${BIN_NAME}-${os}-${arch}"
    info "下载: ${url}"
    curl -fSL "$url" -o /tmp/${BIN_NAME} || error "下载失败"
    chmod +x /tmp/${BIN_NAME}

    # 创建目录
    mkdir -p "${INSTALL_DIR}"/{config,data,log}
    mv /tmp/${BIN_NAME} "${INSTALL_DIR}/${BIN_NAME}"
    info "已安装到 ${INSTALL_DIR}/${BIN_NAME}"

    # 首次安装：生成随机密码
    if [ ! -f "${INSTALL_DIR}/config/config.yaml" ]; then
        local pw
        pw=$(head -c 12 /dev/urandom | base64 | tr -d '=+/' | head -c 12)
        info "首次安装，生成管理员密码: ${pw}"
        warn "请妥善保存此密码！后续可通过 ${BIN_NAME} --reset-password 重置"
        cat > "${INSTALL_DIR}/config/config.yaml" <<YAML
server:
  port: 8096
  name: "EmberMux"
  id: "embermux-$(head -c 8 /dev/urandom | xxd -p)"

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
    fi

    # systemd 服务
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
    systemctl enable ${SERVICE_NAME}
    systemctl restart ${SERVICE_NAME}
    info "服务已启动"
    info "管理面板: http://$(hostname -I | awk '{print $1}'):8096/admin"
}

do_update() {
    if [ ! -f "${INSTALL_DIR}/${BIN_NAME}" ]; then
        error "EmberMux 未安装，请先执行安装"
    fi
    info "更新 EmberMux..."
    systemctl stop ${SERVICE_NAME} 2>/dev/null || true
    do_install
}

do_uninstall() {
    info "卸载 EmberMux..."
    systemctl stop ${SERVICE_NAME} 2>/dev/null || true
    systemctl disable ${SERVICE_NAME} 2>/dev/null || true
    rm -f /etc/systemd/system/${SERVICE_NAME}.service
    systemctl daemon-reload
    warn "配置和数据保留在 ${INSTALL_DIR}，如需彻底删除请手动执行: rm -rf ${INSTALL_DIR}"
    info "卸载完成"
}

case "${1:-install}" in
    install) do_install ;;
    update)  do_update ;;
    uninstall) do_uninstall ;;
    *)
        echo "用法: $0 {install|update|uninstall}"
        exit 1
        ;;
esac
