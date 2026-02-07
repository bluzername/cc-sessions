import { createServer } from 'http';

/**
 * Lightweight HTTP server that receives hook payloads from Claude Code sessions.
 * Uses Node.js built-in http module. Listens on 127.0.0.1 by default.
 */
export class HookServer {
  /**
   * @param {object} opts
   * @param {number} opts.port
   * @param {string} opts.secret - shared secret for authentication
   * @param {(payload: object) => Promise<void>} opts.onHook - handler for incoming hooks
   */
  constructor({ port, secret, onHook }) {
    this.port = port;
    this.secret = secret;
    this.onHook = onHook;
    this.server = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this._handleRequest(req, res));
      this.server.on('error', reject);
      this.server.listen(this.port, '127.0.0.1', () => {
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(resolve);
    });
  }

  async _handleRequest(req, res) {
    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Hook endpoint
    if (req.method === 'POST' && req.url === '/hook') {
      try {
        const body = await this._readBody(req);
        const payload = JSON.parse(body);

        // Authenticate
        if (this.secret && payload.secret !== this.secret) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid secret' }));
          return;
        }

        // Remove secret from payload before processing
        delete payload.secret;

        // Process asynchronously — don't block the hook
        this.onHook(payload).catch((err) => {
          console.error('Hook processing error:', err.message);
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (_err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid JSON' }));
      }
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  }

  _readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
  }
}
