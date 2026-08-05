# mymore L0→L3 记忆管线改造设计

> 状态：已与用户逐节确认（第 1~5 节全部通过）
> 参考：`~/Desktop/dante926/tools/TDB/memory-pipeline.md`（TencentDB-Agent-Memory 记忆管道拆解）
> 目标：将 mymore 从「非结构化 MCP+plugin 双轨」进化为「memory-core 形态的完整 L0→L3 记忆系统」

---

## 0. 背景与问题

### 0.1 现状病灶（改造前已诊断）

| # | 病灶 | 证据 |
|---|---|---|
| 1 | **双轨部署竞争**：hooks 直连 SQLite + MCP 容器直连同一 DB | `hooks/scripts/*.js` 直接 `import '@mymore/core'`；`.claude-plugin/.mcp.json` 走 `docker exec` |
| 2 | **写入靠 Claude 自觉**：无自动捕获，`add_memory` 由模型决定 | `Stop` hook 注释「存储仅由 Claude 按需触发」 |
| 3 | **静默失败**：hook 全部吞异常 | 所有 hook 开头 `process.on('uncaughtException', () => process.exit(0))` |
| 4 | **记忆非结构化**：hub 卡片乱糟糟 | L1 自由总结直接落库，无 type/priority/scene |
| 5 | **假去重**：consolidator 按时间戳丢旧，不看内容 | `Consolidator.run()` 排序后直接 markSuperseded |

### 0.2 参考认知（来自 memory-pipeline.md）

- 仓库有**两套都叫 L0-L3 的管道**：核心记忆管道（生产走）与 offload 上下文卸载管道。**mymore 借鉴核心记忆管道**，offload 是另一回事。
- memory-core 也是「hook + tool」双形态（`api.on(agent_end)` + `api.registerTool`），只是 OpenClaw 统一在同一进程。Claude Code 无此统一 API，故「hook + MCP」是 Claude Code 插件的**必然形状**，不是设计选择。
- **L1 自动召回注入已下线**（破坏 KV/prompt cache），改静态只读工具按需检索——把"何时查"交给 LLM。

### 0.3 设计目标

- 完全自动的 L0→L3，不依赖 Claude 自觉、不因上下文遗忘而中断。
- 记忆**结构化落库**（type/priority/scene/version），hub 一眼可见"聊了什么、重点是什么"。
- **单进程、单一配置真源**，用户配置压力最小（hub UI 写一次）。

---

## 1. 整体架构（已确认，第一节）

### 1.1 形态决策

| 维度 | 决策 |
|---|---|
| 部署 | **本地单进程**：mcp-server 常驻承载全部管线，hub 可选 |
| LLM 执行者 | **方案 A**：mcp-server 内嵌 runner，完全自动 |
| 模型源 | **托管 OpenAI 兼容端点**（base URL + key），hub UI 写入 `~/.mymore/config.json` |
| 召回 | 只读工具按需检索，**不自动注入**（借鉴参考 6.4） |
| 写入主通道 | **管线自动完成**（L0→L1→L2→L3），`add_memory` 降级为**显式手动补充**工具（Claude 主动判断"这条值得立即记住"时用），不再是写入唯一依赖 |

### 1.2 架构图

```
┌─ Claude Code ─────────────────────────────────┐
│  Hooks: UserPromptSubmit / Stop / SessionEnd   │
│  MCP 工具: search_memory(只读) / add_memory(显式)│
└───────────────┬────────────────────────────────┘
                │ Stop 事件: 增量 transcript
                ▼
┌─ mcp-server (唯一常驻进程) ────────────────────┐
│  PipelineManager (调度 L1→L2→L3, 阈值/空闲/兜底)│
│  LLMRunner        (调托管 OpenAI 兼容端点)      │
│  L0 捕获入口        (JSONL append-only 真源)    │
│  L1 提取/去重       (严格 JSON 契约 + LLM 审核)  │
│  L2 Scene / L3 Persona (文件工具写 scene_blocks/ │
│  MCP 工具(只读召回) │  persona.md)              │
│  存储: JSONL + SQLite(FTS5+sqlite-vec) 索引     │
└───────────────┬────────────────────────────────┘
                │ 读写 ~/.mymore/config.json
                ▼
┌─ hub (localhost:3456) ─────────────────────────┐
│  配置 UI: LLM base URL + key + 模型            │
│  Dashboard: 三层记忆卡片 / 管线状态            │
└────────────────────────────────────────────────┘
```

### 1.3 为什么 mcp-server 是大脑（备选权衡）

- **备选 A（worker 进程）**：过度设计，单机不需要 Redis/60 协程。
- **备选 B（hook 驱动）**：LLM 调用阻塞 hook，且无调度器/无兜底周期，退化回"hook 里塞长任务"。
- **结论**：mcp-server 单进程承载管线，满足完全自动、配置单一、可靠性（可重试/自愈）。

