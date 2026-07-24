# Memory Hub 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 mymore 构建 Web 仪表盘 Memory Hub，通过浏览器可视化浏览记忆数据。

**Architecture:** 独立 Node.js HTTP 服务器直连 SQLite，提供 REST API + 静态文件。集成到 Docker Compose 中，与 mymore-mcp 并列运行。

**Tech Stack:** Node.js 内置 http 模块，纯原生 HTML/CSS/JS 前端，better-sqlite3

## Global Constraints

- 使用 Node.js 内置 `http` 模块，不引入 Express 等依赖
- 前端使用纯原生 HTML/CSS/JS，零框架
- 端口固定 3456
- Docker 镜像复用现有 `mymore-mcp`，仅通过 `command` 覆盖启动入口
- 所有 API 路径以 `/api/` 开头
- dashboard.html 作为静态文件由 server.js 读取和返回

---

### Task 1: 创建 hub/server.js（HTTP 服务 + SQLite API）

**Files:**
- Create: `apps/mcp-server/src/hub/server.js`

**Interfaces:**
- Consumes: SQLite DB at `~/.mymore/.index/memory.db`
- Produces: HTTP server on :3456 with 6 API endpoints + static file serving

- [ ] **Step 1: 创建目录**

```bash
mkdir -p apps/mcp-server/src/hub
```

- [ ] **Step 2: 编写 server.js**

```javascript
#!/usr/bin/env node
/**
 * mymore Memory Hub — HTTP 仪表盘服务器
 *
 * 直连 SQLite 提供 REST API + 静态文件服务。
 * 端口: MYMORE_HUB_PORT 或 3456
 * 数据库: MYMORE_ROOT/.index/memory.db
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.MYMORE_HUB_PORT || '3456', 10);
const ROOT = process.env.MYMORE_ROOT || path.join(os.homedir(), '.mymore');
const DB_PATH = path.join(ROOT, '.index', 'memory.db');
const HTML_PATH = path.join(__dirname, 'dashboard.html');

// ── 数据库连接 ──────────────────────────────────────────────

let db;
try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = WAL');
} catch (e) {
  console.error(`[hub] 无法打开数据库: ${e.message}`);
  process.exit(1);
}

// 查询辅助函数
function queryAll(sql, params = []) {
  const rows = db.prepare(sql).all(...params);
  return rows;
}

function queryOne(sql, params = []) {
  return db.prepare(sql).get(...params);
}

// ── MIME 类型 ──────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

// ── API 处理器 ─────────────────────────────────────────────

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res, msg, status = 500) {
  sendJson(res, { error: msg }, status);
}

const api = {

  // GET /api/stats — 统计概览
  stats(req, res) {
    const total = queryOne('SELECT COUNT(*) as count FROM memory_meta');
    const byCategory = queryAll('SELECT category, COUNT(*) as count FROM memory_meta GROUP BY category');
    const byTrack = queryAll('SELECT track, COUNT(*) as count FROM memory_meta GROUP BY track');
    const activeDays = queryOne(`
      SELECT COUNT(DISTINCT date(created_at)) as count
      FROM memory_meta
      WHERE created_at > datetime('now', '-6 months')
    `);
    const firstDate = queryOne('SELECT MIN(created_at) as first FROM memory_meta');
    const daysSinceStart = firstDate?.first
      ? Math.max(1, Math.ceil((Date.now() - new Date(firstDate.first).getTime()) / 86400000))
      : 1;

    sendJson(res, {
      totalMemories: total?.count || 0,
      byCategory: Object.fromEntries(byCategory.map(r => [r.category, r.count])),
      byTrack: Object.fromEntries(byTrack.map(r => [r.track, r.count])),
      projects: byTrack.length,
      activeDays: activeDays?.count || 0,
      avgPerDay: ((total?.count || 0) / daysSinceStart).toFixed(1),
    });
  },

  // GET /api/heatmap — 6 个月日活动分布
  heatmap(req, res) {
    const rows = queryAll(`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM memory_meta
      WHERE created_at > datetime('now', '-6 months')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `);
    sendJson(res, rows);
  },

  // GET /api/growth — 近 7 日趋势
  growth(req, res) {
    const rows = queryAll(`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM memory_meta
      WHERE created_at > datetime('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `);
    sendJson(res, rows);
  },

  // GET /api/memories — 记忆列表（分页 + 搜索 + 过滤）
  memories(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const q = url.searchParams.get('q') || '';
    const category = url.searchParams.get('category') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50', 10)));
    const offset = (page - 1) * pageSize;

    let where = 'WHERE m.superseded_by IS NULL';
    const params = [];

    if (category) {
      where += ' AND m.category = ?';
      params.push(category);
    }

    // 全文搜索
    if (q) {
      where += ' AND (f.content MATCH ? OR f.content LIKE ?)';
      params.push(q, `%${q}%`);
    }

    const countSql = `SELECT COUNT(*) as total FROM memory_fts f JOIN memory_meta m ON f.rowid = m.fts_rowid ${where}`;
    const total = queryOne(countSql, params)?.total || 0;

    const dataSql = `
      SELECT m.id, f.content, m.category, m.track, m.created_at,
             m.valid_until, m.superseded_by, m.frozen, m.access_count
      FROM memory_fts f
      JOIN memory_meta m ON f.rowid = m.fts_rowid
      ${where}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const memories = queryAll(dataSql, [...params, pageSize, offset]);

    sendJson(res, {
      memories: memories.map(r => ({
        ...r,
        frozen: !!r.frozen,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  },
};

// ── 路由 ───────────────────────────────────────────────────

function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // API 路由
  if (pathname === '/api/stats') return api.stats(req, res);
  if (pathname === '/api/heatmap') return api.heatmap(req, res);
  if (pathname === '/api/growth') return api.growth(req, res);
  if (pathname === '/api/memories') return api.memories(req, res);

  // 健康检查
  if (pathname === '/health') return sendJson(res, { status: 'ok', uptime: process.uptime() });

  // 静态文件
  if (pathname === '/' || pathname === '/index.html') {
    return serveStatic(res, HTML_PATH, 'text/html; charset=utf-8');
  }

  sendJson(res, { error: 'Not found' }, 404);
}

function serveStatic(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    sendJson(res, { error: 'File not found' }, 404);
  }
}

// ── 启动 ───────────────────────────────────────────────────

const server = http.createServer(route);
server.listen(PORT, () => {
  console.log(`[mymore-hub] http://localhost:${PORT}`);
});

