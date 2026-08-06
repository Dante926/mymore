import http from 'node:http';

export async function startNotifyServer(port: number, handler: (sessionKey: string) => void) {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/notify') {
      res.writeHead(405, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'method not allowed'}));
      return;
    }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const { sessionKey } = JSON.parse(body || '{}');
        handler(sessionKey || '');
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true}));
      } catch { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'bad body'})); }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', () => resolve());
    server.listen(port, '127.0.0.1');
  });
  const actualPort = (server.address() as any).port;
  return {
    port: () => actualPort,
    close: () => new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())),
  };
}
