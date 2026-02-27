import { supabase } from '../db/supabase.js'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Dev seeding script - populates Supabase with test data
 * This script is idempotent and safe to run multiple times
 */
async function seed() {
  console.log('Starting seed...')

  try {
    // Sample entities for testing
    const entities = [
      {
        name: 'Moses',
        type: 'character',
        difficulty: 'easy',
        is_published: true
      },
      {
        name: 'David',
        type: 'character',
        difficulty: 'easy',
        is_published: true
      },
      {
        name: 'Noah',
        type: 'character',
        difficulty: 'easy',
        is_published: true
      },
      {
        name: 'Abraham',
        type: 'character',
        difficulty: 'medium',
        is_published: true
      },
      {
        name: 'Jerusalem',
        type: 'place',
        difficulty: 'medium',
        is_published: true
      },
      {
        name: 'Gethsemane',
        type: 'place',
        difficulty: 'hard',
        is_published: true
      }
    ]

    // Insert entities (with conflict handling)
    for (const entity of entities) {
      const { data: existing } = await supabase
        .from('entities')
        .select('id')
        .eq('name', entity.name)
        .single()

      let entityId
      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('entities')
          .update(entity)
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error
        entityId = data.id
        console.log(`Updated entity: ${entity.name}`)
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('entities')
          .insert(entity)
          .select()
          .single()

        if (error) throw error
        entityId = data.id
        console.log(`Created entity: ${entity.name}`)
      }

      // Add clues for each entity
      const clues = getCluesForEntity(entity.name)
      for (let i = 0; i < clues.length; i++) {
        const clue = clues[i]
        const { data: existingClue } = await supabase
          .from('clues')
          .select('id')
          .eq('entity_id', entityId)
          .eq('order', i + 1)
          .single()

        // Extract citations string from clue data
        const citations = clue.citations || null

        if (existingClue) {
          await supabase
            .from('clues')
            .update({
              text: clue.text,
              citations: citations,
              difficulty: clue.difficulty || null
            })
            .eq('id', existingClue.id)
          console.log(`  Updated clue ${i + 1}`)
        } else {
          const { data: newClue, error } = await supabase
            .from('clues')
            .insert({
              entity_id: entityId,
              order: i + 1,
              text: clue.text,
              citations: citations,
              difficulty: clue.difficulty || null
            })
            .select()
            .single()

          if (error) throw error
          console.log(`  Created clue ${i + 1}`)
        }
      }
    }

    console.log('Seed completed successfully!')
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  }
}

/**
 * Get clues for an entity (sample data)
 */
function getCluesForEntity(entityName) {
  const clueMap = {
    'Moses': [
      {
        text: 'I led the Israelites out of Egypt',
        citations: 'Exodus 14:21'
      },
      {
        text: 'I received the Ten Commandments on Mount Sinai',
        citations: 'Exodus 20:1'
      },
      {
        text: 'I was hidden in a basket as a baby',
        citations: 'Exodus 2:3'
      }
    ],
    'David': [
      {
        text: 'I defeated a giant with a sling and stone',
        citations: '1 Samuel 17:50'
      },
      {
        text: 'I was a shepherd before becoming king',
        citations: '1 Samuel 16:11'
      },
      {
        text: 'I wrote many psalms',
        citations: 'Psalm 23:1'
      }
    ],
    'Noah': [
      {
        text: 'I built an ark to save animals from a flood',
        citations: 'Genesis 6:14'
      },
      {
        text: 'I was 600 years old when the flood came',
        citations: 'Genesis 7:6'
      },
      {
        text: 'God made a covenant with me using a rainbow',
        citations: 'Genesis 9:13'
      }
    ],
    'Abraham': [
      {
        text: 'I was called to leave my homeland',
        citations: 'Genesis 12:1'
      },
      {
        text: 'I was promised descendants as numerous as the stars',
        citations: 'Genesis 15:5'
      },
      {
        text: 'I was willing to sacrifice my son Isaac',
        citations: 'Genesis 22:2'
      }
    ],
    'Jerusalem': [
      {
        text: 'I am the holy city where the temple was built',
        citations: '2 Chronicles 3:1'
      },
      {
        text: 'I am also known as the City of David',
        citations: '2 Samuel 5:7'
      },
      {
        text: 'They put him to death outside of me, near the Skull Place',
        citations: 'John 19:20'
      }
    ],
    'Gethsemane': [
      {
        text: 'I am a garden where Jesus prayed before his arrest',
        citations: 'Matthew 26:36'
      },
      {
        text: 'I am located on the Mount of Olives',
        citations: 'Luke 22:39'
      },
      {
        text: 'Jesus was betrayed here by Judas',
        citations: 'Matthew 26:47'
      }
    ]
  }

  return clueMap[entityName] || []
}

// Run seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
}

export { seed }
