/**
 * Writes DiceBear Adventurer Neutral SVGs to public/avatars/.
 *
 * Usage:
 *   npm run avatars --workspace=whoami-client
 *   npm run avatars --workspace=whoami-client -- --start 4 --count 1 --random
 *
 * --start N              First avatar index (default 70)
 * --count N              How many files to write (default 1)
 * --random [true|false]  Append a random suffix to each seed (default false)
 */
import { createAvatar } from '@dicebear/core'
import * as adventurerNeutral from '@dicebear/adventurer-neutral'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

function parsePositiveInt(value, label) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${label} must be a positive integer (got ${value})`)
  }
  return n
}

function parseBoolean(value, label) {
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  throw new Error(`${label} must be true or false (got ${value})`)
}

function parseArgs(argv) {
  // 70 so user does not overwrite existing avatars 1-60 by mistake.
  let start = 70
  let count = 1
  let random = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--random' || arg === 'random') {
      const next = argv[i + 1]
      if (next === 'true' || next === 'false' || next === '1' || next === '0') {
        random = parseBoolean(next, 'random')
        i += 1
      } else {
        random = true
      }
      continue
    }
    if (arg?.startsWith('--random=')) {
      random = parseBoolean(arg.slice('--random='.length), 'random')
      continue
    }
    if (arg === '--start' || arg === 'start') {
      start = parsePositiveInt(argv[++i], 'start')
      continue
    }
    if (arg?.startsWith('--start=')) {
      start = parsePositiveInt(arg.slice('--start='.length), 'start')
      continue
    }
    if (arg === '--count' || arg === 'count') {
      count = parsePositiveInt(argv[++i], 'count')
      continue
    }
    if (arg?.startsWith('--count=')) {
      count = parsePositiveInt(arg.slice('--count='.length), 'count')
      continue
    }
    if (arg) {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return { start, count, random }
}

const { start, count, random } = parseArgs(process.argv.slice(2))
const stop = start + count - 1
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'avatars')

await mkdir(OUT_DIR, { recursive: true })

for (let i = start; i <= stop; i += 1) {
  const id = `avatar-${String(i).padStart(2, '0')}`
  const seed = random ? `${id}-${randomBytes(6).toString('hex')}` : id
  const svg = createAvatar(adventurerNeutral, { seed }).toString()
  await writeFile(path.join(OUT_DIR, `${id}.svg`), `${svg}\n`, 'utf8')
  console.log(`${id}.svg  seed=${seed}`)
}

console.log(`Wrote ${count} avatar(s) (${start}–${stop}) to ${OUT_DIR}`)
