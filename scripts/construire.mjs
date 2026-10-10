import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');

rmSync('dist', { recursive: true, force: true });
for (const projet of ['tsconfig.esm.json', 'tsconfig.cjs.json']) {
  execFileSync(process.execPath, [tsc, '-p', projet], { stdio: 'inherit' });
}
writeFileSync('dist/cjs/package.json', `${JSON.stringify({ type: 'commonjs' })}\n`);
