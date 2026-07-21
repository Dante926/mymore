# mymore — 轻量 MCP 记忆 Server 架构设计

> 基于 "7 步设计 Agent 记忆系统" 的实践落地。
> 综合借鉴 EverOS 的分轨/溯源/Cascade 思路与 mymore 的三分类/FTS5/渐进式/成本控制哲学。

---

## 一、设计原则

| 原则 | 说明 |
|---|---|
| **分类优先** | 存不存比怎么存更重要。能重新推导的 → 丢弃，session 有效 → 缓存，不可推导 → 持久化 |
| **渐进升配** | Phase 1 FTS5 够用就不上向量库。每一步有验证标准，达标再升配 |
| **人体可读** | Markdown 是权威源。人可以直接编辑、diff、Git 版本管理 |
| **成本意识** | Frozen Snapshot 对齐 Prefix Cache，从第一天控制 Token 消耗 |
| **可验证** | 3 个指标 + 5 个用例，每层可通过测试衡量效果 |

---

## 二、Monorepo 结构

```
mymore/
├── apps/
│   └── mcp-server/                       # MidwayJS MCP Server
│       ├── src/
│       │   ├── configuration.ts           # MidwayJS 入口
│       │   ├── config/                    # midway 配置
│       │   ├── tools/                     # MCP Tool 定义
│       │   │   ├── add-memory.ts
│       │   │   ├── search-memory.ts
│       │   │   ├── forget-memory.ts
│       │   │   └── consolidate.ts
│       │   └── resources/                 # MCP Resource 定义
│       ├── Dockerfile
│       ├── .dockerignore
│       └── test/
│
├── packages/
│   └── core/                              # @mymore/core：纯逻辑，零框架依赖
│       └── src/
│           ├── models.ts                  #   数据模型（MemoryEntry）
│           ├── classifier.ts              #   三分类引擎
│           ├── storage.ts                 #   FTS5 存储封装
│           ├── markdown.ts                #   Markdown 文件读写
│           ├── cascade.ts                 #   md ↔ FTS5 同步
│           └── consolidator.ts            #   归纳层
│       └── test/
│
├── docs/                                  # Wiki 源文件（兼容 dumi/Docusaurus）
│   └── architecture.md
│
├── build/                                 # 原设计工作稿（保留）
│
├── .changeset/                            # 版本管理与 changelog
├── .husky/                                # Git hooks（commit-msg, pre-commit）
│
├── .editorconfig
├── .eslintrc.json
├── .eslintignore
├── .prettierrc.js
├── .prettierignore
├── .gitignore
├── .npmrc
│
├── package.json                           # workspace root + commitlint/lint-staged
├── pnpm-workspace.yaml
└── tsconfig.json                          # 全局 tsconfig (project references)
```

---

## 三、项目工程规范

### 代码风格与格式化

| 工具 | 用途 | 配置方式 |
|---|---|---|
| **EditorConfig** | 跨编辑器缩进/编码统一 | `.editorconfig` — 2 空格缩进，LF 换行，UTF-8 |
| **Prettier** | 自动格式化 | `.prettierrc.js` — 单引号，尾逗号，150 字符宽 |
| **ESLint** | 代码质量检查 | `.eslintrc.json` + `.eslintignore` |

### Git 提交规范

```
提交信息格式: <type>(<scope>): <description>

示例:
  feat(core): add memory classifier
  fix(mcp-server): correct fts5 search ranking
  docs: add architecture design doc
```

| 工具 | 用途 |
|---|---|
| **Husky** | Git hooks 管理。`pre-commit` 运行 lint-staged，`commit-msg` 校验提交信息 |
| **Commitlint** | 校验提交信息符合 Conventional Commits 规范（`@commitlint/config-conventional`） |
| **lint-staged** | 只对暂存文件运行 Prettier 格式化，不扫描全库 |

### 版本管理

| 工具 | 用途 |
|---|---|
| **Changesets** | Monorepo 版本管理与 Changelog 自动生成。每次改动通过 `pnpm changeset` 记录，发布时批量升版本 |

Changeset 配置（`.changeset/config.json`）:
- `baseBranch: "dev"` — 以 dev 分支为基准
- `access: "restricted"` — 私有包
- `commit: false` — 不自动生成 commit

### 包管理

| 工具 | 用途 |
|---|---|
| **pnpm workspaces** | Monorepo 包管理。配置 `pnpm-workspace.yaml` |
| **.npmrc** | 镜像源、engine-strict 等全局设置 |

