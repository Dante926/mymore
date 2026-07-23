# mymore

**分类优先的轻量 MCP 记忆存储系统。** 为 AI Agent 提供持久化记忆能力。

---

## 架构

```
MCP Client (Claude 等) ◄──stdin/stdout──► mymore MCP Server
                                               │
                                    ┌──────────▼──────────┐
                                    │     @mymore/core     │
                                    │                      │
                                    │  Markdown ← 权威源    │
                                    │  + FTS5    ← 搜索引擎 │
                                    │  + Cascade ← 双向同步 │
                                    │  + Consolidate ← 归纳 │
                                    └──────────────────────┘
```

数据存储于 `~/.mymore/`，Markdown 文件保证人体可读和 Git 版本管理，SQLite FTS5 保证毫秒级全文检索。

---

## 特点

| 概念                | 说明                                                                                |
| ------------------- | ----------------------------------------------------------------------------------- |
| **三分类**          | 记忆自动分为 persistent（持久）、session（会话）、archived（归档），宁存勿丢        |
| **分轨存储**        | user 和 agent 的记忆分轨隔离，互不干扰                                              |
| **时效系统**        | 每条记忆有过期时间和替代标记，确保 Agent 不引用过时信息                             |
| **Frozen Snapshot** | 高频记忆自动"冻结"为 System Prompt 前缀，利用 Prompt Caching 降低 Token 消耗 50-75% |
| **渐进式升配**      | Phase 1 的 FTS5 够用就不上向量库，预留了所有升配字段                                |

### MCP Tools

| Tool            | 功能                                     |
| --------------- | ---------------------------------------- |
| `add_memory`    | 存储记忆，自动分类，写入 Markdown + FTS5 |
| `search_memory` | 全文检索，支持 owner/track/category 过滤 |
| `forget_memory` | 标记过时/被替代（不删数据，保留溯源链）  |
| `consolidate`   | 归纳：去重、过期归档、精华提炼           |

---

## 部署

### Docker Compose（推荐）

```bash
# 首次运行
docker compose up -d

# 停止
docker compose stop
```

首次启动会自动创建 `~/.mymore/` 并初始化数据库。

### 直接 Docker

```bash
docker build -t mymore-mcp -f apps/mcp-server/Dockerfile .
docker run -i --rm -v ~/.mymore:/root/.mymore mymore-mcp
```

### Claude Desktop 配置

```json
{
  "mcpServers": {
    "mymore": {
      "command": "docker",
      "args": ["compose", "run", "--rm", "mymore-mcp"]
    }
  }
}
```

_如果 compose 文件不在 Claude Desktop 的工作目录下，需通过 `-f` 指定完整路径。_

---

## 开发

```bash
pnpm install
pnpm build
pnpm test          # 38 个测试
```

---

## 升配路径

| Phase       | 新增                                              | 状态      |
| ----------- | ------------------------------------------------- | --------- |
| **Phase 1** | Markdown + FTS5 + Frozen Snapshot + Consolidation | ✅ 完成   |
| **Phase 2** | 为 mymore 装配 Hook，Agent 自动存储和读取记忆    | 📋 待开发 |
| Phase 3     | 文件 watcher 实时检测 md 编辑                     | 📋 待开发 |
| Phase 4     | Episode → AtomicFact 提取层                       | 📋 待开发 |
| Phase 5     | 向量库（LanceDB / pgvector）                      | 📋 待开发 |

---

## License

MIT
