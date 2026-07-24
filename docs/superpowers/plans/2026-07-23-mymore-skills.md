# mymore Skills 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans to implement this plan task-by-task.

**Goal:** 创建两个 Skill：`/mymore-deploy`（部署指引）和 `/mymore-recap`（会话总结与记忆存储）

**Architecture:** 两个独立的 Skill 文件放在 `~/.claude/skills/` 目录下，Claude Code 自动加载。

**Tech Stack:** Markdown + Claude Code Skill 格式（YAML frontmatter + 指令正文）

## Global Constraints

- Skill 文件放在 `~/.claude/skills/`（用户级），非项目仓库
- 命令名前缀统一为 `/mymore-`
- frontmatter 必须包含 `name` 和 `description`
- description 控制在 1-2 句话，简明扼要

---

### Task 1: 创建 `/mymore-deploy` Skill

**Files:**
- Create: `~/.claude/skills/mymore-deploy/SKILL.md`

**Interfaces:**
- Consumes: Docker, git, docker compose 命令
- Produces: mymore 完整部署流程

- [ ] **Step 1: 创建 Skill 目录**

```bash
mkdir -p ~/.claude/skills/mymore-deploy
```

- [ ] **Step 2: 编写 SKILL.md**

```markdown
---
name: mymore-deploy
description: 克隆 mymore 项目并构建 Docker 部署。当用户想部署、启动、安装 mymore 时触发。
---

# /mymore-deploy

引导用户完整走通 mymore 的克隆、构建、部署流程。每步检查前置条件，失败时给出明确原因。

## 环境检查

执行以下检查，按顺序：

```bash
# 1. git 是否安装
git --version
# 失败 → "git 未安装，请先安装 git: https://git-scm.com/downloads"
# 然后退出

# 2. Docker 是否安装
docker --version
# 失败 → "Docker 未安装，请先安装 Docker Desktop: https://www.docker.com/products/docker-desktop"
# 然后退出

# 3. Docker 是否运行
docker info
# 失败 → "Docker 未运行，请启动 Docker Desktop"
# 然后退出
```

## 克隆项目

```bash
git clone https://github.com/ZH1616/mymore.git
cd mymore
```

> ⚠️ 如果 `mymore` 目录已存在，询问用户是否覆盖或 `git pull` 更新。

## 构建镜像

```bash
docker compose build
```

耗时约 2-5 分钟。

> ❌ 构建失败 → 建议用户执行以下排查：
> ```bash
> # 查看具体错误
> docker compose build --no-cache 2>&1 | tail -30
> # 常见原因：网络问题重试、磁盘空间不足
> ```

## 启动服务

```bash
docker compose up -d
sleep 3
docker compose ps
```

期望输出：`mymore-mcp` 和 `mymore-hub` 都显示 `Up`。

> ❌ 端口 3456 冲突：
> ```bash
> lsof -i :3456
> # 找到占用进程后 kill 或停止该服务
> ```

## 验证服务

### 验证 MCP 服务

```bash
echo '{"jsonrpc":"2.0","id":"v","method":"tools/list","params":{}}' | \
  docker compose run --rm -T mymore-mcp 2>/dev/null
```

期望返回 4 个工具：`add_memory`、`search_memory`、`forget_memory`、`consolidate`。

### 验证 Hub 服务

```bash
curl -s http://localhost:3456/health
```

期望返回：`{"status":"ok","uptime":...}`

> ❌ 服务未启动 → 查看日志：
> ```bash
> docker logs mymore-mcp
> docker logs mymore-hub
> ```

## 配置 Claude Desktop

展示配置代码：

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

> ⚠️ 如果工作目录不是 mymore 项目根目录，需在 args 中添加 `-f /path/to/mymore/docker-compose.yml`。

## 完成

当所有验证通过后，输出：

```
✅ mymore 已成功部署！
  ├─ MCP 服务:    可用 (4 个工具)
  ├─ Hub 仪表盘:  http://localhost:3456
  └─ 数据目录:    ~/.mymore/
```

---

## 错误排查速查表

| 症状 | 检查 | 解决 |
|---|---|---|
| `git clone` 失败 | 网络连接 | `ping github.com` |
| `docker compose build` 慢/失败 | 网络/磁盘 | 重试 / 清理磁盘空间 |
| 容器无法启动 | 端口占用 | `lsof -i :3456` |
| MCP 工具未返回 | 容器状态 | `docker logs mymore-mcp` |
| Hub 无法访问 | 容器状态 | `docker logs mymore-hub` |
```

- [ ] **Step 3: 验证 Skill 文件格式**