`pnpm-workspace.yaml` 注册的 workspace:
```yaml
packages:
  - "docs"
  - "apps/*"
  - "packages/*"
```

### docs 目录规范

`docs/` 目录为 Wiki 源文件，兼容 **dumi** 和 **Docusaurus** 等文档框架：

- 文档使用 Markdown 撰写
- 根级 `docs/` 作为框架默认的文档源目录
- 后续接入 dumi 时只需在根目录添加 `.dumirc.ts`：

```typescript
import { defineConfig } from 'dumi';

export default defineConfig({
  themeConfig: {
    name: 'mymore',
  },
});
```

### 根级 package.json scripts

```json
{
  "scripts": {
    "prepare": "husky install",
    "changeset": "changeset",
    "version": "changeset version",
    "publish": "changeset publish",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write \"**/*.{ts,js,json,md}\""
  }
}
```

---

## 四、数据模型

### MemoryEntry

```typescript
interface MemoryEntry {
  // 身份标识
  id: string                      // uuid v4
  track: 'user' | 'agent'        // 分轨
  owner_id: string
  category: 'persistent' | 'session' | 'archived'

  // 内容
  content: string
  source?: string

  // 时效系统
  created_at: string              // ISO 8601
  valid_until?: string            // NULL = 永不过期
  superseded_by?: string          // 被哪条新记忆替代

  // 溯源
  session_id?: string
  parent_id?: string

  // 冻结标记（Prefix Cache 优化）
  frozen: boolean

  // 访问统计
  access_count: number
  last_accessed_at?: string
}
```

### FTS5 Schema

```sql
-- 全文索引表
CREATE VIRTUAL TABLE memory_fts USING fts5(
    content,
    tokenize='trigram'
);

-- 元数据表
CREATE TABLE memory_meta (
    id              TEXT PRIMARY KEY,
    fts_rowid       INTEGER UNIQUE,
    track           TEXT NOT NULL,
    owner_id        TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'persistent',
    md_path         TEXT NOT NULL,
    frozen          INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL,
    valid_until     TEXT,
    superseded_by   TEXT,
    session_id      TEXT,
    parent_id       TEXT,
    content_sha256  TEXT NOT NULL,
    access_count    INTEGER DEFAULT 0,
    last_accessed_at TEXT,
    FOREIGN KEY (fts_rowid) REFERENCES memory_fts(rowid),
    FOREIGN KEY (superseded_by) REFERENCES memory_meta(id)
);

CREATE INDEX idx_memory_track_owner ON memory_meta(track, owner_id);
CREATE INDEX idx_memory_category ON memory_meta(category);
CREATE INDEX idx_memory_frozen ON memory_meta(frozen);
CREATE INDEX idx_memory_valid ON memory_meta(valid_until);
```

### Markdown 文件布局

```
~/.mymore/
├── memory/
│   ├── users/
│   │   └── <owner_id>/
│   │       ├── profile.md                 # 用户画像聚合
│   │       └── episodes/
│   │           └── episode-YYYY-MM-DD.md  # 每日日志
│   └── agents/
│       └── <agent_id>/
│           └── episodes/
│               └── episode-YYYY-MM-DD.md
├── .index/
│   └── memory.db                          # SQLite FTS5
└── config.toml                            # 运行时配置
```

单条记忆在 Markdown 中以 frontmatter + body 存储：

```markdown
---
id: mem_a1b2c3d4
track: user
owner_id: dante926
category: persistent
frozen: true
created_at: 2026-07-21T14:00:00Z
session_id: sess_xyz
access_count: 5
---

用户偏好暗色模式，所有界面用暗色主题。
```

---

## 五、存储层（@mymore/core）

### 双存储设计

| 层 | 角色 | 读写方式 |
|---|---|---|
| **Markdown 文件** | 权威源 | 写入时先写 md，启动时全量扫描重建索引 |
| **SQLite FTS5** | 搜索引擎 | trigram 全文检索 + 结构化字段过滤 |

Markdown 保证人体可读和 Git 版本管理。FTS5 保证快速检索。

### 三分类引擎

```
输入: content, keywords?
输出: 'persistent' | 'session'

规则:
  session 关键词匹配 → session
  (可选) LLM 分类     → 自定义
  默认                → persistent（宁存勿丢）
```

**分类自检钩子**：每季度或项目框架变更时，review 分类规则是否需要调整。

---

## 六、Cascade 同步

### 写入路径

