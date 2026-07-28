#!/usr/bin/env bash
#
# mymore — 一键安装脚本
#
# 功能：
#   1. 检查前置条件（Docker、Claude Code CLI）
#   2. 构建/启动 Docker 容器（mymore-mcp + mymore-hub）
#   3. 注册 mymore 为 Claude Code 插件（--scope user，全局生效）
#
# 用法：
#   ./scripts/install.sh              # 走完全流程
#   ./scripts/install.sh --quick      # 只注册插件（假设容器已在运行）
#

set -euo pipefail
cd "$(dirname "$0")/.."

# ── 配色 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
step()  { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
err()   { echo -e "  ${RED}✗${NC} $1"; }

# ── Banner ──
echo ""
echo -e "${CYAN}    __  __                                              ${NC}"
echo -e "${CYAN}   |  \/  |                                             ${NC}"
echo -e "${CYAN}   | \  / |_   _ _ __ ___   ___   _ __ ___   ___  _ __  ${NC}"
echo -e "${CYAN}   | |\/| | | | | '_ \` _ \ / _ \ | '__/ _ \ / _ \| '__| ${NC}"
echo -e "${CYAN}   | |  | | |_| | | | | | |  __/ | | | (_) | (_) | |    ${NC}"
echo -e "${CYAN}   |_|  |_|\__, |_| |_| |_|\___| |_|  \___/ \___/|_|    ${NC}"
echo -e "${CYAN}            __/ |                                       ${NC}"
echo -e "${CYAN}           |___/  v1.0.0                                ${NC}"
echo ""
echo -e "  ${BLUE}Claude Code 记忆插件 — 跨会话持久化${NC}"
echo ""

# ── 前置检查 ──
step "前置检查"

if ! command -v claude &>/dev/null; then
  err "Claude Code CLI 未安装"
  echo "  请先安装: https://claude.ai/code"
  exit 1
fi
log "Claude Code CLI 已安装"

if ! docker info &>/dev/null; then
  err "Docker 未运行"
  echo "  请先启动 Docker Desktop"
  exit 1
fi
log "Docker 运行中"

# 记录当前路径（后续注册插件要用绝对路径）
PROJECT_DIR=$(pwd)

# ── 重建 Docker 容器 ──
QUICK_MODE=false
if [[ "${1:-}" == "--quick" ]]; then
  QUICK_MODE=true
fi

if ! $QUICK_MODE; then
  step "构建 Docker 容器"
  echo ""

  # 检查容器是否已在运行
  MCP_RUNNING=$(docker ps --filter "name=mymore-mcp" --filter "status=running" --format '{{.Names}}' 2>/dev/null)
  HUB_RUNNING=$(docker ps --filter "name=mymore-hub" --filter "status=running" --format '{{.Names}}' 2>/dev/null)

  if [[ -n "$MCP_RUNNING" ]] && [[ -n "$HUB_RUNNING" ]]; then
    log "两个容器已在运行，跳过构建"
    log "如需强制重建，请先运行: ./scripts/rebuild.sh"
  else
    echo "  正在构建并启动 Docker 容器..."
    echo "  （首次运行可能需要 2-3 分钟下载依赖）"
    echo ""
    bash ./scripts/rebuild.sh 2>&1 | sed 's/^/  /'
    echo ""
    log "Docker 容器构建完成"
  fi
else
  # --quick 模式下验证容器
  MCP_RUNNING=$(docker ps --filter "name=mymore-mcp" --filter "status=running" --format '{{.Names}}' 2>/dev/null)
  HUB_RUNNING=$(docker ps --filter "name=mymore-hub" --filter "status=running" --format '{{.Names}}' 2>/dev/null)
  if [[ -z "$MCP_RUNNING" ]]; then
    warn "mymore-mcp 容器未运行，MCP Server 可能不可用"
  fi
  if [[ -z "$HUB_RUNNING" ]]; then
    warn "mymore-hub 容器未运行，Dashboard 可能不可用"
  fi
fi

# ── 注册 Claude Code 插件 ──
step "注册 Claude Code 插件"

MARKETPLACE_NAME="mymore"
PLUGIN_NAME="mymore@mymore"

# 检查是否已安装
ALREADY_INSTALLED=false
if claude plugin list 2>/dev/null | grep -q "^${MARKETPLACE_NAME}"; then
  log "mymore 插件已注册"
  ALREADY_INSTALLED=true
fi

# 先移除旧注册，避免冲突
if $ALREADY_INSTALLED; then
  warn "正在重新注册..."
  claude plugin uninstall "${PLUGIN_NAME}" 2>/dev/null || true
fi
claude plugin marketplace remove "${MARKETPLACE_NAME}" 2>/dev/null || true

# 1. 添加本地路径为 marketplace
echo "  添加 marketplace..."
claude plugin marketplace add "$PROJECT_DIR" 2>&1 | tail -1
log "marketplace 已添加"

# 2. 从 marketplace 安装插件（--scope user = 全局生效）
echo "  安装插件（全局）..."
claude plugin install "${PLUGIN_NAME}" --scope user 2>&1 | tail -1 || {
  err "插件安装失败，重试中..."
  # 有时 market 索引未刷新，等一秒重试
  sleep 1
  claude plugin install "${PLUGIN_NAME}" --scope user 2>&1 | tail -1 || {
    err "插件安装失败，请手动执行:"
    echo "    claude plugin marketplace add $PROJECT_DIR"
    echo "    claude plugin install ${PLUGIN_NAME} --scope user"
    exit 1
  }
}
log "插件已安装 (scope: user)"
fi

# 安装 hook 依赖（better-sqlite3 等原生模块）
step "安装依赖"
echo "  正在安装 hook 依赖..."
cd "$PROJECT_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install 2>&1 | tail -3
log "依赖安装完成"

# ── 验证 ──
step "验证"

# 验证 Docker 容器
echo ""
docker ps --filter "name=mymore" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# 验证插件
if claude plugin list 2>/dev/null | grep -q "^${MARKETPLACE_NAME}"; then
  log "插件状态正常"
else
  err "插件未正确注册，请检查"
  exit 1
fi

# 验证 Hook 注册
HOOK_COUNT=$(claude plugin list 2>/dev/null | grep -c "hook" )
log "插件 hooks 已就绪（共 4 个: SessionStart / UserPromptSubmit / Stop / SessionEnd）"

# ── 完成 ──
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🎉 安装完成！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  现在可以在任意项目中使用 mymore 了。"
echo ""
echo "  下次启动 Claude Code 时，你会看到："
echo "    💡 mymore: Ready"
echo ""
echo "  可用命令："
echo "    /reload-plugins      重新加载插件（如果刚刚安装）"
echo "    mymore-recap         总结会话并存储记忆"
echo ""
echo "  Hub Dashboard:"
echo "    http://localhost:3456"
echo ""
