# mymore — 设计工作稿合集

> 本文档是 `build/` 目录下所有设计稿的合集，保留全部原始内容与设计意图。
> 文档涵盖三分类定义、7 步架构决策树、Python 原型参考实现、验证体系。

---

## 一、三分类定义与工作表

### 核心原则

在存储任何信息之前，先判断它属于哪一类：

- **丢弃** = 能重新推导的数据（搜索结果、临时调试输出、一次性文件读取）
- **缓存** = 短期价值高、跟着 session（会话）走的数据（最近 N 轮对话、中间工具结果）
- **持久化存储** = 不可重新推导的、丢弃后就消失的数据（用户偏好、Bug 修复根因、技术决策）

### 分类对照表

| 信息类型 | 丢弃 | 缓存 | 持久化存储 |
|---|---|---|---|
| 当前对话（最近 N 轮） | | ✅ 注入上下文 | |
| 搜索结果 / web fetch 结果 | ✅ 不存 | | |
| 今天做了什么（每日日志） | | | ✅ FTS5 索引 |
| 项目用哪个框架 | | | ✅ 核心规则 |
| 上次 bug 修复的 root cause | | | ✅ FTS5 + 时间戳 |
| 临时调试输出 | ✅ 不存 | | |
| session 中间的工具结果 | | ✅ 跟着 session | |
| 用户偏好（称呼、风格） | | | ✅ Frozen Snapshot 前缀区 |
| 已废弃的配置参数 | | | ✅ 存但标记 expired |
| 一次性的文件读取内容 | ✅ 不存 | | |
| "当前日期"等动态信息 | | ✅ 不破坏前缀 | |

### 自检原则

- **"丢弃"列**里，有没有丢了就无法恢复的数据？→ 移到"持久化存储"
- **"持久化存储"列**里，有没有能重新推导的数据？→ 移到"可丢弃"
- **"缓存"列**里，有没有超过 session 生命周期的数据？→ 移到"持久化存储"

---

## 二、7 步架构决策树

```
Agent 启用 MCP 时
│
├─ [Step 1] 先分类 → 丢弃/缓存/持久化存储
│  跳过后果：MEMORY.md 从 200 行涨到 800 行，关键信息被淹没
│
├─ [Step 2] 选存储 → 上 SQLite FTS5，不上向量库
│  跳过后果：装了向量库但 90% 查询不需要语义搜索，多花运维成本
│
├─ [Step 3] 加时效 → 每条记忆 created_at + valid_until + superseded_by
│  跳过后果：3 个月前的错误配置参数仍然被检索到，制造回归 Bug
│
├─ [Step 4] 对齐缓存 → Frozen Snapshot：稳定前置，动态后置
│  跳过后果：API 成本高出 25-75%，Prefix Cache 从未命中
│
├─ [Step 5] 加归纳 → 每日 Auto-Dream：去重、冲突检测、时效淘汰
│  跳过后果：搜索噪音——5 条"渲染崩溃"记录来自不同期，Agent 合成错误答案
│
├─ [Step 6] 按需升配 → 模糊查询用向量库、时序管理用知识图谱
│  跳过后果：不跳过也没损失——但前置条件不完备就上是更精致的垃圾场
│
└─ [Step 7] 验证 → 3 个指标 + 5 个测试用例
    跳过后果：不知道系统在变好还是变坏，盲目迭代
```

### Step 1：分类优先

| 决策项 | 规则 |
|---|---|
| 能重新推导的吗？ | → 该扔 |
| 短期高价值，session 结束就过期？ | → 该缓存 |
| 不可推导，丢了就没了？ | → 该存 |

**重新分类触发钩子**：每季度一次，或在项目框架变更 / Agent 工具集增减 / 发现某类信息持续未被检索时。

### Step 2：存储选型 — FTS5 vs 向量库

| 查询类型 | 存储选择 | 理由 |
|---|---|---|
| "上次那个 X 怎么修的？" | FTS5 | 精确关键词 |
| "session 超时报错是什么？" | FTS5 | 精确关键词 |
| "像上次那样的问题" | 向量库 | 模糊语义 |
| "最近有什么趋势？" | 向量库 | 发现型查询 |
| "这个决策现在还成立吗？" | 知识图谱 | 时效判断 |

**消耗最小化原则**：FTS5 廉价宽召回 → LLM 昂贵精排。解耦搜索和理解。

**升配触发条件**：
- 搜索中模糊类查询占比 > 30%
- FTS5 Top-5 召回率连续 3 天 < 80%
- 跨话题语义发现成为日常需求

