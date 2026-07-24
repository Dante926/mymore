#!/usr/bin/env python3
"""
mymore-summary — Stop Hook

不在会话结束时存储无用摘要——有价值的记忆已在对话过程中
由 UserPromptSubmit Hook 自动存储。
Stop Hook 仅做 consolidate 归档过期记忆。
"""

import json
import subprocess
import time
from pathlib import Path


def main():
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    payload = {
        "jsonrpc": "2.0",
        "id": f"stop-con-{int(time.time())}",
        "method": "tools/call",
        "params": {
            "name": "consolidate",
            "arguments": {"owner_id": "dante926", "days": 7, "dry_run": False},
        },
    }

    try:
        subprocess.run(
            ["docker", "compose", "run", "--rm", "-T", "mymore-mcp"],
            input=json.dumps(payload, ensure_ascii=False) + "\n",
            capture_output=True,
            text=True,
            cwd=str(project_root),
            timeout=30,
        )
    except Exception:
        pass


if __name__ == "__main__":
    main()