---

## 2. 数据模型与存储（已确认，第二节）

### 2.1 存储决策

- **JSONL append-only（真源）** + **SQLite 索引（FTS5 + sqlite-vec）** 双写。
- 向量层：**`sqlite-vec` + 托管 embedding**（复用同一托管端点 `/v1/embeddings`），FTS5 作 keyword 兜底，hybrid 召回。
- L1 记录**不加 `summary` 字段**（已确认），靠 `content` + `priority` + `type` 承担"重点"展示。

### 2.2 L0 记录形态（真源，`conversations/YYYY-MM-DD.jsonl`）

```json
{
  "sessionKey": "mymore",
  "sessionId": "session-uuid",
  "userId": "dante926",
  "agentId": "backend-architect",
  "recordedAt": "2026-08-04T14:20:00.000Z",
  "id": "msg_1780_ab12cd",
  "role": "user",
  "content": "我们选方案B会需要手动调skill吗",
  "timestamp": 1780558000000
}
```

- 每行一条，按天分文件、所有 session 合并，`sessionKey` 在行内（不在文件名）
- 最多 2 条/轮（user 真实提问 + assistant 纯文本）

### 2.3 L1 记录形态（结构化）

```json
{
  "id": "rec_9f3a...",
  "type": "episodic",
  "content": "用户（张三）在 2026-08-04 确认 mymore 改造采用方案A：本地单进程 + 托管LLM runner，管线全自动。",
  "priority": 82,
  "scene_name": "我（AI）在和用户（后端架构师）做 mymore 改造方案设计",
  "source_message_ids": ["msg_...", "msg_..."],
  "created_at": "2026-08-04T14:23:00Z",
  "version": 2,
  "team": "dante",
  "agent": "backend-architect"
}
```

### 2.4 SQLite memory_meta 扩展列

新增：`type` / `priority` / `scene_name` / `version` / `source_message_ids(json)` / `team` / `agent`。hub 直接查索引渲染结构化卡片。

**依赖统一**：`better-sqlite3` 统一为单版本（当前 core=13.0.1 vs mcp-server=^11.8.0 冲突），消除 WAL 多进程并发写 `database is locked` 风险。

### 2.5 数据目录

```
~/.mymore/
├── config.json          # hub UI 写入：LLM base_url + key + model + pipeline 参数
├── conversations/       # L0 JSONL（按天，session 合并）── 真源
├── records/             # L1 JSONL（append-only，逐记忆）── 真源
├── scene_blocks/        # L2 场景 .md 文档
├── persona.md           # L3 用户画像
├── profiles/<team>/<agent>/   # 租户隔离（如需要）
└── .index/memory.db     # SQLite：FTS5 + sqlite-vec + meta（索引层）
```

---

## 3. 管线调度与 L0→L1 捕获（已确认，第三节）

### 3.1 hook 只做传感器（不跑 LLM、不碰 SQLite）

| hook | 承担 |
|---|---|
| `UserPromptSubmit` | 记录用户真实提问（去 harness 噪声）→ 通知管线"有增量" |
| `Stop` | 记录 assistant 回复（纯文本、去 tool/thinking）→ 通知管线"轮次完成" |
| `SessionEnd` | flush 未落盘增量 + 触发兜底调度 |

**Stop 与 UserPromptSubmit 的时序合并**：`Stop` 的 `transcript_path` 含完整对话，但 hook 只取**本轮增量**（用 hook 侧缓存的上一轮消息数 / 时间游标定位，`timestamp > cursor` 严格大于），避免重复。user 消息以 `UserPromptSubmit` 缓存的「真实提问」为准（防 harness 污染），assistant 回复从 `Stop` transcript 的增量段提取。两者在 mcp-server 侧按 `sessionKey + timestamp` 归并到同一轮 L0 batch。

**可靠性范式**：hook→mcp-server 通知 fire-and-forget + 指数退避（500ms→1s→2s+jitter，只重试 5xx/网络错）；SIGTERM flush；无幂等键、接受极端重复（L1 蒸馏按 hash 兜底）；hook 异常记日志 + `{continue:true}`，**绝不静默**。

### 3.2 L0 清洗

- user：抽真实提问，剥 harness 噪声（`<system_reminder>`/时间戳/tool 回显），0/1/2 级判非人类输入→不写
- assistant：只取纯文本，去 tool_use/tool_result/thinking，代码块剥离
- 双保险增量：`position slice` + `timestamp cursor`（严格大于）
- 分块：>8192 code units 按 UTF-16 边界切（不破坏 surrogate pair）

### 3.3 L1 调度（攒批，不逐句）

