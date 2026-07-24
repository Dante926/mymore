#!/usr/bin/env python3
"""
mymore-store — UserPromptSubmit Hook

在用户提交消息后触发，自动存储关键信息到 mymore。
仅在匹配关键词时存储，控制信噪比。

环境变量:
  MYMORE_ROOT     — 记忆存储根目录（默认 ~/.mymore）
  CLAUDE_USER_PROMPT — 用户消息内容（由 Claude Code Hook 机制注入）
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

# ── 读取用户输入 ──────────────────────────────────────────

prompt = os.environ.get("CLAUDE_USER_PROMPT", "")
if not prompt and not sys.stdin.isatty():
    prompt = sys.stdin.read().strip()
if not prompt:
    sys.exit(0)

# ── 关键词匹配 —— 判断是否值得存储 ─────────────────────────

persistent_patterns = [
    "偏好", "喜欢", "改为", "改用", "使用", "选择",
    "决策", "修复", "崩溃", "bug", "fix", "配置",
    "约定", "规范", "架构", "采用", "替换", "迁移",
    "prefer", "preference", "改用", "换成",
]

def should_store(text: str) -> bool:
    lower = text.lower()
    return any(p in lower for p in persistent_patterns)

if not should_store(prompt):
    sys.exit(0)

# ── 截取关键内容 ──────────────────────────────────────────

content = prompt[:500].strip()
if len(content) < 5:
    sys.exit(0)

# ── JSON-RPC 调用 add_memory ──────────────────────────────

payload = {
    "jsonrpc": "2.0",
    "id": f"hook-{os.getpid()}",
    "method": "tools/call",
    "params": {
        "name": "add_memory",
        "arguments": {
            "content": content,
            "owner_id": "dante926",
            "category": "persistent",
            "track": "user",
        },
    },
}

project_root = Path(__file__).resolve().parent.parent.parent.parent
json_input = json.dumps(payload, ensure_ascii=False)

try:
    subprocess.run(
        ["docker", "compose", "run", "--rm", "-T", "mymore-mcp"],
        input=json_input + "\n",
        capture_output=True,
        text=True,
        cwd=str(project_root),
        timeout=30,
    )
except subprocess.TimeoutExpired:
    pass  # 超时不阻塞用户
except Exception:
    pass  # 静默失败，不干扰用户操作
