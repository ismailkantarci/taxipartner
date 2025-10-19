import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT_CLIENT_DIR = resolve(process.cwd(), '../node_modules/.prisma/client');
const LOCAL_CLIENT_DIR = resolve(process.cwd(), 'node_modules/.prisma/client');

if (!existsSync(ROOT_CLIENT_DIR)) {
  console.error(
    `[sync-prisma-client] Source Prisma client not found at ${ROOT_CLIENT_DIR}. ` +
      'Run `npm run db:gen` in the repository root first.'
  );
  process.exit(1);
}

rmSync(LOCAL_CLIENT_DIR, { recursive: true, force: true });
mkdirSync(dirname(LOCAL_CLIENT_DIR), { recursive: true });
cpSync(ROOT_CLIENT_DIR, LOCAL_CLIENT_DIR, { recursive: true });

console.log(`[sync-prisma-client] Prisma client synced to ${LOCAL_CLIENT_DIR}`);
