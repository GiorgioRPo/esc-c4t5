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
import { existsSync } from 'node:fs'
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

/**
 * Find the Stripe CLI binary on the current system.
 * Tries common installation paths on macOS, Linux, and Windows.
 * Returns the binary path and whether it needs cmd.exe on Windows.
 */
function findStripeBinary() {
  // macOS / Linux — try direct paths first
  const unixPaths = [
    '/usr/local/bin/stripe',
    '/opt/homebrew/bin/stripe',
    process.env.HOME ? join(process.env.HOME, '.stripe', 'stripe') : null,
  ].filter(Boolean)

  for (const path of unixPaths) {
    if (existsSync(path)) return { bin: path, needsShell: false }
  }

  // Windows — common installation paths
  const winPaths = [
    join(process.env.APPDATA || '', 'npm\\stripe.exe'),
    join(process.env.ProgramFiles || 'C:\\Program Files', 'Stripe\\stripe.exe'),
    join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Stripe\\stripe.exe'),
    'C:\\Program Files\\Stripe\\stripe.exe',
    'C:\\Program Files (x86)\\Stripe\\stripe.exe',
  ]

  for (const path of winPaths) {
    if (existsSync(path)) return { bin: path, needsShell: false }
  }

  // Fallback: check PATH via shell
  if (process.platform === 'win32') {
    try {
      const result = execSync('where stripe', { encoding: 'utf8', stdio: 'pipe' }).trim().replace(/\r$/, '')
      if (result) {
        // `where` may return a .cmd shim — run via cmd.exe in that case
        const needsShell = !result.toLowerCase().endsWith('.exe')
        return { bin: result, needsShell }
      }
    } catch { /* not in PATH */ }
  } else {
    try {
      const result = execSync('which stripe', { encoding: 'utf8', stdio: 'pipe' }).trim()
      if (result) return { bin: result, needsShell: false }
    } catch { /* not in PATH */ }
  }

  return null
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

  // 3. Start Stripe CLI in background (if available)
  let stripeProcess = null
  if (!dockerOnly) {
    const stripeInfo = findStripeBinary()
    if (stripeInfo) {
      console.log(`Starting Stripe listener: ${stripeInfo.bin}`)
      const stripeArgs = ['listen', '--forward-to', 'http://localhost:3001/api/webhooks/stripe']
      if (stripeInfo.needsShell) {
        // Run through cmd.exe for .cmd wrappers on Windows
        stripeProcess = spawn('cmd.exe', ['/c', stripeInfo.bin, ...stripeArgs], {
          stdio: 'inherit',
        })
      } else {
        stripeProcess = spawn(stripeInfo.bin, stripeArgs, {
          stdio: 'inherit',
        })
      }
      console.log(`Stripe listener PID: ${stripeProcess.pid}`)
    } else {
      console.warn('WARNING: Stripe CLI not found. Webhooks will not be forwarded.')
      console.warn('To fix: install Stripe CLI (https://stripe.com/docs/stripe-cli)')
    }
  }

  // 4. Run Playwright tests
  let testResult = 0
  if (!dockerOnly) {
    const shell = process.platform === 'win32' ? 'cmd' : 'sh'
    const shellFlag = process.platform === 'win32' ? '/c' : '-c'
    const cmd = process.platform === 'win32'
      ? `cd /d "${FRONTEND}" && set E2E_MODE=1 && npx playwright test tests/e2e/full.spec.ts`
      : `cd "${FRONTEND}" && E2E_MODE=1 npx playwright test tests/e2e/full.spec.ts`
    testResult = await new Promise(resolve => {
      const proc = spawn(shell, [shellFlag, cmd], { env, stdio: 'inherit' })
      proc.on('close', resolve)
    })
  }

  // 5. Cleanup
  if (stripeProcess) {
    console.log('Stopping Stripe listener...')
    try {
      stripeProcess.kill(process.platform === 'win32' ? 'SIGINT' : 'SIGTERM')
    } catch { /* already dead */ }
    await new Promise(r => setTimeout(r, 500))
  }

  run(`docker compose ${COMPOSE.join(' ')} down`)

  process.exit(testResult)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
