const { spawn } = require('child_process');
const http = require('http');

const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

function spawnProc(script) {
  const p = spawn(npm, ['run', script], { stdio: 'inherit', shell: false });
  p.on('error', err => console.error(`[${script}] error:`, err.message));
  return p;
}

function waitForPort(port, retries = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const req = http.get(`http://localhost:${port}`, () => { req.destroy(); resolve(); });
      req.on('error', () => {
        if (++attempts >= retries) return reject(new Error(`Port ${port} not ready`));
        setTimeout(check, 1000);
      });
    };
    check();
  });
}

async function main() {
  console.log('[dev] Starting Vite servers...');
  const renderer = spawnProc('dev:renderer');
  const viewer   = spawnProc('dev:code-viewer');

  const procs = [renderer, viewer];

  process.on('SIGINT', () => { procs.forEach(p => p.kill()); process.exit(0); });
  process.on('SIGTERM', () => { procs.forEach(p => p.kill()); process.exit(0); });

  console.log('[dev] Waiting for ports 5173 and 5174...');
  await Promise.all([waitForPort(5173), waitForPort(5174)]);

  console.log('[dev] Launching Electron...');
  const electron = spawn(
    require('electron'),
    ['.'],
    { stdio: 'inherit', shell: false }
  );
  procs.push(electron);

  electron.on('close', () => {
    procs.forEach(p => p.kill());
    process.exit(0);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
