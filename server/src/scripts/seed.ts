import { supabase } from '../db/supabase.js'
import dotenv from 'dotenv'

dotenv.config()

type ClueDifficulty = 'easy' | 'medium' | 'hard' | 'nightmare'

/**
 * Dev seed: mirrors whoami-datasets shape (per PRD) - name, type, is_published,
 * aliases, clues with first-person text, citation strings, and difficulty.
 * `dataset_id` is applied at insert time from the default dataset.
 */
type SeedEntity = {
  name: string
  type: 'character' | 'place'
  is_published: boolean
  /** Alternate names for guess matching; use [] when none. */
  aliases: string[]
  clues: Array<{
    text: string
    /** Single string; use "Ref A; Ref B" for multiple citations. */
    citations: string
    difficulty: ClueDifficulty
  }>
}

/**
 * At least 3 clues per entity; at least 2 sharing one difficulty tier (pool / publish rules).
 * Wording: first person; places speak as "I" / "in me". Scripture-grounded only;
 */
const SEED_ENTITIES: SeedEntity[] = [
  {
    name: 'Moses',
    type: 'character',
    is_published: true,
    aliases: [],
    clues: [
      {
        text: 'I led Israel through the sea on dry ground',
        citations: 'Exodus 14:21, 22',
        difficulty: 'easy'
      },
      {
        text: 'I received the stone tablets of the covenant on a mountain',
        citations: 'Exodus 20:1; 31:18',
        difficulty: 'easy'
      },
      {
        text: 'Pharaoh\'s daughter found me among the reeds in the Nile',
        citations: 'Exodus 2:5-10',
        difficulty: 'medium'
      }
    ]
  },
  {
    name: 'David',
    type: 'character',
    is_published: true,
    aliases: ['King David'],
    clues: [
      {
        text: 'I struck down a Philistine giant with a sling',
        citations: '1 Samuel 17:50',
        difficulty: 'easy'
      },
      {
        text: 'Jonathan became a close friend to me',
        citations: '1 Samuel 18:1',
        difficulty: 'medium'
      },
      {
        text: 'I feigned insanity before Achish of Gath',
        citations: '1 Samuel 21:13',
        difficulty: 'hard'
      }
    ]
  },
  {
    name: 'Noah',
    type: 'character',
    is_published: true,
    aliases: [],
    clues: [
      {
        text: 'I was told to build an ark of gopher wood',
        citations: 'Genesis 6:14',
        difficulty: 'easy'
      },
      {
        text: 'I was 600 years old when the floodwaters came upon the earth',
        citations: 'Genesis 7:6',
        difficulty: 'easy'
      },
      {
        text: 'I sent a dove from the ark to see if the waters had lessened',
        citations: 'Genesis 8:8-12',
        difficulty: 'medium'
      }
    ]
  },
  {
    name: 'Abraham',
    type: 'character',
    is_published: true,
    aliases: ['Abram'],
    clues: [
      {
        text: 'I left my land when I was called to go to a country I would be shown',
        citations: 'Genesis 12:1',
        difficulty: 'easy'
      },
      {
        text: 'I was told my seed would be as the stars',
        citations: 'Genesis 15:5',
        difficulty: 'easy'
      },
      {
        text: 'I raised the knife over Isaac when I was asked to offer him',
        citations: 'Genesis 22:2',
        difficulty: 'medium'
      }
    ]
  },
  {
    name: 'Jerusalem',
    type: 'place',
    is_published: true,
    aliases: [],
    clues: [
      {
        text: 'Solomon built the temple in me',
        citations: '2 Chronicles 3:1',
        difficulty: 'easy'
      },
      {
        text: 'David took up residence in me and made me his capital',
        citations: '2 Samuel 5:7',
        difficulty: 'easy'
      },
      {
        text: 'They put him to death outside of me, near the Skull Place',
        citations: 'John 19:17, 18',
        difficulty: 'medium'
      }
    ]
  },
  {
    name: 'Gethsemane',
    type: 'place',
    is_published: true,
    aliases: [],
    clues: [
      {
        text: 'Jesus often met with his disciples in me, at the base of the Mount of Olives',
        citations: 'Luke 22:39',
        difficulty: 'easy'
      },
      {
        text: 'In me he prayed until his sweat became like drops of blood',
        citations: 'Luke 22:44',
        difficulty: 'medium'
      },
      {
        text: 'In me Judas led the crowd and betrayed him with a kiss',
        citations: 'Matthew 26:47-49',
        difficulty: 'hard'
      }
    ]
  }
]

async function seed() {
  console.log('Starting seed...')

  try {
    const datasetId = await resolveDefaultDatasetId()
    if (!datasetId) {
      throw new Error(
        'No enabled dataset found. Run `npm run db:create-default-dataset` first to bootstrap one.'
      )
    }
    console.log(`Using default dataset: ${datasetId}`)

    for (const def of SEED_ENTITIES) {
      const { data: existing } = await supabase
        .from('entities')
        .select('id')
        .eq('dataset_id', datasetId)
        .eq('name', def.name)
        .maybeSingle()

      const entityRow = {
        name: def.name,
        type: def.type,
        is_published: def.is_published,
        dataset_id: datasetId,
        aliases: def.aliases
      }

      let entityId: string
      if (existing) {
        const { data, error } = await supabase
          .from('entities')
          .update(entityRow)
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error
        entityId = data.id
        console.log(`Updated entity: ${def.name}`)
      } else {
        const { data, error } = await supabase
          .from('entities')
          .insert(entityRow)
          .select()
          .single()

        if (error) throw error
        entityId = data.id
        console.log(`Created entity: ${def.name}`)
      }

      const { error: delErr } = await supabase.from('clues').delete().eq('entity_id', entityId)
      if (delErr) throw delErr

      for (let i = 0; i < def.clues.length; i++) {
        const clue = def.clues[i]
        const { error: insErr } = await supabase
          .from('clues')
          .insert({
            entity_id: entityId,
            text: clue.text,
            citations: clue.citations,
            difficulty: clue.difficulty
          })
          .select()
          .single()

        if (insErr) throw insErr
        console.log(`  Clue ${i + 1}/${def.clues.length} (${clue.difficulty})`)
      }
    }

    console.log('Seed completed successfully!')
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  }
}

async function resolveDefaultDatasetId(): Promise<string | null> {
  const { data: byDefault } = await supabase
    .from('datasets')
    .select('id')
    .eq('is_default', true)
    .eq('is_enabled', true)
    .maybeSingle()

  if (byDefault?.id) return byDefault.id

  const { data: byEnabled } = await supabase
    .from('datasets')
    .select('id')
    .eq('is_enabled', true)
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle()

  return byEnabled?.id ?? null
}

seed().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})

export { seed, SEED_ENTITIES }
