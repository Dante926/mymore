#!/usr/bin/env bash
#
# mymore — Docker 重建脚本
#
# 用法:
#   ./scripts/rebuild.sh              # 重建全部服务
#   ./scripts/rebuild.sh mymore-mcp   # 只重建 MCP Server
#   ./scripts/rebuild.sh mymore-hub   # 只重建 Hub Dashboard
#
# 功能:
#   1. 停止并删除同名容器（如有）
#   2. 删除同名镜像（如有）
#   3. docker compose build 重建
#   4. docker compose up -d 启动
#   5. 清理 dangling 镜像
#
# 确保本地始终只有一个同名镜像+容器，不会有 <none> 残留。
#

set -euo pipefail
cd "$(dirname "$0")/.."

# ── 配色 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()   { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
step()  { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
err()   { echo -e "${RED}✗${NC} $1"; }

# ── 要重建的服务 ──
ALL_SERVICES=("mymore-mcp" "mymore-hub")
SERVICES=("${@:-${ALL_SERVICES[@]}}")

# ── 前置检查 ──
if ! docker info &>/dev/null; then
  err "Docker 未运行，请先启动 Docker Desktop。"
  exit 1
fi

# ── 逐个重建 ──
for service in "${SERVICES[@]}"; do
  # 验证服务名
  valid=false
  for s in "${ALL_SERVICES[@]}"; do
    [[ "$s" == "$service" ]] && valid=true
  done
  if ! $valid; then
    warn "未知服务: $service，跳过"
    continue
  fi

  step "重建 $service"

  # 1. 停止并删除容器
  EXISTING=$(docker ps -a --filter "name=^/${service}$" --format '{{.Names}}')
  if [[ -n "$EXISTING" ]]; then
    log "停止并删除容器: $service"
    docker compose rm -sf "$service" 2>/dev/null || true
  else
    log "容器不存在，跳过"
  fi

  # 2. 删除旧镜像
  if docker image inspect "$service" &>/dev/null; then
    log "删除旧镜像: $service"
    docker rmi -f "$service" 2>/dev/null || true
  else
    log "镜像不存在，跳过"
  fi

  # 3. 构建
  log "构建镜像: $service"
  docker compose build "$service"

  # 4. 启动
  log "启动容器: $service"
  docker compose up -d "$service"

  log "$service 重建完成"
done

# ── 清理 dangling 镜像 ──
step "清理残留"
PRUNED=$(docker image prune -f 2>&1 || true)
if echo "$PRUNED" | grep -q "Total reclaimed space"; then
  log "dangling 镜像已清理"
else
  log "无 dangling 镜像"
fi

echo -e "\n${GREEN}✅ 全部完成${NC}"
docker ps --filter "name=mymore" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
