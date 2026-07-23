#!/usr/bin/env python3
"""
mymore-summary — Stop Hook

在会话结束时触发，汇总本次会话的关键信息并归档过期记忆。

环境变量:
  CLAUDE_SESSION_ID — 当前会话 ID（由 Claude Code 注入）
  MYMORE_ROOT       — 记忆存储根目录（默认 ~/.mymore）
"""

import json
import os
import subprocess
import time
from pathlib import Path


def call_mymore(payload: dict) -> None:
    """通过 docker compose run 调用 mymore MCP 工具。"""
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    json_input = json.dumps(payload, ensure_ascii=False) + "\n"

    try:
        subprocess.run(
            ["docker", "compose", "run", "--rm", "-T", "mymore-mcp"],
            input=json_input,
            capture_output=True,
            text=True,
            cwd=str(project_root),
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        pass
    except Exception:
        pass


def main():
    session_id = os.environ.get("CLAUDE_SESSION_ID", "unknown")
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # 1. 记录会话结束摘要
    summary = f"会话结束于 {timestamp}\n会话 ID: {session_id}"

    add_payload = {
        "jsonrpc": "2.0",
        "id": f"stop-add-{int(time.time())}",
        "method": "tools/call",
        "params": {
            "name": "add_memory",
            "arguments": {
                "content": summary,
                "owner_id": "dante926",
                "category": "session",
                "track": "user",
            },
        },
    }
    call_mymore(add_payload)

    # 2. 运行 consolidate 归档过期记忆
    con_payload = {
        "jsonrpc": "2.0",
        "id": f"stop-con-{int(time.time())}",
        "method": "tools/call",
        "params": {
            "name": "consolidate",
            "arguments": {
                "owner_id": "dante926",
                "days": 7,
                "dry_run": False,
            },
        },
    }
    call_mymore(con_payload)


if __name__ == "__main__":
    main()
