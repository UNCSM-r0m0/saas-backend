const { spawn } = require('child_process');

async function checkHealth(baseUrl) {
  const healthUrl = `${baseUrl.replace(/\/$/, '')}/api/health`;
  const response = await fetch(healthUrl);
  if (!response.ok) {
    throw new Error(
      `Health check failed: ${response.status} ${response.statusText}`,
    );
  }
  return await response.text();
}

function runWsConnectSmoke() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/ws-connect-smoke.js'], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ws-connect-smoke exited with code ${code}`));
    });
  });
}

async function main() {
  const baseUrl = process.env.GATEWAY_URL || 'http://localhost:3001';
  console.log(`[release-smoke] checking ${baseUrl}/api/health`);
  await checkHealth(baseUrl);
  console.log('[release-smoke] gateway health OK');
  await runWsConnectSmoke();
  console.log('[release-smoke] all checks passed');
}

main().catch((error) => {
  console.error('[release-smoke] failed:', error.message);
  process.exit(1);
});
