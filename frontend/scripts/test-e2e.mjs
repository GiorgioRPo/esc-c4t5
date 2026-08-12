/**
 * Cross-platform E2E test runner.
 *
 * Usage:
 *   node scripts/test-e2e.mjs           # run full pipeline
 *   node scripts/test-e2e.mjs --docker  # only start/stop docker (no tests)
 *
 * Environment:
 *   E2E_MODE=1  — use localhost:3000 (host-side test run)
 *   CI=true     — CI mode (retries, single worker)
 */

import { execSync, spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '../..')
const FRONTEND = join(ROOT, 'frontend')
const COMPOSE = ['-f', 'docker-compose.yml', '-f', 'docker-compose.e2e.yml']

// ─── helpers ────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: opts.cwd ?? ROOT, ...opts })
  } catch (err) {
    if (opts.exitOnError !== false) process.exit(err.status ?? 1)
  }
}

async function waitFor(port, timeout = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      await fetch(`http://localhost:${port}/`)
      return
    } catch {
      await new Promise(r => setTimeout(r, 500))
    }
  }
  throw new Error(`Timeout waiting for localhost:${port}`)
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dockerOnly = args.includes('--docker')
  const env = { ...process.env, E2E_MODE: '1' }

  // 1. Start Docker stack
  run(`docker compose ${COMPOSE.join(' ')} up --build -d`)

  // 2. Wait for frontend to be ready
  console.log('Waiting for frontend...')
  await waitFor(3000, 60_000)
  console.log('Frontend ready.')

  // 3. Start Stripe CLI in background
  let stripeProcess
  if (!dockerOnly) {
    stripeProcess = spawn('stripe', ['listen', '--forward-to', 'http://localhost:3001/api/webhooks/stripe'], {
      stdio: 'inherit',
      detached: true,
    })
    console.log(`Stripe listener PID: ${stripeProcess.pid}`)
  }

  // 4. Run Playwright tests
  let testResult = 0
  if (!dockerOnly) {
    const cmd = `cd "${FRONTEND}" && E2E_MODE=1 npx playwright test tests/e2e/full.spec.ts`
    testResult = await new Promise(resolve => {
      const proc = spawn('sh', ['-c', cmd], { env, stdio: 'inherit' })
      proc.on('close', resolve)
    })
  }

  // 5. Cleanup
  if (stripeProcess) {
    console.log('Stopping Stripe listener...')
    stripeProcess.kill('SIGTERM')
    await new Promise(r => setTimeout(r, 500))
    stripeProcess.kill('SIGKILL')
  }

  run(`docker compose ${COMPOSE.join(' ')} down`)

  process.exit(testResult)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
