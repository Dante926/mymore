#!/usr/bin/env node
/**
 * mymore Memory Hub — HTTP 仪表盘服务器
 *
 * 使用 Node.js 内置 node:sqlite（Node 22+），
 * 零外部依赖，跨平台兼容。
 * 端口: MYMORE_HUB_PORT 或 3456
 * 数据库: MYMORE_ROOT/.index/memory.db
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.MYMORE_HUB_PORT || '3456', 10);
const ROOT = process.env.MYMORE_ROOT || path.join(os.homedir(), '.mymore');
const DB_PATH = path.join(ROOT, '.index', 'memory.db');
const HTML_PATH = path.join(__dirname, 'dashboard.html');

// ── 数据库连接 ──────────────────────────────────────────────

let db;
try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH, { readOnly: true });
} catch (e) {
  console.error(`[hub] 无法打开数据库: ${e.message}`);
  process.exit(1);
}

function queryAll(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function queryOne(sql, params = []) {
  const rows = db.prepare(sql).all(...params);
  return rows.length > 0 ? rows[0] : null;
}

// ── 工具 ──────────────────────────────────────────────────

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function serveStatic(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch { sendJson(res, { error: 'Not found' }, 404); }
}

// ── API ───────────────────────────────────────────────────

function apiStats(req, res) {
  const total = queryOne("SELECT COUNT(*) as count FROM memory_meta WHERE superseded_by IS NULL");
  const byCategory = queryAll("SELECT category, COUNT(*) as count FROM memory_meta WHERE superseded_by IS NULL GROUP BY category");
  const byGroup = queryAll("SELECT COUNT(DISTINCT group_key) as count FROM memory_meta WHERE superseded_by IS NULL AND group_key IS NOT NULL");
  const activeDays = queryOne(`SELECT COUNT(DISTINCT date(created_at)) as count FROM memory_meta WHERE superseded_by IS NULL AND created_at > datetime('now', '-6 months')`);
  const first = queryOne('SELECT MIN(created_at) as first FROM memory_meta');
  const days = first?.first ? Math.max(1, Math.ceil((Date.now() - new Date(first.first).getTime()) / 86400000)) : 1;

  sendJson(res, {
    totalMemories: total?.count || 0,
    byCategory: Object.fromEntries(byCategory.map(r => [r.category, r.count])),
    projects: byGroup?.[0]?.count || 0,
    activeDays: activeDays?.count || 0,
    avgPerDay: ((total?.count || 0) / days).toFixed(1),
  });
}

function apiHeatmap(req, res) {
  const rows = queryAll(`SELECT date(created_at) as date, COUNT(*) as count FROM memory_meta WHERE superseded_by IS NULL AND created_at > datetime('now', '-6 months') GROUP BY date(created_at) ORDER BY date ASC`);
  sendJson(res, rows);
}

function apiGrowth(req, res) {
  const rows = queryAll(`SELECT date(created_at) as date, COUNT(*) as count FROM memory_meta WHERE superseded_by IS NULL AND created_at > datetime('now', '-7 days') GROUP BY date(created_at) ORDER BY date ASC`);
  sendJson(res, rows);
}

function apiMemories(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const q = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50', 10)));
  const offset = (page - 1) * pageSize;
  const params = [];

  let where = 'WHERE m.superseded_by IS NULL';
  if (category) { where += ' AND m.category = ?'; params.push(category); }
  if (q) {
    const like = q.length <= 2;
    where += like ? ' AND f.content LIKE ?' : ' AND memory_fts MATCH ?';
    params.push(like ? `%${q}%` : q);
  }

  const total = queryOne(`SELECT COUNT(*) as total FROM memory_fts f JOIN memory_meta m ON f.rowid = m.fts_rowid ${where}`, params)?.total || 0;
  const memories = queryAll(`SELECT m.id, f.content, m.category, m.track, m.created_at, m.valid_until, m.superseded_by, m.frozen, m.access_count, m.group_key FROM memory_fts f JOIN memory_meta m ON f.rowid = m.fts_rowid ${where} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);

  sendJson(res, {
    memories: memories.map(r => ({ ...r, frozen: !!r.frozen })),
    total, page, pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

// ── 路由 ───────────────────────────────────────────────────

function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' });
    return res.end();
  }
  if (url.pathname === '/api/stats') return apiStats(req, res);
  if (url.pathname === '/api/heatmap') return apiHeatmap(req, res);
  if (url.pathname === '/api/growth') return apiGrowth(req, res);
  if (url.pathname === '/api/memories') return apiMemories(req, res);
  if (url.pathname === '/health') return sendJson(res, { status: 'ok', uptime: process.uptime() });
  if (url.pathname === '/' || url.pathname === '/index.html') return serveStatic(res, HTML_PATH, 'text/html; charset=utf-8');
  sendJson(res, { error: 'Not found' }, 404);
}

const server = http.createServer(route);
server.listen(PORT, () => console.log(`[mymore-hub] http://localhost:${PORT}`));
process.on('SIGTERM', () => { db?.close(); server.close(); });
process.on('SIGINT', () => { db?.close(); server.close(); process.exit(); });
