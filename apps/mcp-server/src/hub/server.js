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
import os from 'node:os';
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

function queryAll(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function queryOne(sql, params = []) {
  return db.prepare(sql).get(...params);
}

// ── 工具函数 ────────────────────────────────────────────────

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res, msg, status = 500) {
  sendJson(res, { error: msg }, status);
}

// ── API 处理器 ─────────────────────────────────────────────

const api = {

  // GET /api/stats — 统计概览
  stats(req, res) {
    const total = queryOne('SELECT COUNT(*) as count FROM memory_meta');
    const byCategory = queryAll(
      'SELECT category, COUNT(*) as count FROM memory_meta GROUP BY category',
    );
    const byTrack = queryAll(
      'SELECT track, COUNT(*) as count FROM memory_meta GROUP BY track',
    );
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
      byCategory: Object.fromEntries(byCategory.map((r) => [r.category, r.count])),
      byTrack: Object.fromEntries(byTrack.map((r) => [r.track, r.count])),
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
    const params = [];

    let where = 'WHERE m.superseded_by IS NULL';

    if (category) {
      where += ' AND m.category = ?';
      params.push(category);
    }

    if (q) {
      const useLike = q.length <= 2;
      if (useLike) {
        where += ' AND f.content LIKE ?';
        params.push(`%${q}%`);
      } else {
        where += ' AND memory_fts MATCH ?';
        params.push(q);
      }
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
      memories: memories.map((r) => ({
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

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // API
  if (pathname === '/api/stats') return api.stats(req, res);
  if (pathname === '/api/heatmap') return api.heatmap(req, res);
  if (pathname === '/api/growth') return api.growth(req, res);
  if (pathname === '/api/memories') return api.memories(req, res);

  // 健康检查
  if (pathname === '/health') return sendJson(res, { status: 'ok', uptime: process.uptime() });

  // 静态文件
  if (pathname === '/' || pathname === '/index.html') {
    try {
      const data = fs.readFileSync(HTML_PATH);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(data);
    } catch {
      return sendError(res, 'dashboard.html not found', 404);
    }
  }

  sendJson(res, { error: 'Not found' }, 404);
}

// ── 启动 ───────────────────────────────────────────────────

const server = http.createServer(route);
server.listen(PORT, () => {
  console.log(`[mymore-hub] http://localhost:${PORT}`);
});

// 优雅退出
process.on('SIGTERM', () => { db?.close(); server.close(); });
process.on('SIGINT', () => { db?.close(); server.close(); process.exit(); });
