# mymore 辅助 Skill 设计

> 2026-07-23
> 两个 Skill：`deploy-mymore`（克隆构建指引）、`recap`（会话总结与记忆存储）

---

## Skill 1：`/mymore-deploy`

### 定位

mymore 项目专属 Skill，当用户想"使用 mymore"或"部署 mymore"时触发。引导用户完成：
1. `git clone` 仓库
2. 构建 Docker 镜像
3. 启动服务
4. 验证服务正常
5. 配置 Claude Desktop / Claude Code 连接

### 触发方式

- 自动匹配：用户输入包含"部署""启动""安装""试试 mymore""clone"等关键词时自动触发
- 手动：`/mymore-deploy`

### 工作流程

```
Step 1: 环境检查
  ├─ git 是否已安装？→ 否 → 提示安装方法
  ├─ Docker 是否已安装运行？→ 否 → 提示安装/启动
  └─ 通过 → 下一步

Step 2: 克隆仓库
  ├─ 执行 git clone https://github.com/... mymore
  ├─ 成功 → 进入目录
  └─ 失败 → 检查：网络问题？权限问题？目录已存在？

Step 3: 构建镜像
  ├─ 执行 docker compose build
  ├─ 成功 → 下一步
  └─ 失败 → 检查：Docker 运行中？端口冲突？磁盘空间？

Step 4: 启动服务
  ├─ 执行 docker compose up -d
  ├─ 成功 → 验证状态
  └─ 失败 → 检查：端口被占？查看 docker logs

Step 5: 验证
  ├─ curl mymore-mcp: tools/list → 4 个工具可用？
  ├─ curl mymore-hub: health → ok？
  └─ 都通过 → ✅ 部署成功

Step 6: 配置客户端
  ├─ 展示 Claude Desktop 配置代码块
  └─ 询问用户是否已完成配置
```

### 错误排查

每个步骤都有明确的失败检查和用户提示：

| 步骤 | 典型失败 | 排查提示 |
|---|---|---|
| 环境检查 | git 未安装 | 给出对应系统的安装命令 |
| 环境检查 | Docker 未运行 | 提示启动 Docker Desktop |
| 克隆 | 目录已存在 | 询问是否覆盖或更新 |
| 构建 | 镜像构建失败 | 查看 Dockerfile 和 build log |
| 启动 | 端口 3456 占用 | `lsof -i :3456` 查看占用进程 |
| 验证 | MCP 工具未返回 | 检查容器日志 `docker logs mymore-mcp` |

---

## Skill 2：`/mymore-recap`

### 定位

手动触发型 Skill，在对话结束时由用户输入 `/mymore-recap` 调用。分析当前会话内容，按 mymore 的三分类体系归类，显示给用户确认后存储。

### 触发方式

- 手动：`/mymore-recap`

### 工作流程

```
用户输入 /recap
  │
  ├─ 1. 扫描当前会话记录
  │   └─ 提取关键信息点（决策、偏好、修复、约定等）
  │
  ├─ 2. 按三分类归类
  │   ├─ persistent ── 用户偏好、技术决策、Bug 修复
  │   ├─ session   ── 临时结论、中间选择
  │   └─ 丢弃      ── 普通讨论、调试输出
  │
  ├─ 3. 展示给用户
  │   └─ 表格格式，含：内容、分类、轨道、说明
  │
  ├─ 4. 询问确认
  │   ├─ 用户确认 → 调用 add_memory 逐条存储
  │   ├─ 用户修改 → 按用户调整后存储
  │   └─ 用户取消 → 不存储
  │
  └─ 5. 完成后反馈 ✅
```

### 展示格式

```
📋 本次会话总结
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【persistent】— 将长期保存
  ✅ 用户偏好：使用暗色模式
  ✅ 技术决策：采用 pnpm workspace 管理 monorepo
  ✅ Bug 修复：auth null pointer → 添加空值检查

【session】— 仅本次会话参考
  📌 临时方案：先用 mock API 开发前端

【丢弃】— 不存储
  ╳ 普通讨论：关于 UI 颜色方案的闲聊
  ╳ 调试日志：npm install 报错记录

以上分类是否准确？[确认/修改/取消]
```

### 数据字段

每条记忆存储时的字段映射：

| 字段 | 值 |
|---|---|
| `content` | 提取的内容摘要 |
| `owner_id` | `dante926`（当前用户） |
| `track` | `user`（暂定） |
| `category` | 用户确认的分类 |
| `session_id` | 当前会话 ID |

---

## 文件结构

```
.claude/skills/
├── mymore-deploy/
│   └── SKILL.md       # 部署指引 Skill
└── mymore-recap/
    └── SKILL.md        # 会话总结 Skill
```

两个 Skill 都放在 `~/.claude/skills/`（用户级），不属于 mymore 项目仓库。

---

## 验证标准

### deploy-mymore
1. ✅ 全新环境能完整走通 clone → build → up → verify
2. ✅ 某一步失败时给出明确错误原因和修复指引
3. ✅ 网络超时、端口冲突、Docker 未运行等常见问题有对应处理

### `/mymore-recap`
1. ✅ `/mymore-recap` 正确提取当前会话的关键信息
2. ✅ 三分类归类合理，符合 mymore 的分类原则
3. ✅ 用户确认后数据正确写入 mymore
4. ✅ 用户取消则不写入
5. ✅ 用户可手动调整分类后再存储
