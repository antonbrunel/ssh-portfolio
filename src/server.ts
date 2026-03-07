import { Server } from 'ssh2';
import type {
  Connection,
  AcceptConnection,
  RejectConnection,
  Session,
  ServerChannel,
  PseudoTtyInfo,
  WindowChangeInfo,
} from 'ssh2';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { startApp, PortfolioApp } from './app';

// ─── Config ──────────────────────────────────────────────────────────────────

const rawPort = parseInt(process.env.SSH_PORT ?? process.env.PORT ?? '2222', 10);
const SSH_PORT = isNaN(rawPort) || rawPort < 1 || rawPort > 65535 ? 2222 : rawPort;

const MAX_CONNECTIONS = 20;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// ─── Host key management ─────────────────────────────────────────────────────

function generateRsaKey(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { generateKeyPairSync } = require('crypto') as any;
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  return privateKey as string;
}

function ensureHostKey(): Buffer {
  if (process.env.SSH_HOST_KEY) {
    const raw = process.env.SSH_HOST_KEY.trim();
    const buf = Buffer.from(raw, 'base64');
    if (buf.length < 100) {
      console.error('SSH_HOST_KEY appears invalid (decoded length too short). Aborting.');
      process.exit(1);
    }
    return buf;
  }

  const keyPath = process.env.HOST_KEY_PATH ?? join(__dirname, '..', 'keys', 'host_key');

  if (!existsSync(keyPath)) {
    console.log('No host key found — generating RSA key pair...');
    mkdirSync(dirname(keyPath), { recursive: true });
    const privateKey = generateRsaKey();
    writeFileSync(keyPath, privateKey, { mode: 0o600 });
    console.log(`Host key saved to ${keyPath}`);
  }

  return readFileSync(keyPath);
}

// ─── Server ──────────────────────────────────────────────────────────────────

const hostKey = ensureHostKey();
let activeConnections = 0;

const server = new Server({ hostKeys: [hostKey] }, (client: Connection) => {
  activeConnections++;
  console.log(`Client connected (active: ${activeConnections})`);

  // Hard limit on concurrent connections
  if (activeConnections > MAX_CONNECTIONS) {
    console.warn('Connection limit reached — rejecting client');
    client.end();
    activeConnections--;
    return;
  }

  // Idle timeout — close inactive connections
  let idleTimer = setTimeout(() => {
    console.log('Client idle timeout — closing connection');
    client.end();
  }, IDLE_TIMEOUT_MS);

  const resetIdle = (): void => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      console.log('Client idle timeout — closing connection');
      client.end();
    }, IDLE_TIMEOUT_MS);
  };

  client.on('authentication', (ctx) => {
    ctx.accept();
  });

  client.on('ready', () => {
    console.log('Client authenticated');

    let app: PortfolioApp | null = null;
    let dims = { cols: 80, rows: 24 };

    client.on('session', (accept: AcceptConnection<Session>) => {
      const session = accept();

      session.on('pty', (accept: (() => void) | false, _reject: RejectConnection, info: PseudoTtyInfo) => {
        dims = { cols: info.cols || 80, rows: info.rows || 24 };
        if (typeof accept === 'function') accept();
      });

      session.on('window-change', (_accept: unknown, _reject: unknown, info: WindowChangeInfo) => {
        dims = { cols: info.cols || dims.cols, rows: info.rows || dims.rows };
        if (app) app.resize(dims.cols, dims.rows);
      });

      session.once('shell', (accept: AcceptConnection<ServerChannel>) => {
        const stream = accept();
        // Reset idle timer on any user input
        stream.on('data', resetIdle);
        app = startApp(stream, dims);
      });

      // Reject all raw shell access — no system access ever granted
      session.on('exec',      (_a: unknown, reject: RejectConnection) => reject());
      session.on('subsystem', (_a: unknown, reject: RejectConnection) => reject());
      session.on('sftp',      (_a: unknown, reject: RejectConnection) => reject());
    });
  });

  client.on('error', (err: Error) => {
    console.error('Client error:', err.message);
  });

  client.on('close', () => {
    clearTimeout(idleTimer);
    activeConnections = Math.max(0, activeConnections - 1);
    console.log(`Client disconnected (active: ${activeConnections})`);
  });
});

server.listen(SSH_PORT, '0.0.0.0', () => {
  console.log(`SSH Portfolio running on port ${SSH_PORT}`);
  console.log(`Connect with: ssh -p ${SSH_PORT} portfolio@localhost`);
});

server.on('error', (err: Error) => {
  console.error('Server error:', err);
  process.exit(1);
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────

function shutdown(signal: string): void {
  console.log(`\n${signal} received — shutting down gracefully`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  // Force exit after 5s if connections don't drain
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});
