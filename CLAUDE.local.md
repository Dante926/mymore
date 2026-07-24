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

本项目已配置 Claude Code Hooks：
- **UserPromptSubmit Hook**：自动存储用户偏好、技术决策、Bug 修复等关键信息到 mymore（persistent 分类）
- **Stop Hook**：会话结束时自动存储摘要（session 分类）+ 运行 consolidate

无需手动调用 `add_memory`。需要记忆时使用 `search_memory` 即可。