- **阈值**：`conversation_count >= effectiveThreshold` → 跑 L1
- **warm-up 翻倍**：新 session 阈值 1→2→4→8→`everyNConversations`(5)
- **空闲兜底**：`l1IdleTimeoutSeconds`(600s) 到点 → 跑 L1
- **shutdown flush**：SessionEnd / 退出时 flush
- **失败重试**：消息放回 buffer，30s 后重试，最多 5 次

### 3.4 L1 输入切分

- `newMessages = qualified.slice(-10)`；`backgroundMessages` = 紧邻前最多 5 条（严禁提取）；`previousSceneName` 继承。

### 3.5 L1 提取（单次 LLM：情境切分 + 提取 + JSON）

- 角色「情境切分与记忆提取专家」
- 三类 `persona` / `episodic` / `instruction` + priority 打分（80-100/60-79/<60 丢）
- 触发词、排除项、JSON 输出契约照搬参考
- 解析容错：剥代码块→抽数组→sanitize→repair（裸标识符/尾逗号）→逐字段补默认值（不全量丢弃）

### 3.6 L1 去重/审核（第二道审核）

- **候选召回（三级降级）**：① `sqlite-vec` 向量 → ② FTS5 BM25 → ③ 无召回能力→直接 store
- **LLM 批量判定** `CONFLICT_DETECTION_SYSTEM_PROMPT`：统一候选池（跨记忆互斥）+ 四动作 `store/skip/update/merge` + 跨 type + 多对多
- **隔离**：filter 全程带 team/agent，去重绝不跨租户
- **落库**：skip→不落；store→JSONL+索引 upsert；update/merge→删旧向量+追加，`version++`

---

## 4. L2 Scene / L3 Persona 与 hub 展示（已确认，第四节）

### 4.1 L2 — Scene Diaries

- 输入：增量读 L1（`updatedAfter` 游标），无新记录 `{skipped:true}`；按 scope 分组
- 角色：「Memory Consolidation Architect」，**叙事文档不是清单**
- 策略：`UPDATE` > `MERGE` > `CREATE`（限 1 个/批，须 read 查 ≥2 最相似）；`[DELETED]` 软删
- 热度：新建 1、更新 +1、合并 sum+1 → 驱动排序
- 八阶段流水线：备份→读索引→分级预警→组装 prompt→LLM agent（沙箱 scene_blocks/）→清理软删+归一+同步索引→更新 Scene Navigation→解析 `[PERSONA_UPDATE_REQUEST]`

### 4.2 L3 — Persona 生成

- 角色「Persona Architect — Incremental Evolution Protocol」，文件工具写 `persona.md`（≤2000 字符）
- 四层扫描：Base → Interest Graph → Interface → Core
- 输出：Archetype + Chapter 1-4
- 增量演化：`first/incremental` + changedScenes + 迭代决策（强化/补充/修正/重构/不改）；读回校验 + checkpoint
- **五级触发**：P1 request_persona_update / P2 冷启动 / P3 首个场景 / P4 阈值

### 4.3 调度级联

L1 完成→重置计数+advanceL2Timer（只提前不延后）；L2 完成→armL2MaxInterval+triggerL3；冷 session 24h 停；L3 全局串行+pending 去重。

默认参数（config.json）：`everyNConversations=5` / `l1IdleTimeoutSeconds=600` / `l2DelayAfterL1Seconds=90` / `l2MinIntervalSeconds=900` / `l2MaxIntervalSeconds=3600` / `triggerEveryN`（L3 阈值）

### 4.4 hub 三层卡片

- L1 记忆（priority 降序）：`[type] ⭐priority` + content + scene + 时间/version/来源
- L2 场景（heat 降序）：summary + scene_name + heat + 更新
- L3 画像：Archetype + 基本信息/长期偏好/核心特质

---

## 5. 错误处理与可观测性（已确认，第五节）

### 5.1 Hook 层

- 废除吞异常；结构化日志 `~/.mymore/logs/hooks-YYYY-MM-DD.jsonl`（事件/输入摘要/耗时/成败/原因）
- 失败记日志 + `{continue:true}`；通知 fire-and-forget + 指数退避

### 5.2 MCP server

- 工具返回结构化错误码（`code/category/message`）
- 召回 5s 超时兜底 → 结构化 `RecallResult.error`
- 全链路计时：`⏱ Capture timing: total/l0Record/l1Extract/dedup`

### 5.3 管线失败策略

| 阶段 | 策略 |
|---|---|
| L0 | 5xx/网络→重试；4xx→抛；无幂等键 |
| L1 | buffer+30s 重试×5；LLM 抛错→success:false 全 0 |
| L1 去重 | 召回降级（向量→BM25→store）；判定失败→storeAll |
| L2 | 备份→跑→失败回滚；软删配额 |
| L3 | 写后读回校验，失败重建 |

### 5.4 日志

