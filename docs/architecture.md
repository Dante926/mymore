# mymore — 记忆系统架构

## 总流程

```
                用户对话
                    │
                    ▼
          ┌──────────────────────┐
          │    Stop Hook         │  store-memories.js
          │ 自动保存原文 (session) │
          │ 1小时过期, 自动清理    │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐          ┌──────────────────┐
          │     SQLite FTS5      │◄────────►│  Markdown 组文件  │
          │  memory_fts (全文)    │  双向同步  │  groups/{key}.md │
          │  memory_meta (元数据) │          │  人类可读, 可编辑  │
          └──────────┬───────────┘          └──────────────────┘
                     │
           (下一会话, 所有项目)
                     │
                     ▼
          ┌──────────────────────┐
          │   SessionStart Hook  │  session-context.js
          │ 加载最近记忆 + 上次摘要│
          │ 提示: N raw pending   │
          └──────────┬───────────┘
                     │ <session-context> 注入
                     ▼
          ┌──────────────────────┐
          │  全局 Skill 指令      │  ~/.claude/skills/mymore-memory.md
          │  Claude 自动判断价值  │  alwaysInclude: true
          └──────────┬───────────┘
                     │
            ┌────────┴────────┐
            │                  │
        有持久价值            无价值
            │                  │
            ▼                  ▼
    ┌─────────────────┐   忽略 (1h后
    │  add_memory      │   自动删除)
    │  category:       │
    │  persistent      │
    │       │          │
    │  deprecate_      │
    │  episodes        │
    └─────────────────┘
```

## 组件职责

### Hook 层（Claude Code 事件驱动 — 自动运行）

| Hook | 文件 | 时机 | 做什么 |
|------|------|------|--------|
| **SessionStart** | `hooks/scripts/session-context.js` | 启动会话 | 加载最近5条记忆 + 上次会话摘要 → 注入 `<session-context>` |
| **UserPromptSubmit** | `hooks/scripts/inject-memories.js` | 每次发消息 | 搜索 FTS5 相关记忆 → 注入 `<relevant-memories>` |
| **Stop** | `hooks/scripts/store-memories.js` | 停止回复 | 保存对话原文到 session + 清理过期数据 |
| **SessionEnd** | `hooks/scripts/session-summary.js` | 结束会话 | 保存会话摘要到 sessions.jsonl |
| **Hook 注册** | `hooks/hooks.json` | 插件安装 | 定义 4 个事件 → ${CLAUDE_PLUGIN_ROOT} |

### MCP 层（Docker 容器 — Claude 按需调用）

| 工具 | 文件 | 做什么 |
|------|------|--------|
| **add_memory** | `apps/mcp-server/src/bootstrap.ts` | 存精炼记忆（FTS5 + Markdown） |
| **search_memory** | `apps/mcp-server/src/bootstrap.ts` | 搜索记忆（FTS5 trigram / LIKE 回退） |
| **forget_memory** | `apps/mcp-server/src/bootstrap.ts` | 标记条目作废 |
| **consolidate** | `apps/mcp-server/src/bootstrap.ts` | 归档 / 去重 / 清理 |
| **reflect_memories** | `apps/mcp-server/src/bootstrap.ts` | 单项目 raw 条目精炼 |
| **reflect_all** | `apps/mcp-server/src/bootstrap.ts` | 所有项目批量精炼 |
| **deprecate_episodes** | `apps/mcp-server/src/bootstrap.ts` | 批量标记 raw 作废 |

### 存储层（本地文件 + SQLite）

| 文件 | 类 | 职责 |
|------|-----|------|
| `packages/core/src/storage.ts` | `MemoryStorage` | SQLite FTS5: add / search / appendToGroup / markSuperseded |
| `packages/core/src/markdown.ts` | `MarkdownHandler` | Markdown: appendToGroup / readGroupEntries / scanGroups |
| `packages/core/src/cascade.ts` | `CascadeSync` | 双存储: syncOne / scanAndSync |
| `packages/core/src/consolidator.ts` | `Consolidator` | 维护: archive / dedup / purge |
| `packages/core/src/classifier.ts` | `classifyMemory()` | 分类: keyword → persistent / session |
| `packages/core/src/models.ts` | types + schema | 数据模型 + FTS5 建表 SQL |

### 指令层（控制 Claude 行为）

| 文件 | 作用域 | 作用 |
|------|--------|------|
| `~/.claude/skills/mymore-memory.md` | 全局 (alwaysInclude) | 告诉 Claude 自动精炼 raw 记忆 |
| `CLAUDE.local.md` | 仅 mymore 项目 | 项目级记忆存储规范 |

### 插件层（安装和注册）

| 文件 | 作用 |
|------|------|
| `plugin.json` | Claude Code 插件标识 |
| `.claude-plugin/.mcp.json` | MCP 服务自动注册 |
| `.claude-plugin/marketplace.json` | 市场元数据 |
| `hooks/hooks.json` | 4 个 Hook 事件注册 |

## 数据流

```
用户对话
  │
  ▼
Stop Hook ──→ 保存原文到 SQLite FTS5 (session, 1h过期)
             同时写入 Markdown 组文件 (groups/{group_key}.md)
  │
  ▼ (下次会话)
SessionStart Hook ──→ 加载最近记忆, 注入到 Claude
  │
  ▼
Claude 通过全局 skill 自动判断 raw 价值
  ├── 有持久价值
  │     ├─ add_memory(content=精炼摘要, category=persistent, group_key=项目)
  │     └─ deprecate_episodes(ids=[raw], superseded_by=新ID)
  │
  └── 无价值 → 1 小时后自动删除
```

## 存储布局

```
~/.mymore/
├── .index/
│   └── memory.db              ← SQLite FTS5 (memory_fts + memory_meta)
├── memory/
│   └── groups/
│       └── {group_key}.md     ← Markdown 组文件 (by 项目名)
├── sessions.jsonl              ← 会话摘要日志
└── hooks/                      ← 全局 Hook 运行时 (由 install.sh 部署)
    ├── package.json
    ├── node_modules/
    └── scripts/
        ├── store-memories.js
        ├── session-context.js
        ├── inject-memories.js
        ├── session-summary.js
        └── utils/
            ├── config.js
            └── debug.js
```

## Docker 部署

```yaml
services:
  mymore-mcp:                   # MCP 服务 (stdio)
    build: apps/mcp-server/Dockerfile
    container_name: mymore-mcp
    stdin_open: true
    tty: false
    volumes:
      - ~/.mymore:/root/.mymore

  mymore-hub:                   # Web 仪表盘 (HTTP :3456)
    build: apps/hub/Dockerfile
    container_name: mymore-hub
    ports:
      - "3456:3456"
    volumes:
      - ~/.mymore:/root/.mymore
```