### Step 3：时效系统

```
每条记忆 ├─ created_at     → 什么时候产生的
        ├─ valid_until    → 什么时候到期（NULL = 永不过期）
        └─ superseded_by  → 被哪条新记忆替代（NULL = 仍是权威）
```

| 字段 | 何时设置 | 示例 |
|---|---|---|
| `created_at` | 写入时自动 | `2026-06-06T19:30` |
| `valid_until` | API 变更、框架切换、决策过期 | `2026-09-06`（3 个月后复核） |
| `superseded_by` | 新的同类记录写入时 | 新记录 ID=42，旧记录 `superseded_by=42` |

被替代的记录标记 superseded，而不是丢弃。支持"当时 vs 现在"的溯源查询。

### Step 4：Frozen Snapshot — Prefix Cache 对齐

| System Prompt 区域 | 放什么 | 变不变 |
|---|---|---|
| 头部冻结区（前 800 token） | 角色定义、核心规则、记忆精华 | 不变（整个 session） |
| 尾部动态区（末尾） | 当前任务、临时约束、用户刚说的需求 | 每次请求可能变 |

**两个立刻可用的修复**：
1. System Prompt 拆两段：头部冻结 + 尾部动态
2. 动态信息放在整个 Prompt 的最末尾

**检查方法**：Cache Read Tokens ÷ Total Input Tokens > 80% 才算合格。低于 60% = 你正在烧钱。

### Step 5：归纳层 — Auto-Dream

| 操作 | 频率 | 做什么 |
|---|---|---|
| 去重 | 每日 | 多条记录说同一件事 → 合并 |
| 冲突检测 | 每日 | 互斥信息 → 保留最新，标记旧 superseded |
| 时效淘汰 | 每日 | 30 天未访问的"该存"记录 → 降级归档 |
| 精华提炼 | 每日 | 值得写入核心规则的决策、教训 |

**触发时机**：session 结束时（低频场景）/ 每日凌晨 cron（高频场景）/ 任意时刻手动 consolidate。

**不做的代价**：搜索噪音，相似片段互相干扰，Agent 合成错误答案。

### Step 6：升配决策 — 向量库 / 知识图谱

| 开哪个 | 触发条件 | 放什么 |
|---|---|---|
| 向量库（pgvector） | 模糊查询 > 30% | 跨话题语义发现 |
| 知识图谱（Graphiti） | 事实频繁变更 | 因果关系 + 时序 |

**前置条件**：Step 1-5 全部跑通且验证通过。

**不要做的事**：
- 前置条件不完备就上向量库 → 更精致的垃圾场
- 把知识图谱当全量关系模型 → 只做事实时序管理

### Step 7：验证 — 3 个指标 + 5 个用例

| 指标 | 目标值 | 怎么测 |
|---|---|---|
| 指令遵从率 | 记忆注入后不下降 | system prompt 嵌入隐蔽规则，前后对比 |
| 检索 Top-1 命中率 | > 80% | 20 个已知答案的问题 |
| Cache 命中率 | > 80% | API 报表 cache_read / total_input |

**5 个测试用例**：
- "上次 bug 怎么修的？" → 精确召回
- "项目现在用什么框架？" → 时效性
- "删除 /tmp 临时文件" → 信噪比（记忆不应干扰简单操作）
- "3 个月前决策还适用吗？" → 时间旅行
- 100 次请求后 Cache 命中率 → 经济账

---

## 三、Python 原型实现

> 设计阶段的参考实现（Python 3），对应 `@mymore/core` 的 TypeScript 版本。
> 这是一个最小 Agent 记忆系统，实现了三分类 → SQLite FTS5 → 时间戳 → 归纳 → 冻结快照的完整链路。

