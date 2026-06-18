#!/usr/bin/env node
/**
 * Ajoute 'ete' à dishes.seasons pour les 24 plats recyclés de l'été 2026.
 * Aucune création, aucune modification de nom/ingrédients.
 * Idempotent : skip les plats déjà tagués 'ete' ou 'toutes'.
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { sql } = require('@vercel/postgres')

const JSON_IN = path.join(__dirname, 'ete-2026-plats.json')

async function main() {
  const data = JSON.parse(fs.readFileSync(JSON_IN, 'utf8'))
  const recycled = data.recycled.filter(r => r.matched)

  console.log(`🌞 Extension saison 'ete' pour ${recycled.length} plats recyclés\n`)

  let extended = 0, alreadyOk = 0, failed = 0
  for (const r of recycled) {
    try {
      const before = await sql`SELECT seasons FROM dishes WHERE id = ${r.matched.id}`
      const cur = Array.isArray(before.rows[0].seasons)
        ? before.rows[0].seasons
        : JSON.parse(before.rows[0].seasons || '[]')

      if (cur.includes('ete') || cur.includes('toutes')) {
        console.log(`  ✓  [${r.matched.id}] ${r.matched.name} — déjà visible été (${cur.join(',')})`)
        alreadyOk++
        continue
      }

      await sql`
        UPDATE dishes
        SET seasons = (seasons - 'toutes') || '["ete"]'::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${r.matched.id}
      `

      const after = await sql`SELECT seasons FROM dishes WHERE id = ${r.matched.id}`
      const newSeasons = Array.isArray(after.rows[0].seasons)
        ? after.rows[0].seasons
        : JSON.parse(after.rows[0].seasons || '[]')
      console.log(`  ➕ [${r.matched.id}] ${r.matched.name}`)
      console.log(`       ${cur.join(',')} → ${newSeasons.join(',')}`)
      extended++
    } catch (e) {
      console.log(`  ❌ [${r.matched.id}] ${r.matched.name} — ${e.message.substring(0, 80)}`)
      failed++
    }
  }

  console.log()
  console.log(`📊 ${extended} étendus, ${alreadyOk} déjà OK, ${failed} échecs`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
