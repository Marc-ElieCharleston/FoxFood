#!/usr/bin/env node
require('dotenv').config()
const { sql } = require('@vercel/postgres')

const USER_ID = 14

const RENAMES = [
  { dishId: 230, customName: 'Curry de courgette au chorizo & haricots rouges' },
  { dishId: 291, customName: 'Mafé aux haricots rouges & sarrasin' },
  { dishId: 284, customName: 'Mujadara au konjac' },
  { dishId: 300, customName: 'Nasi Goreng au konjac' },
  { dishId: 298, customName: 'Paella végétarienne au tofu (quinoa)' },
  { dishId: 175, customName: 'Risotto de konjac au potiron' },
  { dishId: 295, customName: 'Risotto de konjac aux asperges' },
  { dishId: 211, customName: 'Risotto de konjac aux crevettes, butternut & champignons' },
  { dishId: 299, customName: 'Risotto de konjac à la milanaise' },
  { dishId: 248, customName: 'Salade de sarrasin thaï au poulet' },
  { dishId: 262, customName: 'Salade tahitienne au saumon & konjac' },
]

async function main() {
  console.log(`\n=== Renommage de ${RENAMES.length} plats pour Mme Cherchemont (user ${USER_ID}) ===\n`)

  let updated = 0
  let skipped = 0
  const issues = []

  for (const { dishId, customName } of RENAMES) {
    // Récupérer l'override existant
    const existing = await sql`
      SELECT id, action, custom_name FROM user_dish_overrides
      WHERE user_id = ${USER_ID} AND dish_id = ${dishId}
    `

    if (existing.rows.length === 0) {
      issues.push({ dishId, customName, reason: 'aucun override existant pour ce plat' })
      console.log(`  ⚠️  [${dishId}] AUCUN override trouvé — skip`)
      skipped++
      continue
    }

    const before = existing.rows[0].custom_name
    await sql`
      UPDATE user_dish_overrides
      SET custom_name = ${customName}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${USER_ID} AND dish_id = ${dishId}
    `
    console.log(`  ✓ [${dishId}] "${before || '(null)'}" → "${customName}"`)
    updated++
  }

  console.log(`\n📊 ${updated} mis à jour, ${skipped} ignoré(s)`)
  if (issues.length > 0) {
    console.log('\n⚠️  Problèmes:')
    issues.forEach(i => console.log(`   - dish ${i.dishId}: ${i.reason}`))
  }

  // Vérification finale
  console.log('\n=== Vérification ===')
  const ids = RENAMES.map(r => r.dishId)
  const check = await sql`
    SELECT d.id, d.name AS dish_name, udo.custom_name
    FROM dishes d
    LEFT JOIN user_dish_overrides udo ON udo.dish_id = d.id AND udo.user_id = ${USER_ID}
    WHERE d.id = ANY(${ids})
    ORDER BY d.id
  `
  check.rows.forEach(r => {
    const expected = RENAMES.find(x => x.dishId === r.id).customName
    const ok = r.custom_name === expected
    const icon = ok ? '✓' : '❌'
    console.log(`  ${icon} [${r.id}] "${r.dish_name}" → "${r.custom_name || '(null)'}"`)
    if (!ok) console.log(`        attendu: "${expected}"`)
  })

  process.exit(0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
