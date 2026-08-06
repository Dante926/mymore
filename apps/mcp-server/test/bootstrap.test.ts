import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

describe('bootstrap stdio hygiene (C1: MCP 协议通道独占 stdout)', () => {
  const src = readFileSync(
    join(fileURLToPath(new URL('..', import.meta.url)), 'src', 'bootstrap.ts'),
    'utf-8',
  );

  it('bootstrap.ts 无 console.log —— 所有日志走 stderr，不污染 stdout JSON-RPC 通道', () => {
    // MCP stdio transport 独占 stdout；SDK 的 ReadBuffer.deserializeMessage 对每行
    // JSON.parse，任何非 JSON-RPC 行都会让客户端解析崩溃。
    expect(src).not.toMatch(/console\.log\s*\(/);
  });

  it('日志仍保留（console.error 至少两处：pipeline L1 ready + notify 增量）', () => {
    expect(src).toMatch(/console\.error\(`\[pipeline\] L1 ready/);
    expect(src).toMatch(/console\.error\(`\[notify\] L0 增量/);
  });
});
