// Runs the player app, admin app and server together, with each line tagged by its source.
// Ctrl+C stops all three; if one exits on its own, the others are stopped too.
import { spawn } from 'node:child_process'

const apps = [
  { name: 'server', color: 35 },
  { name: 'client', color: 36 },
  { name: 'admin', color: 33 }
]
const width = Math.max(...apps.map((app) => app.name.length))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const children = []
let stopping = false

function pipe(stream, prefix, out) {
  let buffered = ''
  stream.on('data', (chunk) => {
    buffered += chunk.toString()
    const lines = buffered.split('\n')
    buffered = lines.pop() ?? ''
    for (const line of lines) out.write(`${prefix} ${line}\n`)
  })
  stream.on('end', () => {
    if (buffered) out.write(`${prefix} ${buffered}\n`)
  })
}

function stopAll(code) {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode === null) child.kill('SIGINT')
  process.exitCode = code
}

for (const app of apps) {
  const prefix = `\x1b[${app.color}m${app.name.padEnd(width)} |\x1b[0m`
  const child = spawn(npm, ['run', 'dev', `--workspace=${app.name}`], {
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  pipe(child.stdout, prefix, process.stdout)
  pipe(child.stderr, prefix, process.stderr)
  child.on('exit', (code) => {
    if (!stopping) console.error(`${prefix} exited with code ${code ?? 'null'}, stopping the rest`)
    stopAll(code ?? 1)
  })
  children.push(child)
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