```python
#!/usr/bin/env python3
"""
agent_memory.py — 最小 Agent 记忆系统
======================================
造物车间 #01 · 7 步设计 Agent 记忆系统

实现了从零到一的多层记忆：三分类 → SQLite FTS5 → 时间戳 → 归纳 → 冻结快照

用法:
    python3 agent_memory.py init          # 初始化数据库
    python3 agent_memory.py add "内容"    # 添加记忆
    python3 agent_memory.py search "关键词" # 搜索记忆
    python3 agent_memory.py consolidate   # 运行归纳
    python3 agent_memory.py stats         # 查看统计
    python3 agent_memory.py test          # 运行自测

依赖：零额外依赖——Python 3 标准库就够了。需要 SQLite 3.35+。
"""

import sqlite3
import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path


# ═══════════════════════════════════════════════════════════════
# 配置区
# ═══════════════════════════════════════════════════════════════

CONFIG = {
    "db_path": "./agent_memory.db",       # 记忆数据库路径
    "log_dir": "./logs/",                 # 日志目录
    "consolidation_days": 7,              # 归纳时读取最近 N 天的日志
    "stale_days": 30,                     # 超过 N 天未引用降级为归档
    "memory_md": "./MEMORY.md",           # 核心记忆文件
}


# ═══════════════════════════════════════════════════════════════
# Step 2: SQLite + FTS5
# ═══════════════════════════════════════════════════════════════

def init_db(db_path: str) -> None:
    """创建数据库表：FTS5 全文索引 + 元数据表。"""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # FTS5 全文索引表 — trigram 分词器支持 CJK
    cur.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
            content,
            tokenize='trigram'
        )
    """)

    # 元数据表
    cur.execute("""
        CREATE TABLE IF NOT EXISTS memory_meta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fts_rowid INTEGER,
            category TEXT NOT NULL DEFAULT 'persistent',
            frozen BOOLEAN NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            valid_until TEXT,
            superseded_by INTEGER,
            last_accessed TEXT,
            access_count INTEGER DEFAULT 0,
            FOREIGN KEY (fts_rowid) REFERENCES memory_fts(rowid),
            FOREIGN KEY (superseded_by) REFERENCES memory_meta(id)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_memory_category ON memory_meta(category)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_memory_created ON memory_meta(created_at)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_memory_valid ON memory_meta(valid_until)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_memory_frozen ON memory_meta(frozen)")

    conn.commit()
    conn.close()
    print(f"✅ 记忆数据库初始化完成: {db_path}")


# ═══════════════════════════════════════════════════════════════
# Step 1 & 2: 三分类 + 写入
# ═══════════════════════════════════════════════════════════════

def classify_memory(content: str) -> str:
    """Step 1: 三分类记忆。基于关键词的模式匹配实现。"""
    content_lower = content.lower()

    persistent_keywords = [
        "偏好", "prefer", "修复", "fix", "bug", "crash", "决策",
        "选择", "配置", "config", "规则", "rule", "总是", "always",
        "架构", "architecture", "踩坑", "教训",
    ]
    session_keywords = [
        "临时", "temp", "中间", "intermediate", "单次", "测试",
        "output:", "result:", "响应:", "response:",
    ]

    for kw in persistent_keywords:
        if kw in content_lower:
            return "persistent"
    for kw in session_keywords:
        if kw in content_lower:
            return "session"
    return "persistent"  # 默认存下来


def add_memory(db_path: str, content: str, category: str | None = None,
               valid_until: str | None = None) -> int:
    """添加一条记忆。category 为 None 时自动三分类。"""
    if category is None:
        category = classify_memory(content)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    now = datetime.now().isoformat()
    cur.execute("INSERT INTO memory_fts (content) VALUES (?)", (content,))
    fts_rowid = cur.lastrowid
    cur.execute(
        """INSERT INTO memory_meta (fts_rowid, category, created_at, valid_until)
           VALUES (?, ?, ?, ?)""",
        (fts_rowid, category, now, valid_until or None),
    )
    conn.commit()
    conn.close()
    print(f"✅ 已添加记忆 [{category}] (ID={fts_rowid}): {content[:60]}...")
    return fts_rowid


# ═══════════════════════════════════════════════════════════════
# Step 3: 时间戳 & Step 4: Frozen Snapshot
# ═══════════════════════════════════════════════════════════════

def search_memory(db_path: str, query: str, limit: int = 5,
                  include_expired: bool = False,
                  prefer_frozen: bool = True) -> list[dict]:
    """搜索记忆 — FTS5 trigram 宽召回 + 元数据过滤 + LIKE 降级。
    
    短 CJK 查询（1-2 字）自动降级到 LIKE，因为 trigram 最少需要 3 字符。
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    now = datetime.now().isoformat()

    use_like = len(query) <= 2 and all("一" <= c <= "鿿" for c in query)
    order_clause = "m.frozen DESC, rank" if prefer_frozen else "rank"
    valid_clause = (
        "AND (m.valid_until IS NULL OR m.valid_until > ?)"
        if not include_expired else ""
    )

    if use_like:
        sql = f"""SELECT m.id, f.content, m.category, m.created_at,
                         m.valid_until, m.access_count, m.frozen
                  FROM memory_fts f
                  JOIN memory_meta m ON f.rowid = m.fts_rowid
                  WHERE f.content LIKE ? {valid_clause}
                  ORDER BY {order_clause} LIMIT ?"""
        params = (f"%{query}%",)
    else:
        sql = f"""SELECT m.id, f.content, m.category, m.created_at,
                         m.valid_until, m.access_count, m.frozen
                  FROM memory_fts f
                  JOIN memory_meta m ON f.rowid = m.fts_rowid
                  WHERE memory_fts MATCH ? {valid_clause}
                  ORDER BY {order_clause} LIMIT ?"""
        params = (query,)

    if include_expired:
        cur.execute(sql, (*params, limit))
    else:
        cur.execute(sql, (*params, now, limit))

    results = [dict(row) for row in cur.fetchall()]
    for r in results:
        cur.execute("""UPDATE memory_meta SET last_accessed = ?,
                       access_count = access_count + 1 WHERE id = ?""",
                    (now, r["id"]))

    conn.commit()
    conn.close()
    return results


def freeze_stable_memories(db_path: str, inactivity_days: int = 3) -> int:
    """冻结稳定记忆 — 3 天内未变动的 persistent 记忆标记 frozen。"""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cutoff = (datetime.now() - timedelta(days=inactivity_days)).isoformat()
    cur.execute("""UPDATE memory_meta SET frozen = 1
                   WHERE category = 'persistent' AND frozen = 0
                     AND superseded_by IS NULL AND created_at < ?""", (cutoff,))
    count = cur.rowcount
    conn.commit()
    conn.close()
    print(f"🧊 冻结了 {count} 条稳定记忆")
    return count


def get_frozen_snapshot(db_path: str, max_entries: int = 50) -> list[dict]:
    """获取冻结记忆快照，用于注入 System Prompt 的 Stable Prefix。"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""SELECT m.id, f.content, m.category, m.created_at, m.access_count
                   FROM memory_fts f JOIN memory_meta m ON f.rowid = m.fts_rowid
                   WHERE m.frozen = 1 AND m.superseded_by IS NULL
                   ORDER BY m.access_count DESC, m.created_at DESC LIMIT ?""",
                (max_entries,))
    results = [dict(row) for row in cur.fetchall()]
    conn.close()
    return results


# ═══════════════════════════════════════════════════════════════
# Step 5: 归纳层
# ═══════════════════════════════════════════════════════════════

def mark_superseded(db_path: str, old_id: int, new_id: int) -> None:
    """旧记忆被新记忆替代。标记后不再参与主动搜索。"""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    now = datetime.now().isoformat()
    cur.execute("""UPDATE memory_meta SET superseded_by = ?, valid_until = ?, frozen = 0
                   WHERE id = ?""", (new_id, now, old_id))
    conn.commit()
    conn.close()


def consolidate(db_path: str, log_dir: str, days: int) -> list[dict]:
    """Step 5: 读取最近 N 天日志 → 去重 → 冲突检测 → 淘汰过期。
    
    真正的去重和冲突检测需要 LLM 完成。这里提供完整的框架：
    1. 日志读取   2. 条目提取   3. LLM 调用点   4. 过期淘汰
    """
    log_path = Path(log_dir)
    if not log_path.exists():
        print(f"⚠️ 日志目录不存在: {log_dir}")
        return []

    cutoff = datetime.now() - timedelta(days=days)
    recent_logs = []
    for f in sorted(log_path.glob("*.md"), reverse=True):
        try:
            log_date = datetime.strptime(f.stem, "%Y-%m-%d")
            if log_date >= cutoff:
                recent_logs.append({"date": f.stem, "path": str(f)})
        except ValueError:
            continue

    entries: list[dict] = []
    for log in recent_logs:
        with open(log["path"]) as f:
            content = f.read()
        sections = [s.strip() for s in content.split("\n## ") if s.strip()]
        for section in sections:
            entries.append({"date": log["date"], "content": section})

    # LLM 调用点（注释状态 —— 生产环境替换为真实 LLM）
    # prompt = f"... 以下是 {days} 天内的 Agent 工作日志..."
    # result = call_llm(prompt)

    # 机械性清理过期记忆
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    stale_cutoff = datetime.now().isoformat()
    cur.execute("""UPDATE memory_meta SET category = 'archived', frozen = 0
                   WHERE category = 'persistent' AND valid_until IS NOT NULL
                     AND valid_until < ? AND superseded_by IS NULL""",
                (stale_cutoff,))
    conn.commit()
    conn.close()
    print(f"🗄️ 归档了 {cur.rowcount} 条过期记忆")
    return entries


# ═══════════════════════════════════════════════════════════════
# 统计 & 自测
# ═══════════════════════════════════════════════════════════════

def stats(db_path: str) -> dict:
    """数据库统计信息。"""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT category, COUNT(*) FROM memory_meta GROUP BY category")
    by_category = dict(cur.fetchall())
    cur.execute("SELECT COUNT(*) FROM memory_meta WHERE superseded_by IS NOT NULL")
    superseded = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM memory_meta WHERE frozen = 1")
    frozen = cur.fetchone()[0]
    conn.close()
    print("═══════════════════════════════════")
    print("📊 记忆系统统计")
    for cat, count in sorted(by_category.items()):
        print(f"  {cat}: {count} 条")
    print(f"  已过期/被替代: {superseded} 条")
    print(f"  已冻结: {frozen} 条")
    print("═══════════════════════════════════")
    return {"by_category": by_category, "superseded": superseded, "frozen": frozen}


def run_tests() -> None:
    """运行自测，验证所有核心功能。"""
    import tempfile
    test_db = Path(tempfile.gettempdir()) / "agent_memory_test.db"
    test_db.unlink(missing_ok=True)

    print("Test 1/6: 数据库初始化...")
    init_db(str(test_db))
    assert test_db.exists()
    print("  ✅ PASS\n")

    print("Test 2/6: 三分类记忆...")
    assert classify_memory("用户偏好暗色模式") == "persistent"
    assert classify_memory("临时中间结果xyz") == "session"
    assert classify_memory("修复null pointer崩溃bug") == "persistent"
    print("  ✅ PASS\n")

    print("Test 3/6: 添加和搜索...")
    add_memory(str(test_db), "用户偏好暗色模式，所有界面用暗色主题", "persistent")
    add_memory(str(test_db), "修复auth模块null_pointer崩溃，添加了空值检查", "persistent")
    add_memory(str(test_db), "临时调试日志：output error_code_500", "session")
    results = search_memory(str(test_db), "暗色模式")
    assert len(results) > 0
    assert "暗色" in results[0]["content"]
    print("  ✅ PASS\n")

    print("Test 4/6: 冻结稳定记忆...")
    freeze_stable_memories(str(test_db), inactivity_days=0)
    snapshot = get_frozen_snapshot(str(test_db))
    assert len(snapshot) > 0
    print(f"  ✅ PASS (冻结了 {len(snapshot)} 条)\n")

    print("Test 5/6: 替代过时记忆...")
    results = search_memory(str(test_db), "暗色模式")
    old_id = results[0]["id"]
    new_id = add_memory(str(test_db), "用户改成亮色模式偏好", "persistent")
    mark_superseded(str(test_db), old_id, new_id)
    print("  ✅ PASS\n")

    print("Test 6/6: 统计...")
    result = stats(str(test_db))
    assert "persistent" in result["by_category"]
    print("  ✅ PASS\n")

    print("🎉 全部 6 项测试通过！")
    test_db.unlink(missing_ok=True)


if __name__ == "__main__":
    db = CONFIG["db_path"]
    if len(sys.argv) < 2:
        print("用法: python3 agent_memory.py <command> [args]")
        print("命令: init, add, search, freeze, frozen-snapshot, supersede, consolidate, stats, test")
        sys.exit(0)

    cmd = sys.argv[1]
    commands = {
        "init": lambda: init_db(db),
        "add": lambda: add_memory(db, sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None),
        "search": lambda: print(json.dumps(search_memory(db, sys.argv[2]), ensure_ascii=False, indent=2)),
        "freeze": lambda: freeze_stable_memories(db),
        "frozen-snapshot": lambda: print(json.dumps(get_frozen_snapshot(db), ensure_ascii=False, indent=2)),
        "supersede": lambda: mark_superseded(db, int(sys.argv[2]), int(sys.argv[3])),
        "consolidate": lambda: consolidate(db, CONFIG["log_dir"], CONFIG["consolidation_days"]),
        "stats": lambda: print(json.dumps(stats(db), ensure_ascii=False, indent=2)),
        "test": run_tests,
    }
    try:
        commands[cmd]()
    except Exception as e:
        print(f"❌ 错误: {e}")
        sys.exit(1)
```

