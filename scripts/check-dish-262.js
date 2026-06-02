#!/usr/bin/env node
require('dotenv').config()
const { sql } = require('@vercel/postgres')

const USER_ID = 14
const DISH_ID = 262

async function main() {
  console.log(`\n=== Check plat ${DISH_ID} pour user ${USER_ID} ===\n`)

  // 1. Le plat lui-même
  const dish = (await sql`SELECT id, name, description FROM dishes WHERE id = ${DISH_ID}`).rows[0]
  console.log(`Plat: ${dish.name}\n`)

  // 2. Ingrédients liés (dish_ingredients)
  const dishIngs = await sql`
    SELECT di.ingredient_id, i.name, di.quantity, di.unit
    FROM dish_ingredients di
    JOIN ingredients i ON i.id = di.ingredient_id
    WHERE di.dish_id = ${DISH_ID}
    ORDER BY i.name
  `
  console.log(`Ingrédients officiellement liés au plat (${dishIngs.rows.length}):`)
  dishIngs.rows.forEach(i => console.log(`  [${i.ingredient_id}] ${i.name} — ${i.quantity || ''} ${i.unit || ''}`))

  // 3. L'override de Mme Cherchemont
  const override = (await sql`
    SELECT custom_name, remove_ingredients, substitute_ingredients, action
    FROM user_dish_overrides
    WHERE user_id = ${USER_ID} AND dish_id = ${DISH_ID}
  `).rows[0]

  console.log(`\nOverride Mme Cherchemont:`)
  if (!override) {
    console.log('  (aucun)')
  } else {
    console.log(`  action: ${override.action}`)
    console.log(`  custom_name: ${override.custom_name || '(aucun)'}`)
    console.log(`  remove_ingredients:`, override.remove_ingredients)
    console.log(`  substitute_ingredients:`, override.substitute_ingredients)
  }

  // 4. Simuler ce que Mme C. voit (logique du GET /api/dishes)
  console.log(`\nCe que Mme Cherchemont voit après application de l'override:`)
  let visible = [...dishIngs.rows]

  if (override) {
    // Retraits
    const removeIds = (override.remove_ingredients || []).map(r => r.ingredient_id)
    visible = visible.filter(ing => !removeIds.includes(ing.ingredient_id))

    // Substitutions
    const subs = override.substitute_ingredients || []
    const subMap = new Map(subs.map(s => [s.from_ingredient_id, s.to_ingredient_id]))
    const toIds = subs.map(s => s.to_ingredient_id)
    let replMap = new Map()
    if (toIds.length > 0) {
      const repls = await sql`SELECT id, name FROM ingredients WHERE id = ANY(${toIds})`
      replMap = new Map(repls.rows.map(r => [r.id, r]))
    }
    visible = visible.map(ing => {
      const toId = subMap.get(ing.ingredient_id)
      if (toId) {
        const r = replMap.get(toId)
        if (r) return { ...ing, ingredient_id: r.id, name: r.name + ' (remplacé)' }
      }
      return ing
    })
  }

  visible.forEach(i => console.log(`  [${i.ingredient_id}] ${i.name} — ${i.quantity || ''} ${i.unit || ''}`))

  // 5. Vérifier spécifiquement: ingrédient id 97 (Riz thai) est-il bien dans les liés ?
  console.log(`\nDiagnostic ciblé:`)
  const has97 = dishIngs.rows.some(i => i.ingredient_id === 97)
  console.log(`  Riz thai (id 97) lié au plat ? ${has97 ? '✓ oui' : '✗ NON'}`)
  if (!has97) {
    console.log(`  ⚠️  La substitution 97→415 ne s'applique donc PAS — l'override ne fait rien.`)
    // Chercher dans tous les ingrédients du plat ceux contenant "riz"
    const rizIngs = dishIngs.rows.filter(i => i.name.toLowerCase().includes('riz'))
    if (rizIngs.length > 0) {
      console.log(`  En revanche, le plat contient ces ingrédients "riz":`)
      rizIngs.forEach(i => console.log(`    [${i.ingredient_id}] ${i.name}`))
    } else {
      console.log(`  Aucun ingrédient contenant "riz" trouvé dans le plat (peut-être pas de lien dish_ingredients du tout).`)
    }
  }

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