```bash
head -5 ~/.claude/skills/mymore-deploy/SKILL.md
```

Expected: 包含 `---` frontmatter 和 `name: mymore-deploy`

- [ ] **Step 4: 提交（项目仓库记录）**

```bash
git add docs/superpowers/plans/2026-07-23-mymore-skills.md
git commit -m "docs: 添加 mymore-deploy Skill 实施计划"
```

---

### Task 2: 创建 `/mymore-recap` Skill

**Files:**
- Create: `~/.claude/skills/mymore-recap/SKILL.md`

**Interfaces:**
- Consumes: 当前会话上下文、mymore MCP tools
- Produces: 会话总结存储到 mymore

- [ ] **Step 1: 创建 Skill 目录**

```bash
mkdir -p ~/.claude/skills/mymore-recap
```

- [ ] **Step 2: 编写 SKILL.md**

```markdown
---
name: mymore-recap
description: 总结当前会话内容，按 persistent/session/丢弃 三分类展示，用户确认后通过 mymore-mcp 存储。
---

# /mymore-recap

分析当前会话，提取关键信息，按 mymore 三分类体系归类，展示给用户确认后存储。

## 执行流程

### 1. 提取会话信息

回顾当前会话的全部内容，提取以下类型的信息：

| 类型 | 判断标准 | 示例 |
|---|---|---|
| 用户偏好 | 用户明确表示的喜好/倾向 | "我更喜欢暗色模式" |
| 技术决策 | 框架、工具、架构选择 | "选用 pnpm 管理 monorepo" |
| Bug 修复 | 问题根因 + 解决方案 | "null pointer → 添加空值检查" |
| 项目约定 | 命名规范、目录结构约定 | "组件放 src/components" |
| 临时方案 | 临时性、过渡性的选择 | "先用 mock API 开发" |
| 普通讨论 | 无需记住的日常对话 | 闲聊、调试日志等 |

### 2. 按三分类归类

| 分类 | 包含 | 规则 |
|---|---|---|
| **persistent** | 用户偏好、技术决策、Bug 修复、项目约定 | 不可重新推导，跨会话有效 |
| **session** | 临时方案、中间结论 | 仅当前会话参考，后续可归档 |
| **丢弃** | 普通讨论、调试输出、搜索过程 | 能重新推导，无需存储 |

### 3. 展示给用户

使用以下格式展示：

```
📋 本次会话总结
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔷 【persistent】
  ✅ 用户偏好：xxxx
  ✅ 技术决策：xxxx

🔶 【session】
  📌 xxxx

🔹 【丢弃】
  ╳ xxxx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
以上分类是否准确？[确认] [修改] [取消]
```

### 4. 用户确认后存储

用户选择 `确认` 后，遍历 persistent 和 session 条目，逐条调用 `add_memory`：

```json
method: tools/call
params:
  name: "add_memory"
  arguments:
    content: "提取的内容"
    owner_id: "当前用户 ID"
    track: "user"
    category: "persistent 或 session"
    session_id: "当前会话 ID"
```

用户选择 `修改` → 让用户指定每个条目的分类，再存储。

用户选择 `取消` → 不操作。

### 5. 完成后反馈

```
✅ 已存储 3 条 persistent、1 条 session 记忆
🔄 可随时用 search_memory 检索
```

---

## 三分类自检原则

归类不确定时，问自己：

- 这条信息丢了之后能重新推导出来吗？
  - 能 → 「丢弃」
  - 不能 → 是否只在这个会话有用？
    - 是 → 「session」
    - 否 → 「persistent」
```

- [ ] **Step 3: 验证 Skill 文件格式**

```bash
head -5 ~/.claude/skills/mymore-recap/SKILL.md
```

Expected: 包含 `---` frontmatter 和 `name: mymore-recap`

- [ ] **Step 4: 提交实施计划**

```bash
git add docs/superpowers/plans/2026-07-23-mymore-skills.md
git commit -m "feat(skills): 添加 mymore-recap Skill 实施计划"
```

---

### Task 3: 集成测试

- [ ] **Step 1: 验证 skill 被 Claude Code 加载**

```bash
# 查看 skill 目录
ls ~/.claude/skills/mymore-deploy/ ~/.claude/skills/mymore-recap/
```

Expected: 两个目录各包含 `SKILL.md`

- [ ] **Step 2: 触发 `/mymore-deploy`**

在对话中输入 `/mymore-deploy`
Expected: 引导流程正常启动

- [ ] **Step 3: 触发 `/mymore-recap`**

在对话中输入 `/mymore-recap`
Expected: 显示会话摘要和三分类列表