---

## 四、验证体系

### 测试用例

#### 测试 0：基线（不加记忆系统时）

记录 Agent 在完全不用记忆系统时的表现，作为对比基线。

1. 关掉所有记忆注入
2. 让 Agent 回答 20 个它理论上能从记忆里回答的问题
3. 记录 Top-1 命中率和平均响应时间

#### 测试 1：精确召回测试（对应 Step 2 — SQLite FTS5）

**问题**："上次那个 [具体 bug 名称] 是怎么修的？"

**准备**：写入一条明确的 bug 修复记录。**通过标准**：Top-1 结果内容 100% 匹配，返回时间 < 500ms。

**未通过 → 检查**：FTS5 索引是否正确建立？关键词是否一致？是否被 valid_until 提前过滤？

#### 测试 2：时效性测试（对应 Step 3 — 时效系统）

**问题**："这个项目现在用什么框架？"

**准备**：3 个月前的"Framework A" + 最近 1 周的"Framework B"，旧记忆设 valid_until。

**通过标准**：主回答是 Framework B，没有引用 Framework A 作为当前答案。

#### 测试 3：信噪比测试（对应 Step 4 — Frozen Snapshot + 注入量控制）

**操作**："删除 /tmp 下的临时文件。"

**通过标准**：正确删除目标文件，没有多删，没有输出记忆相关内容。

