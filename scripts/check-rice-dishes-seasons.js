#!/usr/bin/env node
require('dotenv').config()
const { sql } = require('@vercel/postgres')

const USER_ID = 14

async function main() {
  console.log('\n=== Saisons des plats avec "riz" SANS override pour Mme Cherchemont ===\n')


  const rows = await sql`
    SELECT
      d.id,
      d.name,
      d.seasons,
      d.active,
      udo.dish_id IS NOT NULL AS has_override
    FROM dishes d
    LEFT JOIN user_dish_overrides udo
      ON udo.dish_id = d.id AND udo.user_id = ${USER_ID}
    WHERE d.active = true
      AND (d.name ILIKE '%riz%' OR d.name ILIKE '%risotto%' OR d.name ILIKE '%paella%')
      AND udo.dish_id IS NULL
    ORDER BY d.name
  `

  console.log(`${rows.rows.length} plats avec "riz/risotto/paella" dans le nom, SANS override:\n`)
  rows.rows.forEach(r => {
    const seasons = Array.isArray(r.seasons) ? r.seasons : (r.seasons ? JSON.parse(r.seasons) : [])
    const seasonStr = seasons.join(', ')
    const visibleInSpring = seasons.includes('printemps') || seasons.includes('toutes')
    const tag = visibleInSpring ? '🌱 VISIBLE printemps' : '⛔ pas printemps'
    console.log(`  ${tag}  [${r.id}] ${r.name}`)
    console.log(`     saisons: ${seasonStr}`)
  })

  console.log('\n📌 Rappel : le script setup-cherchemont-overrides.js filtre uniquement les plats printemps + toutes.')
  console.log('   Les plats hors saison ne sont pas visibles pour Mme Cherchemont en ce moment.')

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
