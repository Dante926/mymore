# mymore

**分类优先的轻量 MCP 记忆存储系统。**

mymore 是一个本地优先的 MCP（Model Context Protocol）记忆服务器，为 AI Agent 提供持久化记忆能力。以 Markdown 为权威源，SQLite FTS5 为检索引擎，支持三分类、时效管理、Frozen Snapshot 前缀缓存优化。

---

## 架构

```
┌──────────────┐    ┌─────────────────────────────────┐
│  MCP Client  │ ◄─►│         mcp-server               │
│ (Claude etc) │    │  MidwayJS + @midwayjs/mcp        │
└──────────────┘    │  4 Tools + 1 Resource            │
                    └────────────┬─────────────────────┘
                                 │
                    ┌────────────▼─────────────────────┐
                    │        @mymore/core               │
                    │                                    │
                    │  Markdown ← 权威源（可读/可 Git）    │
                    │  + SQLite FTS5 ← 搜索引擎           │
                    │  + Cascade ← md ↔ FTS5 同步         │
                    │  + Consolidator ← LLM 归纳去重      │
                    │  + Frozen Snapshot ← Prefix Cache   │
                    └────────────────────────────────────┘
```

**存储布局**：`~/.mymore/`

```
~/.mymore/
├── memory/
│   ├── users/<id>/episodes/    # 用户记忆（每文件一条记录）
│   └── agents/<id>/episodes/   # Agent 记忆
└── .index/memory.db            # FTS5 检索引擎
```

---

## 三分类原则

| 分类 | 规则 | 示例 |
|---|---|---|
| **persistent** | 不可重新推导，跨 session 有效 | 用户偏好、bug 修复、技术决策 |
| **session** | 短期高价值，跟随 session | 临时变量、中间工具结果 |
| **archived** | 过时或被替代，保留但排除搜索 | valid_until 过期、superseded |

---

## MCP Tools

| Tool | 功能 |
|---|---|
| `add_memory` | 存储记忆，自动三分类，写入 Markdown + FTS5 |
| `search_memory` | 关键词搜索，支持 owner/track/category 过滤 |
| `forget_memory` | 标记过时/被替代（不删除，保留溯源链） |
| `consolidate` | 归纳：去重、时效淘汰、精华提炼 |

**Resource**: `mymore://memory/{id}` — 浏览原始 Markdown 文件

---

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 运行测试（共 38 个）
pnpm test

# 启动 MCP Server
node apps/mcp-server/dist/configuration.js
```

### Claude Desktop 配置

```json
{
  "mcpServers": {
    "mymore": {
      "command": "node",
      "args": ["path/to/mymore/apps/mcp-server/dist/configuration.js"]
    }
  }
}
```

### Docker

```bash
docker build -t mymore-mcp -f apps/mcp-server/Dockerfile .
docker run -i --rm -v ~/.mymore:/root/.mymore mymore-mcp
```

---

## Monorepo 结构

```
mymore/
├── apps/
│   └── mcp-server/       # MidwayJS MCP Server
│       ├── src/tools/     # add-memory, search-memory, forget-memory, consolidate
│       └── src/resources/ # memory-resource
├── packages/
│   └── core/             # @mymore/core — 纯逻辑，零框架依赖
│       ├── src/models.ts       # 数据模型 + SQL Schema
│       ├── src/classifier.ts   # 三分类引擎
│       ├── src/storage.ts      # FTS5 存储封装
│       ├── src/markdown.ts     # Markdown 文件读写
│       ├── src/cascade.ts      # md ↔ FTS5 同步
│       └── src/consolidator.ts # 归纳层
├── docs/                  # Wiki 源文件（兼容 dumi/Docusaurus）
└── build/                 # 设计工作稿
```

---

## 开发

```bash
# 代码格式化
pnpm format

# Lint 检查
pnpm lint

# 版本管理
pnpm changeset     # 记录变更
pnpm version       # 升版本
```

**提交规范**：遵循 Conventional Commits

```
feat(core): add memory classifier
fix(mcp-server): correct fts5 search ranking
docs: update architecture design
```

---

## 渐进式升配路径

| Phase | 新增 | 状态 |
|---|---|---|
| **Phase 1** | Markdown + FTS5 + Frozen Snapshot + Consolidation | ✅ 已完成 |
| Phase 2 | 文件 watcher（chokidar）实时检测 md 编辑 | 📋 待开发 |
| Phase 3 | Episode → AtomicFact 提取层 | 📋 待开发 |
| Phase 4 | 向量库（LanceDB / pgvector） | 📋 待开发 |
| Phase N | mymore-ui（WebUI 监控） | 📋 待开发 |

---

## 技术栈

| 层 | 选型 |
|---|---|
| MCP 框架 | MidwayJS + `@midwayjs/mcp` |
| 存储 | SQLite FTS5（better-sqlite3） |
| Markdown | gray-matter（frontmatter） |
| Monorepo | pnpm workspaces |
| 测试 | vitest |
| 构建 | tsup |
| 规范 | ESLint + Prettier + EditorConfig + Husky + Commitlint + Changesets |

---

## License

Apache-2.0