```
MCP Tool → classifier → write md（权威源）→ sync FTS5 → 返回
```

`cascade.sync()` 做的事情：

1. 计算 `content_sha256`（SHA-256 of content + category + frozen）
2. 查询 FTS5 中同 id 记录
3. SHA 相同 → 跳过（no-op）
4. SHA 不同 → upsert FTS5 + 更新 `memory_meta`
5. 返回

### 编辑检测路径（启动时）

```
启动时 scan_memory():
  遍历 ~/.mymore/memory/**/*.md
    对比 content_sha256
    已变更 → cascade.sync_one(path)
    新增   → cascade.sync_one(path)
    删除   → 标记 superseded 但不物理删除
```

### 与 EverOS Cascade 对比

| 维度 | EverOS | mymore |
|---|---|---|
| 异步队列 | APScheduler + 独立 DB | 同步写入，无队列 |
| 变更检测表 | `md_change_state` + LSN | content_sha256 对比 |
| 组件 | 4 组件（watcher + scanner + worker + reconciler） | 1 个 `sync()` 函数 |
| 一致性 | 最终一致 | 强一致 |

---

## 七、MCP Tools

### 7.1 `add_memory`

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `content` | string | 是 | — | 记忆正文 |
| `owner_id` | string | 是 | — | 所属用户/Agent |
| `track` | string | 否 | 'user' | 'user' \| 'agent' |
| `category` | string | 否 | auto | 三分类值或自动 |
| `valid_until` | string | 否 | 永不过期 | ISO 日期 |
| `session_id` | string | 否 | — | 来源会话 ID |

返回 `{ id, md_path, category }`。

### 7.2 `search_memory`

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `query` | string | 是 | — | 搜索关键词 |
| `owner_id` | string | 否 | — | 限定用户 |
| `track` | string | 否 | — | 限定分轨 |
| `category` | string | 否 | — | 限定分类 |
| `include_expired` | boolean | 否 | false | 包含过期记忆 |
| `limit` | number | 否 | 5 | 返回条数 |

返回按 BM25 排序、frozen 优先的记忆列表。

### 7.3 `forget_memory`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 记忆 ID |
| `superseded_by` | string | 否 | 替代者 ID，不传则仅标记 archived |

标记操作，不删除数据，保留溯源链。

### 7.4 `consolidate`

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `owner_id` | string | 否 | — | 限定范围，不传则全库 |
| `days` | number | 否 | 7 | 读取最近 N 天日志 |
| `dry_run` | boolean | 否 | false | 预览模式，不改数据 |

调用 LLM 执行：
1. 去重：相似记录合并，标记旧 superseded
2. 冲突检测：互斥信息保留最新
3. 精华提炼：高频/重要记忆标记 frozen
4. 时效淘汰：valid_until 过期的降级为 archived

### 7.5 Resource

`mymore://memory/{track}/{owner_id}/{kind}/{date}`

浏览原始 Markdown 文件内容。示例：

| URI | 返回 |
|---|---|
| `mymore://memory/user/dante926/episodes/2026-07-21` | 当日 Markdown 原文 |
| `mymore://memory/user/dante926/profile` | 用户画像文件 |

---

## 八、Frozen Snapshot（Prefix Cache 优化）

### 机制

```typescript
function get_frozen_snapshot(opts: {
  owner_id: string
  max_tokens?: number    // 默认 800
}): string
```

- 查询 `frozen = true AND superseded_by IS NULL` 的记忆
- 按 `access_count DESC` 排序
- 截取到 `max_tokens` 为止
- 返回纯文本，用于注入 System Prompt 头部冻结区

### 触发时机

| 时机 | 做什么 |
|---|---|
| **MCP Server 启动时** | 加载 frozen 快照，缓存到内存 |
| **consolidate 运行后** | 如果有新 frozen 条目，刷新缓存 |
| **文件 watcher 触发的 reindex** | 可选：增量刷新 |

### 效果

```
System Prompt:
  ┌─ Stable Prefix (800 token) ← 包含 frozen snapshot ← 命中 Cache
  │  "角色定义... 核心规则... 用户偏好..."
  ├─ Dynamic Suffix (可变) ← 当前任务
  │  "当前任务：修复 bug #42"

→ Cache Read Tokens / Total Input Tokens > 80%
→ Token 成本降低 50-75%
```

---

## 九、归纳层（Consolidation）

### 写入时附带

