# Phase 2：mymore Hook 装配 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 mymore 装配 Claude Code Hook 和 Agent 指令，实现自动存储和按需读取记忆。

**Architecture:** 通过 `.claude/settings.local.json` 配置 Claude Code Hooks（`UserPromptSubmit` + `Stop`），通过 `CLAUDE.local.md` 写入 Agent 记忆检索指令。全部为配置变更，不修改 mymore 源码。

**Tech Stack:** Claude Code Hooks + mymore MCP Tools

## Global Constraints

- `.claude/settings.local.json` 不入 Git（项目 `.gitignore` 已包含 `.claude/`）
- `CLAUDE.local.md` 不入 Git（已在 `.gitignore` 中）
- Hook 调用 mymore MCP 工具时使用 `mcp__mymore__*` 工具名
- 不在 `UserPromptSubmit` 时自动读取记忆——只存储
- 存储时遵循三分类规则：用户偏好/决策/修复 → `persistent`，普通摘要 → `session`

---

### Task 1: 创建 .claude/settings.local.json（Hook 配置入口）

**Files:**
- Create: `.claude/settings.local.json`

**Interfaces:**
- Consumes: nothing (bootstrap)
- Produces: Hook 注册入口，Task 2 和 Task 3 将在此文件中添加具体 Hook 脚本

- [ ] **Step 1: 创建目录**

```bash
mkdir -p .claude
```

- [ ] **Step 2: 创建 settings.local.json**

```json
{
  "hooks": {
    "UserPromptSubmit": [],
    "Stop": []
  }
}
```

- [ ] **Step 3: 验证文件可解析**

```bash
jq empty .claude/settings.local.json && echo "OK"
```

Expected: OK

- [ ] **Step 4: 提交**

```bash
git add .claude/settings.local.json
git commit -m "chore: add hook config scaffold for Phase 2"
```

---

### Task 2: 实现 UserPromptSubmit Hook（自动存储关键信息）

**Files:**
- Create: `.claude/hooks/UserPromptSubmit/mymore-store.sh`

**Interfaces:**
- Produces: 在用户提交消息后，提取并存储关键记忆到 mymore

- [ ] **Step 1: 创建 Hook 目录**

```bash
mkdir -p .claude/hooks/UserPromptSubmit
```

- [ ] **Step 2: 编写存储脚本 `mymore-store.sh`**

Hook 脚本通过 MCP 命令行工具调用 mymore，将用户消息中的关键信息分类存储。

```bash
#!/bin/sh
# mymore-store.sh — UserPromptSubmit Hook
# 在用户提交消息后调用，提取关键信息存储到 mymore
#
# 输入：stdin 或环境变量 CLAUDE_USER_PROMPT（用户消息内容）
#
# 策略：
# - 包含"偏好""喜欢""改用"等 → persistent
# - 包含"修复""崩溃""错误"+根因 → persistent
# - 其他 → 不存储（信噪比控制）

set -e

# 读取用户输入
PROMPT="${CLAUDE_USER_PROMPT:-}"
[ -z "$PROMPT" ] && [ ! -t 0 ] && PROMPT=$(cat)

# 如果没有输入，跳过
[ -z "$PROMPT" ] && exit 0

# 使用关键词匹配判断是否需要存储
PERSISTENT_KEYWORDS="偏好|喜欢|改为|改用|使用|选择|决策|修复|崩溃|bug|fix|配置|约定|规范|架构|采用|替换|迁移"

# 如果匹配 persistent 关键词，通过 docker 调用 mymore
if echo "$PROMPT" | grep -qiE "$PERSISTENT_KEYWORDS"; then
  # 截取关键内容（前 500 字符）
  CONTENT=$(echo "$PROMPT" | head -c 500)

  # 构建 JSON-RPC 请求调用 add_memory
  PAYLOAD=$(cat << EOF
{
  "jsonrpc":"2.0",
  "id":"hook-$(date +%s)",
  "method":"tools/call",
  "params":{
    "name":"add_memory",
    "arguments":{
      "content":"$CONTENT",
      "owner_id":"dante926",
      "category":"persistent",
      "track":"user"
    }
  }
}
EOF
)

  # 通过 docker compose run 调用 mymore
  # 使用后台运行 + 短超时，不阻塞用户操作
  echo "$PAYLOAD" | docker compose run --rm -T mymore-mcp 2>/dev/null &
  disown
fi

exit 0
```

