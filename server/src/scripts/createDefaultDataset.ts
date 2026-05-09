import { supabase } from '../db/supabase.js'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Bootstrap script: create the first dataset and backfill any existing entities
 * into it. Mirrors the `addAdmin.js` pattern — schema lives in migrations, but
 * initial content is created intentionally via a script rather than implicitly.
 *
 * Usage:
 *   tsx src/scripts/createDefaultDataset.ts [--name "..."] [--source "..."]
 *
 * The script is idempotent:
 *   - if a dataset with the given name (case-insensitive) already exists, reuse it
 *   - if any entities exist with NULL dataset_id, point them at this dataset
 */

interface Options {
  name: string
  source: string | null
  description: string | null
  makeDefault: boolean
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    name: 'Bible - characters & places (NWT)',
    source: 'New World Translation',
    description:
      'Default dataset of biblical characters and places, scripture-grounded clues from the New World Translation.',
    makeDefault: true
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--name' && argv[i + 1]) {
      opts.name = argv[++i]
    } else if (arg === '--source' && argv[i + 1]) {
      opts.source = argv[++i]
    } else if (arg === '--description' && argv[i + 1]) {
      opts.description = argv[++i]
    } else if (arg === '--no-default') {
      opts.makeDefault = false
    }
  }

  return opts
}

async function run() {
  const opts = parseArgs(process.argv.slice(2))

  console.log('Bootstrapping default dataset...')
  console.log(`  Name: ${opts.name}`)
  console.log(`  Source: ${opts.source ?? '(none)'}`)
  console.log(`  is_default: ${opts.makeDefault}`)

  const { data: existing, error: lookupError } = await supabase
    .from('datasets')
    .select('id, name, is_default, is_enabled')
    .ilike('name', opts.name)
    .maybeSingle()

  if (lookupError) {
    throw new Error(`Failed to look up existing dataset: ${lookupError.message}`)
  }

  let datasetId: string
  if (existing) {
    datasetId = existing.id
    console.log(`Found existing dataset "${existing.name}" (${datasetId}), reusing.`)

    if (opts.makeDefault && !existing.is_default) {
      const { error: updateError } = await supabase
        .from('datasets')
        .update({ is_default: true, is_enabled: true })
        .eq('id', datasetId)

      if (updateError) {
        throw new Error(`Failed to mark dataset as default: ${updateError.message}`)
      }
      console.log('Marked existing dataset as default.')
    }
  } else {
    const { data: created, error: insertError } = await supabase
      .from('datasets')
      .insert({
        name: opts.name,
        source: opts.source,
        description: opts.description,
        is_official: true,
        is_enabled: true,
        is_default: opts.makeDefault
      })
      .select('id')
      .single()

    if (insertError) {
      throw new Error(`Failed to create dataset: ${insertError.message}`)
    }

    datasetId = created.id
    console.log(`Created dataset "${opts.name}" (${datasetId}).`)
  }

  const { count: orphanCount, error: countError } = await supabase
    .from('entities')
    .select('id', { count: 'exact', head: true })
    .is('dataset_id', null)

  if (countError) {
    throw new Error(`Failed to count entities without dataset_id: ${countError.message}`)
  }

  if ((orphanCount ?? 0) > 0) {
    console.log(`Backfilling ${orphanCount} entit${orphanCount === 1 ? 'y' : 'ies'} into this dataset...`)
    const { error: backfillError } = await supabase
      .from('entities')
      .update({ dataset_id: datasetId })
      .is('dataset_id', null)

    if (backfillError) {
      throw new Error(`Failed to backfill entities: ${backfillError.message}`)
    }
    console.log('Backfill complete.')
  } else {
    console.log('No entities required backfill.')
  }

  console.log('Default dataset is ready.')
}

run().catch((error) => {
  console.error('Failed to bootstrap default dataset:', error)
  process.exit(1)
})
