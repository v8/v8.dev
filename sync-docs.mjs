import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const REPO_PATH = args[0] || 'https://github.com/v8/v8.git';

const DOCS_DEST = path.join(__dirname, 'src', 'docs');
fs.mkdirSync(DOCS_DEST, { recursive: true });

function sh(cmdArray, options = {}) {
  const [cmd, ...cmdArgs] = cmdArray;
  const cmdString = cmdArray.join(' ');
  console.log(`::group::Running: ${cmdString}`);
  try {
    const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit', ...options });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`Command failed with exit code ${result.status}`);
    }
  } finally {
    console.log('::endgroup::');
  }
}

if (!REPO_PATH.startsWith('http') && !REPO_PATH.startsWith('git') && !REPO_PATH.startsWith('/')) {
  console.error(`Error: ${REPO_PATH} is not a recognized Git URL or local path.`);
  process.exit(1);
}

console.log(`Cloning docs from ${REPO_PATH}...`);
const tmpDir = path.join(__dirname, '.v8-tmp');

if (fs.existsSync(tmpDir)) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

try {
  sh(['git', 'clone', '--depth', '1', '--filter=blob:none', '--sparse', REPO_PATH, '.v8-tmp']);
  sh(['git', 'sparse-checkout', 'set', 'docs'], { cwd: tmpDir });
  fs.cpSync(path.join(tmpDir, 'docs'), DOCS_DEST, { recursive: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('Git sync complete.');
} catch (err) {
  console.error('Failed to sync docs from Git:', err.message);
  process.exit(1);
}
