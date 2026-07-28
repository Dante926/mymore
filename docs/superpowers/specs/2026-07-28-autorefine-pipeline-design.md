# mymore 自动精炼管线设计

## 背景

mymore 当前使用三阶段架构：evermem 风格的 Hook 捕获、mymore 的本地存储（SQLite FTS5 + Markdown）、以及
EverOS 风格的精炼流程。但精炼步骤依赖 Claude 手动操作，缺乏自动化。

本设计实现「对话中自动精炼 + 批处理工具」双模式，让原始对话自动保存，精炼摘要自动产生。

## 三阶段管线

```
Phase 1: 自动捕获 (evermem 模式)
  Stop Hook → 保存原文为 session (raw episode)
  1 小时后自动清理未处理的 raw

Phase 2: 自动精炼 (EverOS 模式)
  对话中:
    Claude 看到 raw → 自动判断价值
      → 有价值 → add_memory(persistent) + deprecate_episodes
      → 无价值 → 忽略（到期清理）
  批处理:
    reflect_all 工具 → 一次性处理所有待精炼条目

Phase 3: 自动维护
  Stop Hook → 每小时清理过期 session、归档旧数据
```

## 改动清单

### 1. Stop Hook — 恢复自动保存

**文件：** `hooks/scripts/store-memories.js`

改动：从「只做 consolidate」恢复为「保存原文 + 1小时过期 + consolidate」

保存逻辑：
- 读取 transcript.jsonl，提取最后一轮 user + assistant 文本
- 保存为 `session` 分类，`group_key` 来自 cwd 路径末段
- 同时写入 FTS5 和 Markdown 组文件

清理逻辑：
- 删除超过 1 小时的 `session` 条目（FTS5 + 元数据）
- 归档 `valid_until` 过期的条目
- 删除超过 30 天的 `archived` 条目

### 2. 全局 Skill — 自动精炼指令

**文件：** `~/.claude/skills/mymore-memory.md`

```markdown
---
alwaysInclude: true
---

## mymore 自动精炼

当会话中出现 `session` 类型的原始记忆时，自动执行：

1. **价值判断** — 有持久价值吗？
   - 决策、架构选型、Bug 修复、项目约定、用户偏好 → 保留
   - 临时调试、单次输出、日常聊天 → 忽略

2. **生成摘要** — 结构化格式：
   ```
   ## {类型}: {一句话主题}
   **详情**: {2-3 句关键事实}
   ```

3. **调用 MCP 工具**：
   - `add_memory(content=精炼摘要, category=persistent, group_key="{项目名}")`
   - `deprecate_episodes(episode_ids=[raw_id], superseded_by="{新ID}")`
```

Skill 的作用域：所有 Claude Code 项目全局生效，无需在每个项目配置。

### 3. reflect_all MCP 工具

**文件：** `apps/mcp-server/src/bootstrap.ts`

新增工具：

```
reflect_all
  参数:
    group_key: string (可选，限定特定项目)
    dry_run: boolean (默认 false)
  行为:
    1. 读取所有未处理的 session 条目（superseded_by IS NULL）
    2. 按 group_key + 时间窗口聚类
    3. 返回结构化数据给 Claude
    4. Claude 对每个聚类调用 add_memory + deprecate_episodes
```

### 4. SessionStart Hook — 精炼提示

**文件：** `hooks/scripts/session-context.js`

在 `<session-context>` 注入时，额外提示 Claude 注意未精炼的 raw 条目。
当 `recentMemories` 包含 `session` 类型时，显示：

```
📝 发现 N 条未精炼的记忆，正在评估中...
```

### 5. 配置变更

- 安装 `install.sh` 改为自动创建 `~/.claude/skills/mymore-memory.md`
- `CLAUDE.local.md` 保持精简，指向全局 skill

## 数据流

```
用户对话
   │
   ▼
Stop Hook ──→ 保存 raw (session, 1h过期)
   │
   ▼ (下次会话)
SessionStart ──→ 加载 raw + 精炼指令
   │
   ▼
Claude 看到 raw 条目
   ├── 有持久价值
   │     ├── add_memory(content=精炼摘要, category=persistent)
   │     └── deprecate_episodes(ids=[], superseded_by=新ID)
   │
   ├── 无价值 → 忽略（1h自动清理）
   │
   └── 批量操作
         └── reflect_all → 所有未处理 raw → Claude 批量精炼

consolidate 定时清理过期数据
```

## 文件变更汇总

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `hooks/scripts/store-memories.js` | 修改 | 恢复自动保存 + 1h过期清理 |
| `apps/mcp-server/src/bootstrap.ts` | 修改 | 新增 `reflect_all` 工具 |
| `~/.claude/skills/mymore-memory.md` | 新建 | 全局自动精炼指令 |
| `hooks/scripts/session-context.js` | 修改 | raw 条目提示 |
| `CLAUDE.local.md` | 修改 | 精简指向 |

## 验证方法

1. Stop hook 保存 raw：对话后检查 DB session 条目
2. 自动精炼：启动新会话，Claude 自动处理 raw
3. reflect_all：手动调用批量处理
4. 清理：1小时后 session 条目自动删除
