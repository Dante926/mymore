import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startNotifyServer } from '../src/notify-server.js';

describe('notify-server', () => {
  let server; let received: string[] = [];
  beforeAll(async () => {
    server = await startNotifyServer(0, (sessionKey) => received.push(sessionKey)); // port 0 = random
  });
  afterAll(async () => { await server.close(); });

  it('POST /notify calls handler and returns ok', async () => {
    const port = (server as any).port();
    const res = await fetch(`http://127.0.0.1:${port}/notify`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({sessionKey:'projA'}),
    });
    expect(res.status).toBe(200);
    await new Promise(r => setTimeout(r, 50));
    expect(received).toContain('projA');
  });

  it('rejects non-POST', async () => {
    const port = (server as any).port();
    const res = await fetch(`http://127.0.0.1:${port}/notify`);
    expect(res.status).toBe(405);
  });

  it('rejects (not crashes) when the port is already taken (EADDRINUSE)', async () => {
    const busy = await startNotifyServer(0, () => {});
    try {
      // Same address as `busy` → second listen must reject, not emit unhandled 'error'
      await expect(startNotifyServer((busy as any).port(), () => {})).rejects.toThrow();
    } finally {
      await busy.close();
    }
  });
});
