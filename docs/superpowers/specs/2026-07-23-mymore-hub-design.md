# Phase 3 设计：mymore Memory Hub 仪表盘

> 2026-07-23

## 背景

mymore 已完成 Phase 1（核心链路）和 Phase 2（Hook 装配），4 个 MCP Tool 全部可用，Agent 已能自动存储和读取记忆。但目前缺少一个直观的界面来查看所有记忆的全貌——用户在浏览器中浏览、搜索、分析记忆数据。

Phase 3 的目标是构建一个 Memory Hub 仪表盘，让用户通过浏览器可视化浏览 mymore 中存储的记忆。

## 设计原则

1. **零额外依赖** — 纯 Node.js 标准库实现，不引入 Express、React 等框架
2. **本地优先** — 直连 SQLite，不依赖 MCP 协议，不经过云端
3. **开箱即用** — 集成到 Docker Compose，`docker compose up -d` 即可启动
4. **非侵入** — 不修改现有 MCP Server 代码，完全独立运行

## 架构

```
浏览器 ──http──► hub.js (:3456) ──sqlite──► memory.db
                      │
                      ├── GET /          → dashboard.html
                      ├── GET /api/stats → { totalMemories, projects, activeDays, avgDaily }
                      ├── GET /api/heatmap → [{ date, count }] 近 6 月
                      ├── GET /api/growth  → [{ date, count }] 近 7 日
                      ├── GET /api/memories → [{ id, content, category, created_at }]
                      ├── GET /api/memories?q=xxx → 全文搜索
                      └── GET /health     → { status: 'ok' }
```

## 文件结构

```
mymore/
├── apps/mcp-server/src/hub/
│   ├── server.js        # HTTP 服务，直连 SQLite，提供 API + 静态文件
│   └── dashboard.html   # 前端仪表盘（纯原生 JS/CSS，零框架）
├── docker-compose.yml   # 新增 hub 服务
└── docs/superpowers/specs/2026-07-23-mymore-hub-design.md
```

### server.js

Node.js 内置 `http` 模块实现，不需要 Express。

**职责**：
1. 提供静态文件（dashboard.html）
2. 提供 REST API 直接查询 mymore 的 SQLite 数据库
3. 启动时检查数据库路径

**API 设计**：

| 端点 | 说明 | 返回 |
|---|---|---|
| `GET /` | 首页 | dashboard.html |
| `GET /health` | 健康检查 | `{ status: "ok" }` |
| `GET /api/stats` | 统计概览 | `{ totalMemories, projects, activeDays, avgPerDay }` |
| `GET /api/heatmap` | 6 个月日活动 | `[{ date, count }]` |
| `GET /api/growth` | 近 7 日趋势 | `[{ date, count }]` |
| `GET /api/memories` | 记忆列表（分页） | `{ memories: [...], total, page, pageSize }` |
| `GET /api/memories?q=` | 全文搜索 | `{ memories: [...], total, query }` |

**参数**：
- `?page=1&pageSize=50` — 分页
- `?group=group_id` — 按项目过滤
- `?category=persistent` — 按分类过滤

### dashboard.html

纯原生 HTML/CSS/JS，零框架，暗色主题。

**功能模块**：

| 模块 | 实现方式 |
|---|---|
| 统计卡片（4 列） | CSS Grid，从 `/api/stats` 填充数据 |
| 热力图（6 月） | 双循环生成 grid 单元格，分位数着色 |
| 柱状图（7 日） | 纯 CSS 柱体，高度 = (count/max) * 100% |
| 时间线 | 按日期分组的记忆卡片，垂直布局 |
| 搜索 | 输入框，请求 `/api/memories?q=` 实时搜索 |
| 分类过滤 | 下拉选择框（All / persistent / session / archived） |

### docker-compose.yml

新增 `mymore-hub` 服务：

```yaml
mymore-hub:
  build:
    context: .
    dockerfile: apps/mcp-server/Dockerfile
  image: mymore-mcp
  container_name: mymore-hub
  restart: unless-stopped
  ports:
    - "3456:3456"
  volumes:
    - ~/.mymore:/root/.mymore
  environment:
    - MYMORE_ROOT=/root/.mymore
    - MYMORE_HUB_PORT=3456
  command: ["node", "apps/mcp-server/dist/hub/server.js"]
```

## 数据流

```
用户打开浏览器 → localhost:3456

hub.js 启动时：
  1. 打开 ~/.mymore/.index/memory.db（SQLite）
  2. 启动 HTTP 服务器监听 :3456

用户查看仪表盘：
  1. dashboard.html 加载 → fetch /api/stats
  2. 渲染统计卡片
  3. fetch /api/heatmap → 渲染热力图
  4. fetch /api/growth → 渲染柱状图
  5. fetch /api/memories → 渲染时间线
  6. 搜索 → fetch /api/memories?q=xxx → 刷新时间线
```

## Docker 镜像是共享的

hub 和 mcp 使用同一个 Dockerfile 构建，只是启动命令不同（`command` 覆盖）：

- `mymore-mcp` 容器：`node apps/mcp-server/dist/bootstrap.js`（MCP stdio）
- `mymore-hub` 容器：`node apps/mcp-server/dist/hub/server.js`（HTTP :3456）

两者共享 `~/.mymore` 卷，hub 直连 memory.db。

## 验证标准

1. ✅ `docker compose up -d` 后 hub 启动无报错
2. ✅ 浏览器打开 `http://localhost:3456` 显示仪表盘
3. ✅ 统计卡片数据与 SQLite 查询结果一致
4. ✅ 热力图显示近 6 个月活动分布
5. ✅ 搜索关键词能检索到对应记忆
6. ✅ 按分类过滤正确
7. ✅ mymore-mcp 仍能正常工作

## 待确认

- hub 的启动命令需要构建到 tsup 配置中（新增 entry point）
- dashboard.html 作为静态文件，由 server.js 读取并返回
- 端口冲突处理：3456 被占用时日志提示