// 优雅退出
process.on('SIGTERM', () => { db?.close(); server.close(); });
process.on('SIGINT', () => { db?.close(); server.close(); process.exit(); });
```

- [ ] **Step 3: 验证 server.js 可启动**

```bash
cd apps/mcp-server && node src/hub/server.js &
sleep 2
curl -s http://localhost:3456/health
kill %1
```

Expected: `{"status":"ok","uptime":...}`

- [ ] **Step 4: 提交**

```bash
git add apps/mcp-server/src/hub/server.js
git commit -m "feat(hub): 添加 Memory Hub HTTP 服务器"
```

---

### Task 2: 创建 hub/dashboard.html（前端仪表盘）

**Files:**
- Create: `apps/mcp-server/src/hub/dashboard.html`

**Interfaces:**
- Consumes: `/api/stats`, `/api/heatmap`, `/api/growth`, `/api/memories`
- Produces: 可视化仪表盘界面

- [ ] **Step 1: 编写 dashboard.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>mymore Memory Hub</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0d1117; color: #c9d1d9; min-height: 100vh;
  }

  /* ── 头部 ── */
  .header {
    position: sticky; top: 0; z-index: 100;
    background: #161b22; border-bottom: 1px solid #30363d;
    padding: 16px 24px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .header h1 { font-size: 20px; color: #f0f6fc; }
  .header .subtitle { font-size: 13px; color: #8b949e; }

  /* ── 统计卡片网格 ── */
  .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
  .stats-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
    margin-bottom: 24px;
  }
  .stat-card {
    background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    padding: 20px; text-align: center;
  }
  .stat-card .value { font-size: 32px; font-weight: 700; color: #f0f6fc; }
  .stat-card .label { font-size: 13px; color: #8b949e; margin-top: 4px; }

  /* ── 图表行 ── */
  .charts-row { display: flex; gap: 24px; margin-bottom: 24px; }
  .chart-box {
    flex: 1; background: #161b22; border: 1px solid #30363d;
    border-radius: 8px; padding: 20px;
  }
  .chart-box h3 { font-size: 14px; color: #8b949e; margin-bottom: 12px; }

  /* 热力图 */
  .heatmap { display: flex; flex-direction: column; gap: 3px; overflow-x: auto; }
  .heatmap-row { display: flex; gap: 3px; }
  .heatmap-cell {
    width: 14px; height: 14px; border-radius: 2px;
    background: #21262d; cursor: pointer; position: relative;
  }
  .heatmap-cell[data-lvl="1"] { background: #0e4429; }
  .heatmap-cell[data-lvl="2"] { background: #006d32; }
  .heatmap-cell[data-lvl="3"] { background: #26a641; }
  .heatmap-cell[data-lvl="4"] { background: #39d353; }
  .heatmap-cell:hover::after {
    content: attr(data-tip); position: absolute; bottom: 120%;
    left: 50%; transform: translateX(-50%);
    background: #30363d; color: #f0f6fc; padding: 4px 8px;
    border-radius: 4px; font-size: 12px; white-space: nowrap; z-index: 10;
  }
  .heatmap-labels { display: flex; gap: 3px; font-size: 10px; color: #8b949e; }
  .heatmap-labels span { width: 14px; text-align: center; }

  /* 柱状图 */
  .bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 100px; }
  .bar {
    flex: 1; min-height: 4px; border-radius: 4px 4px 0 0;
    background: linear-gradient(to top, #1f6feb, #58a6ff);
    position: relative; cursor: pointer;
  }
  .bar:hover::after {
    content: attr(data-tip); position: absolute; top: -24px;
    left: 50%; transform: translateX(-50%);
    background: #30363d; color: #f0f6fc; padding: 2px 6px;
    border-radius: 4px; font-size: 12px; white-space: nowrap;
  }
  .bar-labels { display: flex; gap: 8px; font-size: 11px; color: #8b949e; }
  .bar-labels span { flex: 1; text-align: center; }

  /* ── 时间线 ── */
  .timeline-section {
    background: #161b22; border: 1px solid #30363d;
    border-radius: 8px; padding: 20px;
  }
  .timeline-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px;
  }
  .timeline-header h3 { font-size: 16px; }
  .filters { display: flex; gap: 8px; }
  .filters input, .filters select {
    background: #0d1117; border: 1px solid #30363d; border-radius: 6px;
    color: #c9d1d9; padding: 6px 12px; font-size: 13px;
  }
  .filters input { width: 200px; }
  .filters select { cursor: pointer; }

  .timeline { position: relative; padding-left: 20px; }
  .timeline::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0;
    width: 2px; background: #30363d;
  }

  .timeline-date {
    position: relative; font-size: 13px; color: #8b949e;
    margin: 16px 0 8px; padding-left: 12px;
  }
  .timeline-date::before {
    content: ''; position: absolute; left: -21px; top: 5px;
    width: 10px; height: 10px; border-radius: 50%;
    background: #1f6feb; border: 2px solid #0d1117;
  }

  .memory-card {
    background: #0d1117; border: 1px solid #30363d; border-radius: 6px;
    padding: 12px 16px; margin: 8px 0; cursor: pointer;
    transition: border-color 0.2s;
  }
  .memory-card:hover { border-color: #58a6ff; }
  .memory-card .meta {
    display: flex; gap: 8px; font-size: 12px; margin-bottom: 4px;
  }
  .memory-card .tag {
    padding: 1px 6px; border-radius: 4px; font-size: 11px;
  }
  .tag-persistent { background: #0e4429; color: #26a641; }
  .tag-session { background: #1f3a5f; color: #58a6ff; }
  .tag-archived { background: #3d1f1f; color: #f85149; }
  .memory-card .content { font-size: 14px; line-height: 1.5; }
  .memory-card .time { font-size: 12px; color: #8b949e; margin-top: 4px; }

  /* ── 模态框 ── */
  .modal-overlay {
    display: none; position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.7);
  }
  .modal-overlay.active { display: flex; align-items: center; justify-content: center; }
  .modal {
    background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    width: 90%; max-width: 700px; max-height: 80vh; overflow-y: auto;
    padding: 24px;
  }
  .modal h2 { margin-bottom: 8px; }
  .modal .meta { margin-bottom: 16px; }
  .modal .body { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
  .modal .close {
    float: right; background: none; border: none; color: #8b949e;
    cursor: pointer; font-size: 20px;
  }

  /* ── 分页 ── */
  .pagination { display: flex; gap: 8px; justify-content: center; margin-top: 16px; }
  .pagination button {
    background: #21262d; border: 1px solid #30363d; border-radius: 6px;
    color: #c9d1d9; padding: 6px 12px; cursor: pointer; font-size: 13px;
  }
  .pagination button:hover { background: #30363d; }
  .pagination button.active { background: #1f6feb; border-color: #1f6feb; }

  @media (max-width: 768px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .charts-row { flex-direction: column; }
    .timeline-header { flex-direction: column; gap: 8px; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>mymore Memory Hub</h1>
    <div class="subtitle">记忆存储系统仪表盘</div>
  </div>
  <div id="headerInfo" style="font-size:13px;color:#8b949e">加载中...</div>
</div>

<div class="container">

  <!-- 统计卡片 -->
  <div class="stats-grid" id="statsGrid">
    <div class="stat-card"><div class="value" id="statTotal">—</div><div class="label">总记忆数</div></div>
    <div class="stat-card"><div class="value" id="statProjects">—</div><div class="label">分轨数</div></div>
    <div class="stat-card"><div class="value" id="statActiveDays">—</div><div class="label">活跃天数</div></div>
    <div class="stat-card"><div class="value" id="statAvg">—</div><div class="label">日均记忆</div></div>
  </div>

  <!-- 图表 -->
  <div class="charts-row">
    <div class="chart-box">
      <h3>📅 近 6 个月活动</h3>
      <div id="heatmapContainer"></div>
    </div>
    <div class="chart-box">
      <h3>📈 近 7 日趋势</h3>
      <div id="growthContainer"></div>
    </div>
  </div>

  <!-- 时间线 -->
  <div class="timeline-section">
    <div class="timeline-header">
      <h3>📝 记忆时间线</h3>
      <div class="filters">
        <input type="text" id="searchInput" placeholder="搜索记忆..." oninput="searchMemories()">
        <select id="categoryFilter" onchange="searchMemories()">
          <option value="">全部分类</option>
          <option value="persistent">persistent</option>
          <option value="session">session</option>
          <option value="archived">archived</option>
        </select>
      </div>
    </div>
    <div id="timelineContainer"></div>
    <div id="paginationContainer"></div>
  </div>

</div>

<div class="modal-overlay" id="modal">
  <div class="modal">
    <button class="close" onclick="closeModal()">&times;</button>
    <h2 id="modalTitle">记忆详情</h2>
    <div class="meta" id="modalMeta"></div>
    <div class="body" id="modalBody"></div>
  </div>
</div>

<script>
const PROXY = '';
let currentPage = 1;

// ── 加载数据 ──

async function loadJSON(url) {
  const res = await fetch(PROXY + url);
  return res.json();
}

// ── 统计卡片 ──

async function loadStats() {
  const stats = await loadJSON('/api/stats');
  document.getElementById('statTotal').textContent = stats.totalMemories;
  document.getElementById('statProjects').textContent = stats.projects;
  document.getElementById('statActiveDays').textContent = stats.activeDays;
  document.getElementById('statAvg').textContent = stats.avgPerDay;
  document.getElementById('headerInfo').innerHTML =
    \`\${stats.totalMemories} 条记忆 · \${stats.projects} 个分轨\`;
}

// ── 热力图 ──

async function loadHeatmap() {
  const data = await loadJSON('/api/heatmap');
  const map = {};
  data.forEach(d => map[d.date] = d.count);
  const values = data.map(d => d.count);
  values.sort((a,b) => a - b);

  // 四分位数阈值
  const p25 = values[Math.floor(values.length * 0.25)] || 1;
  const p50 = values[Math.floor(values.length * 0.5)] || 2;
  const p75 = values[Math.floor(values.length * 0.75)] || 3;

  function getLevel(c) {
    if (c === 0) return 0;
    if (c <= p25) return 1;
    if (c <= p50) return 2;
    if (c <= p75) return 3;
    return 4;
  }

  const now = new Date();
  const start = new Date(now); start.setMonth(start.getMonth() - 5);
  start.setDate(1);

  let html = '<div class="heatmap-labels">' +
    'S M T W T F S'.split(' ').map(d => '<span>' + d + '</span>').join('') +
    '</div><div class="heatmap">';

  const weeks = [];
  let current = new Date(start);
  while (current <= now) {
    weeks.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }

  for (const weekStart of weeks) {
    let row = '<div class="heatmap-row">';
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      if (date > now || date < start) { row += '<div class="heatmap-cell"></div>'; continue; }
      const key = date.toISOString().slice(0, 10);
      const count = map[key] || 0;
      const lvl = getLevel(count);
      row += \`<div class="heatmap-cell" data-lvl="\${lvl}" data-tip="\${count} 条 - \${key}"></div>\`;
    }
    row += '</div>';
    html += row;
  }
  html += '</div>';
  document.getElementById('heatmapContainer').innerHTML = html;
}

// ── 柱状图 ──

async function loadGrowth() {
  const data = await loadJSON('/api/growth');
  const max = Math.max(...data.map(d => d.count), 1);
  const days = ['周日','周一','周二','周三','周四','周五','周六'];

  let bars = '<div class="bar-chart">';
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const item = data.find(x => x.date === key);
    const count = item ? item.count : 0;
    const h = Math.max(4, (count / max) * 100);
    bars += \`<div class="bar" style="height:\${h}px" data-tip="\${count} 条"></div>\`;
  }
  bars += '</div><div class="bar-labels">';
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    bars += '<span>' + days[d.getDay()] + '</span>';
  }
  bars += '</div>';
  document.getElementById('growthContainer').innerHTML = bars;
}

// ── 时间线 ──

async function loadMemories(page = 1) {
  currentPage = page;
  const q = document.getElementById('searchInput').value;
  const category = document.getElementById('categoryFilter').value;
  let url = \`/api/memories?page=\${page}&pageSize=50\`;
  if (q) url += '&q=' + encodeURIComponent(q);
  if (category) url += '&category=' + encodeURIComponent(category);

  const data = await loadJSON(url);
  const container = document.getElementById('timelineContainer');
  const pagination = document.getElementById('paginationContainer');

  // 按日期分组
  const groups = {};
  data.memories.forEach(m => {
    const date = m.created_at.slice(0, 10);
    if (!groups[date]) groups[date] = [];
    groups[date].push(m);
  });

  let html = '<div class="timeline">';
  Object.keys(groups).sort().reverse().forEach(date => {
    html += \`<div class="timeline-date">\${date}</div>\`;
    groups[date].forEach(m => {
      html += \`
        <div class="memory-card" onclick="openModal('\${m.id.replace(/'/g, "\\'")}')">
          <div class="meta">
            <span class="tag tag-\${m.category}">\${m.category}</span>
            <span>\${m.track}</span>
          </div>
          <div class="content">\${m.content.slice(0, 120)}\${m.content.length > 120 ? '...' : ''}</div>
          <div class="time">\${new Date(m.created_at).toLocaleString()}</div>
        </div>
      \`;
    });
  });
  html += '</div>';
  container.innerHTML = html;

  // 分页
  if (data.totalPages > 1) {
    let phtml = '<div class="pagination">';
    for (let i = 1; i <= Math.min(data.totalPages, 10); i++) {
      phtml += \`<button class="\${i === page ? 'active' : ''}" onclick="loadMemories(\${i})">\${i}</button>\`;
    }
    phtml += \`<span style="color:#8b949e;font-size:13px;line-height:32px">共 \${data.total} 条</span>\`;
    phtml += '</div>';
    pagination.innerHTML = phtml;
  } else {
    pagination.innerHTML = '';
  }
}

// ── 模态框 ──

async function openModal(id) {
  const data = await loadJSON('/api/memories?pageSize=500');
  const m = data.memories.find(x => x.id === id);
  if (!m) return;
  document.getElementById('modalTitle').textContent = '记忆详情';
  document.getElementById('modalMeta').innerHTML =
    \`<span class="tag tag-\${m.category}">\${m.category}</span>
     \${m.track} · \${new Date(m.created_at).toLocaleString()}
     · 访问 \${m.access_count} 次\`;
  document.getElementById('modalBody').textContent = m.content;
  document.getElementById('modal').classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}
document.getElementById('modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── 搜索（防抖） ──

let timer;
function searchMemories() {
  clearTimeout(timer);
  timer = setTimeout(() => loadMemories(1), 300);
}

// ── 初始化 ──

loadStats();
loadHeatmap();
loadGrowth();
loadMemories();
</script>
</body>
</html>
```