> **注意：**
> 1. Hook 使用 `docker compose run --rm -T` 而非前台交互模式，因为 Hook 不能阻塞用户操作
> 2. `disown` 后 Hook 在后台运行，不影响用户体验
> 3. 使用 `-T`（no TTY）确保纯文本管道通信
> 4. JSON-RPC 调用 mymore 的 `add_memory` 工具

- [ ] **Step 3: 赋予执行权限**

```bash
chmod +x .claude/hooks/UserPromptSubmit/mymore-store.sh
```

- [ ] **Step 4: 注册到 settings.local.json**

将 `settings.local.json` 更新为：

```json
{
  "hooks": {
    "UserPromptSubmit": [
      ".claude/hooks/UserPromptSubmit/mymore-store.sh"
    ],
    "Stop": []
  }
}
```

- [ ] **Step 5: 验证 Hook 可执行**

```bash
CLAUDE_USER_PROMPT="用户偏好暗色模式，所有界面使用暗色主题" bash .claude/hooks/UserPromptSubmit/mymore-store.sh && echo "Hook executed"
```

Expected: Hook executed（不阻塞，无报错）

- [ ] **Step 6: 提交**

```bash
git add .claude/
git commit -m "feat: add UserPromptSubmit hook for auto memory storage"
```

---

### Task 3: 实现 Stop Hook（会话摘要 + Consolidation）

**Files:**
- Create: `.claude/hooks/Stop/mymore-summary.sh`

**Interfaces:**
- Consumes: mymore `add_memory` + `consolidate` tools
- Produces: 每个会话结束时自动生成摘要并归档过期记忆

- [ ] **Step 1: 创建 Hook 目录**

```bash
mkdir -p .claude/hooks/Stop
```

- [ ] **Step 2: 编写 Stop 脚本 `mymore-summary.sh`**

```bash
#!/bin/sh
# mymore-summary.sh — Stop Hook
# 在会话结束时触发，汇总本次会话的关键信息并归档过期记忆
#
# 输出：
# 1. 会话关键摘要（session 分类）
# 2. consolidate 调用

set -e

SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 1. 记录会话摘要
SUMMARY="会话结束于 $DATE\n会话 ID: $SESSION_ID"

PAYLOAD_ADD=$(cat << EOF
{
  "jsonrpc":"2.0",
  "id":"stop-add-$(date +%s)",
  "method":"tools/call",
  "params":{
    "name":"add_memory",
    "arguments":{
      "content":"$SUMMARY",
      "owner_id":"dante926",
      "category":"session",
      "track":"user"
    }
  }
}
EOF
)

echo "$PAYLOAD_ADD" | docker compose run --rm -T mymore-mcp 2>/dev/null

# 2. 运行 consolidate 归档过期记忆
PAYLOAD_CONSOLIDATE=$(cat << EOF
{
  "jsonrpc":"2.0",
  "id":"stop-con-$(date +%s)",
  "method":"tools/call",
  "params":{
    "name":"consolidate",
    "arguments":{
      "owner_id":"dante926",
      "days":7,
      "dry_run":false
    }
  }
}
EOF
)

echo "$PAYLOAD_CONSOLIDATE" | docker compose run --rm -T mymore-mcp 2>/dev/null

exit 0
```

- [ ] **Step 3: 赋予执行权限**

```bash
chmod +x .claude/hooks/Stop/mymore-summary.sh
```

- [ ] **Step 4: 注册到 settings.local.json**

```json
{
  "hooks": {
    "UserPromptSubmit": [
      ".claude/hooks/UserPromptSubmit/mymore-store.sh"
    ],
    "Stop": [
      ".claude/hooks/Stop/mymore-summary.sh"
    ]
  }
}
```

- [ ] **Step 5: 验证**

```bash
bash .claude/hooks/Stop/mymore-summary.sh && echo "Stop hook executed"
```

Expected: Stop hook executed（无报错）

- [ ] **Step 6: 提交**

```bash
git add .claude/
git commit -m "feat: add Stop hook for session summary and consolidation"
```

