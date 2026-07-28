#!/usr/bin/env bash
#
# mymore — Docker 重建脚本
#
# 用法:
#   ./scripts/rebuild.sh              # 重建全部服务
#   ./scripts/rebuild.sh mymore-mcp   # 只重建 MCP Server
#   ./scripts/rebuild.sh mymore-hub   # 只重建 Hub Dashboard
#
# 流程（逐个服务）:
#   1. 停止并删除所有同名的容器（精确匹配 + Docker Compose 自动命名两种）
#   2. 删除所有同名的旧镜像（含 <none> dangling 镜像）
#   3. docker compose up -d --build --force-recreate 原子重建+启动
#   4. docker image prune 清理残留
#
# 确保本地只有一个同名镜像 + 一个同名容器，不会有 <none> 残留。
#

set -euo pipefail
cd "$(dirname "$0")/.."

# ── 配色 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
step()  { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
err()   { echo -e "${RED}✗${NC} $1"; }

# ── 要重建的服务 ──
ALL_SERVICES=("mymore-mcp" "mymore-hub")
if [[ $# -gt 0 ]]; then
  SERVICES=("$@")
else
  SERVICES=("${ALL_SERVICES[@]}")
fi

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
    warn "未知服务: $service，跳过（可用: ${ALL_SERVICES[*]}）"
    continue
  fi

  step "重建 $service"

  # ── 1. 停止并删除所有同名容器 ──
  # Docker Compose 可能以两种方式命名容器：
  #   a) container_name 指定 → 精确名称（如 mymore-mcp）
  #   b) 自动命名 → <project>_<service>_<index>（如 mymore_mymore-mcp_1）
  COMPOSE_CONTAINER=$(docker compose ps -q "$service" 2>/dev/null || true)
  EXACT_CONTAINER=$(docker ps -a --filter "name=^/${service}$" --format '{{.Names}}' 2>/dev/null || true)
  COMPOSE_NAMED=$(docker ps -a --filter "name=${service}$" --format '{{.Names}}' | grep -v "^${service}$" | head -1 || true)

  # 按容器名逐个删除
  for cid in "$EXACT_CONTAINER" "$COMPOSE_NAMED"; do
    if [[ -n "$cid" ]]; then
      log "停止并删除容器: $cid"
      docker stop "$cid" 2>/dev/null || true
      docker rm -f "$cid" 2>/dev/null || true
    fi
  done

  # 如果有 compose 容器 ID 但还没被删除（可能是不同命名方式）
  if [[ -n "$COMPOSE_CONTAINER" ]]; then
    log "删除 Compose 管理的容器 (ID: ${COMPOSE_CONTAINER:0:12})"
    docker compose rm -sf "$service" 2>/dev/null || true
  fi

  # ── 2. 删除同名旧镜像 ──
  # 删除有 tag 的旧镜像（docker compose build 会重新创建这个 tag）
  OLD_IMAGE_ID=$(docker images --filter "reference=${service}" --format '{{.ID}}' | head -1 || true)
  if [[ -n "$OLD_IMAGE_ID" ]]; then
    log "删除旧镜像: ${service} (ID: ${OLD_IMAGE_ID:0:12})"
    docker rmi -f "$OLD_IMAGE_ID" 2>/dev/null || true
  fi

  # 删除关联的 <none> 镜像（之前 build 留下的 dangling）
  NONE_IMAGES=$(docker images --filter "reference=${service}" --filter "dangling=true" --format '{{.ID}}' 2>/dev/null || true)
  for img in $NONE_IMAGES; do
    docker rmi -f "$img" 2>/dev/null || true
  done

  # 强制 gc（释放已经被删除但还挂着的镜像层）
  docker image prune -f 2>/dev/null || true

  # ── 3. 重建并启动 ──
  # --build: 重新构建镜像
  # --force-recreate: 即使配置没变也重新创建容器
  log "构建并启动: $service"
  docker compose up -d --build --force-recreate "$service"

  # ── 4. 验证 ──
  sleep 1
  RUNNING=$(docker ps --filter "name=$service" --filter "status=running" --format '{{.Names}}' | head -1)
  TOTAL=$(docker ps -a --filter "name=$service" --format '{{.Names}}' | wc -l | tr -d ' ')
  if [[ -n "$RUNNING" ]]; then
    log "${service} 运行中 (容器: ${RUNNING})"
    if [[ "$TOTAL" -eq 1 ]]; then
      log "容器数量正确: 1"
    else
      warn "容器数量: ${TOTAL}（预期 1），请检查"
    fi
  else
    err "${service} 未运行，请检查日志: docker compose logs $service"
  fi
done

# ── 清理 dangling 镜像 ──
step "清理残留"
PRUNED=$(docker image prune -f 2>&1 || true)
if echo "$PRUNED" | grep -q "Total reclaimed space"; then
  log "dangling 镜像已清理"
else
  log "无 dangling 镜像"
fi

# ── 最终状态 ──
echo ""
echo -e "${GREEN}✅ 全部完成${NC}"
echo ""
docker ps --filter "name=mymore" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
echo ""
docker images --filter "reference=mymore*" --format "table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}" | head -5