```
add_memory 写入后自动执行:
  1. 模糊去重:
     同 owner_id + 同 track 中 content 高度相似 → 标记旧的 superseded
  2. 自动冻结:
     超过 3 天未变动的 persistent 记忆 → frozen = true
```

### 手动触发（MCP Tool）

```
consolidate tool → LLM 调用:
  prompt: "以下 {days} 天内的记忆，请识别重复、冲突、
           需要标记过时的、值得提炼为精华的条目"

  LLM 返回结构化 JSON → 执行对应操作
```

### 与 MCP 交互

```
用户: "整理一下我的记忆"
  → MCP client call tool consolidate
  → server 执行去重/冻结/淘汰
  → 返回变更摘要

Agent: "上次那个 bug 怎么修的？"
  → MCP client call tool search
  → server FTS5 检索 + 时效过滤
  → 返回相关记忆
```

---

## 十、Phases 升配路径

| Phase | 新增 | 触发条件 |
|---|---|---|
| **Phase 1** | Markdown + FTS5 + Frozen Snapshot + Consolidation | ✅ 初始可用 |
| **Phase 2** | 文件 watcher（chokidar）实时检测 md 编辑 | md 编辑场景变多 |
| **Phase 3** | Episode → AtomicFact 提取层 | 需要精细语义匹配 |
| **Phase 4** | 向量库（LanceDB / pgvector） | 模糊查询 > 30% |
| **Phase 5** | 聚类反射（deprecated_by 自动合并） | 记忆量膨胀到需自动整理 |
| **Phase N** | mymore-ui（WebUI 监控） | 需要可视化浏览 |

每个 Phase 的数据结构已在 Phase 1 中预留。`track / session_id / parent_id / superseded_by / frozen` 字段从一开始就存在，升配不需要改表。

---

## 十一、验证体系

### 3 个指标

| 指标 | 目标 | 测量方式 |
|---|---|---|
| 指令遵从率 | 注入记忆后不下降 | System Prompt 嵌入隐蔽规则，前后对比 |
| 检索 Top-1 命中率 | > 80% | 20 个已知答案的问题，FTS5 召回 |
| Cache 命中率 | > 80% | API 报表 cache_read / total_input |

### 5 个测试用例

| 测试 | 验证 |
|---|---|
| "上次那个 [bug] 怎么修的？" | 精确召回 |
| "项目现在用什么框架？" | 时效性（superseded_by 生效） |
| "删除 /tmp 临时文件" | 信噪比（简单操作不被记忆干扰） |
| "3 个月前决策还适用吗？" | 时间旅行（valid_until 生效） |
| 100 次请求后 Cache 命中率 | 经济账 |

---

## 十二、技术栈

| 层 | 技术选型 | 理由 |
|---|---|---|
| MCP 框架 | MidwayJS + `@midwayjs/mcp` | 用户指定 |
| 存储 | better-sqlite3（同步，零配置） | stdio 模式无需异步，FTS5 内置 |
| Markdown 解析 | gray-matter（frontmatter） | 成熟、轻量 |
| 测试 | vitest | workspace 原生支持 |
| 构建 | tsup | 快速 TypeScript 编译 |
| 包管理 | pnpm workspaces | Monorepo 支持 |
| Git hooks | husky + lint-staged | 提交前自动格式化/校验 |
| 版本管理 | changesets | Monorepo changelog 自动生成 |
| 代码规范 | ESLint + Prettier + EditorConfig | 统一风格 |

---

## 十三、Docker 部署

### 构建镜像

`apps/mcp-server/Dockerfile`：

```dockerfile
FROM node:22-alpine

RUN apk add --no-cache sqlite \
    && npm install -g pnpm

WORKDIR /app

# 依赖缓存层（利用 Docker layer caching）
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/core/package.json ./packages/core/
RUN pnpm install --frozen-lockfile

# 源码 + 构建
COPY . .
RUN pnpm build

EXPOSE 3000

CMD ["node", "apps/mcp-server/dist/bootstrap.js"]
```

### .dockerignore

`apps/mcp-server/.dockerignore`：

```
node_modules
dist
.git
*.md
test
```

### 启动方式

```bash
# 构建
docker build -t mymore-mcp -f apps/mcp-server/Dockerfile .

# 运行（stdio 模式——通过管道与宿主机通信）
docker run -i --rm \
  -v ~/.mymore:/root/.mymore \
  mymore-mcp
```

### 数据持久化

```bash
# 记忆数据持久化到宿主机
docker run -i --rm \
  -v ~/.mymore:/root/.mymore \
  mymore-mcp
```