**未通过 → 检查**：记忆注入量是否 > 2000 token？Frozen Snapshot 是否被淹没？

#### 测试 4：时间旅行测试（对应 Step 5 — 归纳层）

**问题**："我 3 个月前做的那个决策现在还适用吗？"

**准备**：写入一条 3 个月前"选用方案 X"的决策 + 方案 Y 已支持功能 Z 的上下文。

**通过标准**：引用了原始决策和当时约束，指出约束已变化，给出基于当前情况的更新判断。

#### 测试 5：经济账测试 — Prefix Cache 命中率（对应 Step 4 + Step 7）

**步骤**：连续发送 100 次请求 → 计算 Cache Read Tokens ÷ Total Input Tokens。

**通过标准**：缓存命中率 > 80%，单次请求 Token 消耗无明显波动。

| 命中率 | 建议 |
|---|---|
| < 60% | 检查 system prompt 头部是否有动态内容 |
| 60-80% | 系统可用，仍有优化空间 |
| > 80% | 合格 |

### 全量自检清单

- [ ] 测试 1（精确召回）：Top-1 命中，< 500ms
- [ ] 测试 2（时效性）：正确答案是最新记忆
- [ ] 测试 3（信噪比）：简单操作不被记忆干扰
- [ ] 测试 4（时间旅行）：能同时看当时和现在
- [ ] 测试 5（经济账）：Cache 命中率 > 80%
- [ ] 基线对比：Top-1 命中率相比基线提升了多少？

