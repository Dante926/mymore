# Phase 2 设计：为 mymore 装配 Hook

> 2026-07-23

## 背景

mymore 已完成 Phase 1（Markdown + FTS5 + Frozen Snapshot + Consolidation），4 个 MCP Tool 全部可用。但目前记忆的存储和读取都需要**用户手动触发**，Agent 不会自动记录对话中的关键信息，也不会在需要时主动检索。

Phase 2 的目标是：让 Agent（Claude Code）在对话过程中**自动存储**记忆，并在需要时**按需检索**，无需用户介入。

## 设计原则

1. **自动存，按需读** — 存储过程全自动、无感知；读取由 Agent 在需要时主动发起
2. **零噪声** — 不做自动读取注入，不污染上下文
3. **宁精勿多** — 只存有长期价值的信息（决策、偏好、修复），不存临时中间结果
4. **不确定时问用户** — Agent 对记忆内容不确定时，主动向用户确认

## 架构

```
UserPromptSubmit ──► Hook ──► extract key info ──► add_memory(persistent)
                                                      │
Stop ──► Hook ──► session summary ──► add_memory(session)
                                      │
                                      └─► consolidate

对话中 Agent 需要上下文 ──► search_memory（按需调用）
                              │
                              └─► 结果不确定？→ 询问用户
```

## Hook 配置

### 文件位置

`.claude/settings.local.json`（项目级 local 配置，不入 Git）

### 事件：`UserPromptSubmit`

在用户每次提交消息后触发，提取对话中的关键信息并存储。

**存储规则**：

| 类型 | 判断条件 | 示例 |
|---|---|---|
| 用户偏好 | "我喜欢/偏好/改成/使用"等偏好表达 | "我用暗色模式" |
| 技术决策 | 框架、架构、方案选择 | "用 pnpm 代替 npm" |
| Bug 修复 | "修复/解决/崩溃/错误" + 根因 | "NullPointer 是 xxx 导致的" |
| 项目约定 | 代码风格、命名规范、目录结构 | "组件放 src/components" |
| 其他 | 默认为 session，不存 persistent | 普通对话内容 |

**实现方式**：在 `CLAUDE.md` 或 `CLAUDE.local.md` 中写入指令，让 Agent 在收到用户消息后，判断是否有关键信息需要存储，然后调用 `mymore` 的 `add_memory` 工具。

> 注：Claude Code 的 Hook 机制目前是工具调用级别的（PreToolUse / PostToolUse），而非对话级别的自动触发。因此"用户消息后自动存储"的最佳实现方式，是将存储指令写入 Agent 的系统指令（CLAUDE.local.md），让 Agent 在对话中自觉执行。

### 事件：`Stop`

在会话结束时触发。

```
1. 汇总本次会话的关键信息
2. 调用 add_memory(content="摘要", category="session")
3. 调用 consolidate(days=7) 自动归档过期记忆
```

### 存储分类

| 分类 | 存储时机 | 清理策略 |
|---|---|---|
| `persistent` | 用户偏好、决策、修复 | 永不过期，直至被 superseded |
| `session` | 会话摘要 | 仅当前会话参考，后续 consolidate 自动归档 |

## Agent 读取指令

在 `CLAUDE.local.md` 中写入：

```markdown
## 记忆检索

当用户提及以下内容时，主动调用 mymore 的 `search_memory` 工具检索相关记忆：

- "上次/之前/以前" 相关的记忆
- 询问某个决策、偏好、配置时
- 开始一项需要历史上下文的任务时

检索到相关记忆后：
- 如果记忆内容明确且相关 → 直接使用
- 如果记忆内容不确定或有多条相似记录 → 向用户确认后再使用
- 如果未检索到 → 告知用户未找到
```

## 信噪比控制

| 控制手段 | 说明 |
|---|---|
| 不自动读取 | 不在 SessionStart 或 UserPromptSubmit 时自动注入记忆 |
| 只在需要时检索 | Agent 根据用户问题判断是否需要查记忆 |
| 不确定时确认 | 避免 Agent 基于模糊记忆做出错误判断 |
| 只存有价值信息 | 普通对话内容不持久化 |

## 验证标准

1. ✅ 一次对话中做出的偏好设置，新会话中 Agent 能检索到
2. ✅ 在检索到相关记忆时，Agent 能正确使用
3. ✅ 检索结果模糊时，Agent 会向用户确认
4. ✅ 普通对话不会被误存为 persistent
5. ✅ 会话结束时自动 consolidate 无报错