---

### Task 4: 创建 CLAUDE.local.md（Agent 记忆检索指令）

**Files:**
- Create: `CLAUDE.local.md`

**Interfaces:**
- Consumes: mymore `search_memory` tool（Agent 主动调用）
- Produces: Agent 在需要时自动检索 mymore 记忆

- [ ] **Step 1: 创建 CLAUDE.local.md**

```markdown
# mymore 记忆系统指令

## 记忆检索

当用户提及以下内容时，主动调用 mymore 的 `search_memory` 工具检索相关记忆：

- "上次/之前/以前/上次我们" 相关的话题
- 询问某个决策、偏好、配置、Bug 修复
- 开始一项需要历史上下文的任务时
- 用户说"你还记得..."时

### 检索规则

1. 调用 `search_memory` 搜索相关关键词
2. 如果结果明确且相关 → 直接使用
3. 如果结果不确定或有多个相似条目 → 向用户确认后再使用
4. 如果没找到 → 告知用户未找到相关记忆

### 自动存储说明

本项目的 `.claude/settings.local.json` 已配置 Hook：
- `UserPromptSubmit` Hook：自动存储用户偏好、技术决策、Bug 修复等关键信息到 mymore（persistent 分类）
- `Stop` Hook：会话结束时自动存储摘要（session 分类）+ 运行 consolidate

无需手动调用 add_memory。需要记忆时使用 `search_memory` 即可。
```

- [ ] **Step 2: 验证文件编码和格式**

```bash
file CLAUDE.local.md && wc -c CLAUDE.local.md
```

Expected: UTF-8 text, reasonable size

- [ ] **Step 3: 提交**

```bash
git add CLAUDE.local.md
git commit -m "docs: add CLAUDE.local.md with memory retrieval instructions"
```

---

### Task 5: 集成测试

**Files:**
- Test: `.claude/hooks/UserPromptSubmit/mymore-store.sh`
- Test: `.claude/hooks/Stop/mymore-summary.sh`
- Test: mymore MCP tools

- [ ] **Step 1: 测试 UserPromptSubmit Hook 的存储功能**

模拟 Hook 触发：

```bash
# 模拟用户提交偏好
CLAUDE_USER_PROMPT="用户偏好暗色模式" bash .claude/hooks/UserPromptSubmit/mymore-store.sh

# 等待 Docker 完成
sleep 5

# 验证记忆已存储
echo '{"jsonrpc":"2.0","id":"test-1","method":"tools/call","params":{"name":"search_memory","arguments":{"query":"暗色模式","owner_id":"dante926"}}}' | docker compose run --rm -T mymore-mcp 2>/dev/null
```

Expected: 搜索结果包含"暗色模式"

- [ ] **Step 2: 测试 Hook 信噪比（普通对话不应存储）**

```bash
# 模拟普通对话（无关键词）
CLAUDE_USER_PROMPT="今天天气不错" bash .claude/hooks/UserPromptSubmit/mymore-store.sh

# 搜索普通对话内容
echo '{"jsonrpc":"2.0","id":"test-2","method":"tools/call","params":{"name":"search_memory","arguments":{"query":"天气不错","owner_id":"dante926"}}}' | docker compose run --rm -T mymore-mcp 2>/dev/null
```

Expected: 未搜索到结果（信噪比控制生效）

- [ ] **Step 3: 测试 Stop Hook**

```bash
bash .claude/hooks/Stop/mymore-summary.sh
```

Expected: 无报错

- [ ] **Step 4: 测试 CLAUDE.local.md 指令**

在新会话中验证：
1. 询问"上次我们讨论了什么？" → Agent 应调用 `search_memory`
2. 如果搜索结果不明确 → Agent 应询问用户确认

Expected: Agent 按 CLAUDE.local.md 指令行为

- [ ] **Step 5: 确认最终配置完整性**

```bash
echo "=== 项目文件 ==="
echo "settings.local.json:"
cat .claude/settings.local.json
echo ""
echo "Hooks:"
ls -la .claude/hooks/UserPromptSubmit/ .claude/hooks/Stop/
echo ""
echo "CLAUDE.local.md:"
head -3 CLAUDE.local.md
```
