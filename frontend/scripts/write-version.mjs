import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

let commit = process.env.COMMIT;
if (!commit) commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const info = {
  name: 'infodigest-frontend',
  version: process.env.VERSION || 'dev',
  build_no: process.env.BUILD_NO || 'local',
  run_id: process.env.RUN_ID || 'local',
  commit,
};
for (const [key, value] of Object.entries(info)) {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) throw new Error(`Invalid ${key}`);
}
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('COMMIT must be a full Git SHA');
mkdirSync('public', { recursive: true });
writeFileSync('public/version.json', JSON.stringify(info, null, 2) + '\n');
console.log(JSON.stringify(info));