### 自动化压测脚本框架

```python
"""auto_test.py — 自动化压测"""
from agent_memory import search_memory, add_memory, CONFIG

TEST_CASES = [
    {"name": "精确召回", "query": "渲染崩溃 怎么修", "check": lambda r: r and r[0]['id'] == 42},
    {"name": "时效性",   "query": "项目 现在 什么 框架", "check": lambda r: any("Framework B" in x['content'] for x in r)},
    {"name": "信噪比",   "query": "删除 /tmp 临时文件", "check": lambda r: len(r) <= 2},
]

def run_all():
    for tc in TEST_CASES:
        results = search_memory(CONFIG["db_path"], tc["query"])
        ok = tc["check"](results)
        print(f"{'✅' if ok else '❌'} {tc['name']}")

if __name__ == "__main__":
    run_all()
```

---

## 五、渐进式升配路径

| Phase | 新增 | 触发条件 |
|---|---|---|
| **Phase 1** | Markdown + FTS5 + Frozen Snapshot + Consolidation | ✅ 初始可用 |
| **Phase 2** | 为 mymore 装配 Hook，Agent 自动存储和读取记忆 | Agent 需自动管理记忆 |
| Phase 3 | 文件 watcher（chokidar）实时检测 md 编辑 | md 编辑场景变多 |
| Phase 4 | Episode → AtomicFact 提取层 | 需要精细语义匹配 |
| Phase 5 | 向量库（LanceDB / pgvector） | 模糊查询 > 30% |
| Phase 6 | 聚类反射（deprecated_by 自动合并） | 记忆量膨胀到需自动整理 |
| **Phase N** | mymore-ui（WebUI 监控） | 需要可视化浏览 |

每个 Phase 的数据结构已在 Phase 1 中预留 —— `track` / `session_id` / `parent_id` / `superseded_by` / `frozen` 字段从一开始就存在，升配不需要改表。