- [ ] **Step 2: 提交**

```bash
git add apps/mcp-server/src/hub/dashboard.html
git commit -m "feat(hub): 添加 Memory Hub 前端仪表盘"

```

---

### Task 3: 更新 tsup.config.ts + tsconfig.json

**Files:**
- Modify: `apps/mcp-server/tsup.config.ts`

- [ ] **Step 1: 更新 tsup.config.ts 添加 hub/server.js 入口**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bootstrap': 'src/bootstrap.ts',
    'hub/server': 'src/hub/server.js',
  },
  format: 'esm',
  dts: false,
  clean: true,
});
```

注意：`hub/server.js` 是纯 JS 文件，不需要 TypeScript 编译。tsup 支持 `.js` 入口——它会被复制到 `dist/hub/` 下。

- [ ] **Step 2: 验证构建**

```bash
cd apps/mcp-server && pnpm build
ls dist/hub/        # 应包含 server.js
```

Expected: `dist/hub/server.js` 存在

- [ ] **Step 3: 提交**

```bash
git add apps/mcp-server/tsup.config.ts
git commit -m "chore: 添加 hub 构建入口"

```

---

### Task 4: 更新 docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: 添加 hub 服务到 docker-compose.yml**

```yaml
services:
  mymore-mcp:
    # 现有配置不变...
    build:
      context: .
      dockerfile: apps/mcp-server/Dockerfile
    image: mymore-mcp
    container_name: mymore-mcp
    restart: unless-stopped
    stdin_open: true
    tty: false
    volumes:
      - ~/.mymore:/root/.mymore
    environment:
      - MYMORE_ROOT=/root/.mymore

  mymore-hub:
    build:
      context: .
      dockerfile: apps/mcp-server/Dockerfile
    image: mymore-mcp
    container_name: mymore-hub
    restart: unless-stopped
    ports:
      - "3456:3456"
    volumes:
      - ~/.mymore:/root/.mymore
    environment:
      - MYMORE_ROOT=/root/.mymore
      - MYMORE_HUB_PORT=3456
    command: ["node", "apps/mcp-server/dist/hub/server.js"]
```

- [ ] **Step 2: 提交**

```bash
git add docker-compose.yml
git commit -m "feat: 添加 mymore-hub 服务到 Docker Compose"

```

---

### Task 5: 集成测试

- [ ] **Step 1: 构建并启动**

```bash
docker compose build
docker compose up -d
sleep 3
docker compose ps
```

Expected: `mymore-mcp` 和 `mymore-hub` 都显示 Up

- [ ] **Step 2: 测试 hub API**

```bash
curl -s http://localhost:3456/health
curl -s http://localhost:3456/api/stats
curl -s http://localhost:3456/api/memories | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{d[\"total\"]} 条记忆')"
```

Expected: 三个 API 都返回正确数据

- [ ] **Step 3: 测试浏览器访问**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3456/
```

Expected: `200`

- [ ] **Step 4: 验证 MCP 服务仍正常**

```bash
printf '{"jsonrpc":"2.0","id":"test","method":"tools/list","params":{}}\n' | docker compose run --rm -T mymore-mcp 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('MCP OK:', [t['name'] for t in d['result']['tools']])"
```

Expected: 4 个工具全部可用