```
~/.mymore/logs/
├── hooks-YYYY-MM-DD.jsonl
├── pipeline-YYYY-MM-DD.jsonl
└── llm-YYYY-MM-DD.jsonl
```

hub：`/api/health`（存活+管线状态）+ `/api/pipeline`（各阶段 last run/耗时/成败/pending buffer）

### 5.5 配置校验

hub 前端校验 + mcp-server 启动 zod schema 校验，非法即报错。

---

## 6. 借鉴清单映射（memory-pipeline.md 第 8 节 → 本设计落点）

| # | 参考清单 | 本设计落点 |
|---|---|---|
| 1 | 增量分批不逐条，warm-up 翻倍 | §3.3 |
| 2 | 结构化 JSON 抽取非自由总结，逐字段容错 | §3.5 |
| 3 | 输入切分 new(10)+bg(5)+上一情境，质量门 | §3.4 |
| 4 | 三层去重（向量→BM25→LLM 判定），绝不跨租户 | §3.6 |
| 5 | 双写 JSONL 真源 + 索引，update/merge 删旧 version++ | §2.1/§3.6 |
| 6 | L2 叙事重写，UPDATE>MERGE>CREATE，软删，热度 | §4.1 |
| 7 | L3 文件工具写 persona，增量演化 + checkpoint | §4.2 |
| 8 | L0 清洗抽真实提问，只存 role/content | §3.2 |
| 9 | 注入用锚点 + 缓存（本地场景：只读工具） | §1.1 |
| 10 | L1 自动召回下线，改静态只读工具 | §1.1 |
| 11 | fire-and-forget + 指数重试 + SIGTERM flush | §3.1/§5 |
| 12 | 调度级联 + 兜底周期 + L3 全局串行 | §4.3 |

---

## 7. 改造范围与里程碑

### 阶段 1：基础设施（存储层）
- 迁移 @mymore/core：加 `type/priority/scene_name/version/source_message_ids/team/agent` 列
- 引入 `sqlite-vec` + 托管 embedding 客户端；records/ 与 conversations/ JSONL 真源

### 阶段 2：L0 捕获 + 调度骨架
- hook 改传感器（UserPromptSubmit/Stop/SessionEnd），废除吞异常
- mcp-server 加 PipelineManager（阈值/warm-up/空闲/兜底）+ L0 入口

### 阶段 3：L1 管线
- LLMRunner（托管端点）+ L1 提取 prompt + 解析容错 + L1 去重（LLM 审核）

### 阶段 4：L2/L3
- Scene Extractor + persona 生成器 + 五级触发 + 调度级联

### 阶段 5：hub 与可观测
- 配置 UI（LLM base_url/key/model + pipeline 参数）
- 三层记忆卡片 + /api/health + /api/pipeline + 三份日志

---

## 8. 待办 / 明确不做

### 不做（避免范围膨胀）
- ❌ offload 上下文卸载管道（与核心记忆管道无关）
- ❌ 分布式调度（Redis/worker/死信）——单机 MemoryPipelineManager 足够
- ❌ L1 自动召回注入（参考已下线）
- ❌ 多租户完整隔离（`profiles/<team>/<agent>` 目录预留，后续扩展）

### 待实施时确认（非阻塞）
- 托管端点默认 base_url：默认留空由用户在 hub UI 填；可选预置常用 OpenAI 兼容端点下拉（如 OpenAI / DeepSeek / 本地 Ollama 网关），实施时按可用列表决定
- `triggerEveryN`（L3 阈值）默认值：参考 `everyNConversations` 同级，暂定与 L2 `maxInterval` 联动，实施时定
- 是否保留 Markdown 组文件（groups/*.md）：新存储以 JSONL 为真源，`groups/*.md` 迁入 scene_blocks 体系后弃用；历史数据迁移脚本一次性处理

---

## 9. 附录：已确认决策清单

| 决策 | 结论 |
|---|---|
| 部署 | 本地单进程，mcp-server 承载管线 |
| LLM 执行者 | 方案 A（内嵌 runner 全自动） |
| 模型源 | 托管 OpenAI 兼容端点，hub UI 写 config |
| 召回 | 只读工具按需，不自动注入 |
| 存储 | JSONL 真源 + SQLite(FTS5+sqlite-vec) 索引 |
| 向量 | sqlite-vec + 托管 embedding |
| L1 summary | 不加 |
| hook 职责 | 只做传感器，不碰 SQLite/LLM |
| L1 调度 | 阈值+warm-up+空闲+shutdown，默认 everyN=5 |
| L2 | 叙事重写 UPDATE>MERGE>CREATE |
| L3 | 文件工具写 persona + 五级触发 |
| 错误处理 | hook 不吞异常，结构化错误码，超时兜底 |
| 可观测 | 三份日志 + hub health/pipeline |
