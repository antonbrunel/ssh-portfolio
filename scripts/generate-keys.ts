/**
 * Standalone script to pre-generate the SSH host key.
 * Run once before starting the server: npm run generate-keys
 *
 * The server also auto-generates a key at startup if none exists,
 * so this script is optional — useful when you want a stable,
 * pre-committed key for consistent SSH fingerprints.
 */

import { generateKeyPairSync } from 'crypto';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const keysDir = join(__dirname, '..', 'keys');
const keyPath = join(keysDir, 'host_key');

if (!existsSync(keysDir)) {
  mkdirSync(keysDir, { recursive: true });
}

if (existsSync(keyPath)) {
  console.log(`Host key already exists at ${keyPath}`);
  console.log('Delete it first if you want to regenerate.');
  process.exit(0);
}

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

writeFileSync(keyPath, privateKey, { mode: 0o600 });
console.log(`Host key generated at ${keyPath}`);
console.log('Add keys/ to .gitignore to avoid committing it.');
