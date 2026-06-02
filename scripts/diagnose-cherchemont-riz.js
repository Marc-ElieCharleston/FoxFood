#!/usr/bin/env node
require('dotenv').config()
const { sql } = require('@vercel/postgres')

const USER_ID = 14

async function main() {
  console.log('\n=== Diagnostic plats Mme Cherchemont contenant "riz" dans le nom ===\n')

  // Récupérer tous les plats actifs dont le nom contient "riz" OU "risotto"
  // et croiser avec ses overrides
  const rows = await sql`
    SELECT
      d.id,
      d.name AS dish_name,
      udo.custom_name,
      udo.substitute_ingredients,
      udo.action
    FROM dishes d
    LEFT JOIN user_dish_overrides udo
      ON udo.dish_id = d.id AND udo.user_id = ${USER_ID}
    WHERE d.active = true
      AND (d.name ILIKE '%riz%' OR d.name ILIKE '%risotto%' OR d.name ILIKE '%nasi%' OR d.name ILIKE '%paella%' OR d.name ILIKE '%mujadara%' OR d.name ILIKE '%maf%')
    ORDER BY d.name
  `

  console.log(`${rows.rows.length} plat(s) candidat(s) (nom contenant riz/risotto/nasi/paella/mujadara/mafé):\n`)

  for (const r of rows.rows) {
    const subs = r.substitute_ingredients || []
    const hasRiceSub = subs.some(s => [23, 97, 217, 331, 405].includes(s.from_ingredient_id)) // riz IDs
    const status = r.action === 'hide' ? '🚫 masqué' :
                   r.custom_name ? `✏️  renommé en "${r.custom_name}"` :
                   hasRiceSub ? '⚠️  RIZ REMPLACÉ mais nom non modifié' :
                   r.action ? '📝 override (sans renommage)' : '— aucun override'
    console.log(`  [${r.id}] ${r.dish_name}`)
    console.log(`         ${status}`)
    if (hasRiceSub && !r.custom_name && r.action !== 'hide') {
      // Détailler les substitutions de riz
      const riceSubs = subs.filter(s => [23, 97, 217, 331, 405].includes(s.from_ingredient_id))
      for (const sub of riceSubs) {
        const fromName = (await sql`SELECT name FROM ingredients WHERE id = ${sub.from_ingredient_id}`).rows[0]?.name || `id=${sub.from_ingredient_id}`
        const toName = (await sql`SELECT name FROM ingredients WHERE id = ${sub.to_ingredient_id}`).rows[0]?.name || `id=${sub.to_ingredient_id}`
        console.log(`         → ${fromName} remplacé par ${toName}`)
      }
    }
    console.log()
  }

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
