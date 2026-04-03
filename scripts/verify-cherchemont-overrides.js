#!/usr/bin/env node
/**
 * READ-ONLY verification script for Mme Cherchemont (user_id=14) overrides.
 * Loads all user_dish_overrides and simulates BEFORE/AFTER for each dish.
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')

const USER_ID = 14

async function run() {
  console.log(`=== VERIFICATION: user_dish_overrides for user_id=${USER_ID} (Mme Cherchemont) ===\n`)

  // 1. Load all overrides for user
  const overrides = await sql`
    SELECT udo.*, d.name as dish_name
    FROM user_dish_overrides udo
    JOIN dishes d ON d.id = udo.dish_id
    WHERE udo.user_id = ${USER_ID}
    ORDER BY udo.action, d.name
  `

  console.log(`Found ${overrides.rows.length} overrides total.\n`)

  if (overrides.rows.length === 0) {
    console.log('No overrides found. Exiting.')
    process.exit(0)
  }

  // 2. Load ALL dish_ingredients for the relevant dishes
  const dishIds = overrides.rows.map(o => o.dish_id)
  const dishIngredients = await sql`
    SELECT di.dish_id, di.ingredient_id, di.quantity, di.unit, di.notes, i.name as ingredient_name
    FROM dish_ingredients di
    JOIN ingredients i ON i.id = di.ingredient_id
    WHERE di.dish_id = ANY(${dishIds})
    ORDER BY di.dish_id, i.name
  `

  // Build a map: dishId -> [{ingredient_id, ingredient_name, quantity, unit}]
  const dishIngMap = new Map()
  for (const row of dishIngredients.rows) {
    if (!dishIngMap.has(row.dish_id)) dishIngMap.set(row.dish_id, [])
    dishIngMap.get(row.dish_id).push({
      id: row.ingredient_id,
      name: row.ingredient_name,
      quantity: row.quantity,
      unit: row.unit,
      notes: row.notes
    })
  }

  // 3. Load ingredient names for all substitution targets (to_ingredient_id)
  const allToIds = new Set()
  for (const o of overrides.rows) {
    const subs = o.substitute_ingredients || []
    for (const s of subs) {
      allToIds.add(s.to_ingredient_id)
    }
  }
  let ingredientNameMap = new Map()
  if (allToIds.size > 0) {
    const ingResult = await sql`
      SELECT id, name FROM ingredients WHERE id = ANY(${[...allToIds]})
    `
    for (const row of ingResult.rows) {
      ingredientNameMap.set(row.id, row.name)
    }
  }

  // 4. Process each override
  const issues = []
  let hideCount = 0
  let modifyCount = 0

  for (const o of overrides.rows) {
    const dishId = o.dish_id
    const dishName = o.dish_name
    const action = o.action
    const customName = o.custom_name
    const removeIngredients = o.remove_ingredients || []
    const substituteIngredients = o.substitute_ingredients || []
    const linkedIngredients = dishIngMap.get(dishId) || []
    const linkedIngIds = new Set(linkedIngredients.map(i => i.id))

    const displayName = customName || dishName
    const nameChange = customName && customName !== dishName
      ? `${dishName} -> ${customName}`
      : `${dishName} (unchanged)`

    console.log(`[${dishId}] ${nameChange}`)
    console.log(`  Action: ${action}`)

    if (action === 'hide') {
      hideCount++
      if (linkedIngredients.length === 0) {
        console.log(`  (hidden dish - 0 linked ingredients)`)
      }
      console.log('')
      continue
    }

    modifyCount++

    if (linkedIngredients.length === 0) {
      const msg = `[${dishId}] ${dishName}: 0 linked ingredients - overrides won't work!`
      issues.push(msg)
      console.log(`  *** WARNING: 0 linked ingredients - overrides won't apply ***`)
      console.log('')
      continue
    }

    // Build sets of affected ingredient IDs
    const removedIds = new Set(removeIngredients.map(r => r.ingredient_id))
    const subFromIds = new Map()
    for (const s of substituteIngredients) {
      subFromIds.set(s.from_ingredient_id, s.to_ingredient_id)
    }

    // Check for issues: removals referencing non-linked ingredients
    for (const r of removeIngredients) {
      if (!linkedIngIds.has(r.ingredient_id)) {
        const msg = `[${dishId}] ${dishName}: REMOVE references ingredient_id=${r.ingredient_id} NOT in dish`
        issues.push(msg)
      }
    }

    // Check for issues: substitutions referencing non-linked ingredients
    for (const s of substituteIngredients) {
      if (!linkedIngIds.has(s.from_ingredient_id)) {
        const fromName = linkedIngredients.find(i => i.id === s.from_ingredient_id)?.name || '???'
        const toName = ingredientNameMap.get(s.to_ingredient_id) || '???'
        const msg = `[${dishId}] ${dishName}: SUBSTITUTE from_ingredient_id=${s.from_ingredient_id} NOT in dish (was: ${fromName} -> ${toName})`
        issues.push(msg)
      }
    }

    // Display BEFORE/AFTER per ingredient
    for (const ing of linkedIngredients) {
      if (removedIds.has(ing.id)) {
        console.log(`  REMOVED: ${ing.name} (id=${ing.id}) [was: ${ing.quantity}${ing.unit || ''}]`)
      } else if (subFromIds.has(ing.id)) {
        const toId = subFromIds.get(ing.id)
        const toName = ingredientNameMap.get(toId) || `??? (id=${toId})`
        console.log(`  SUBSTITUTED: ${ing.name} (id=${ing.id}) -> ${toName} (id=${toId})`)
      } else {
        console.log(`  UNCHANGED: ${ing.name} (id=${ing.id})`)
      }
    }

    // Show orphan removals (not in dish)
    for (const r of removeIngredients) {
      if (!linkedIngIds.has(r.ingredient_id)) {
        console.log(`  *** ORPHAN REMOVE: ingredient_id=${r.ingredient_id} NOT FOUND in dish ***`)
      }
    }
    // Show orphan subs
    for (const s of substituteIngredients) {
      if (!linkedIngIds.has(s.from_ingredient_id)) {
        const toName = ingredientNameMap.get(s.to_ingredient_id) || '???'
        console.log(`  *** ORPHAN SUBSTITUTE: from_id=${s.from_ingredient_id} NOT IN DISH -> ${toName} (id=${s.to_ingredient_id}) ***`)
      }
    }

    console.log('')
  }

  // 5. Summary
  console.log('='.repeat(70))
  console.log(`SUMMARY: ${overrides.rows.length} overrides (${modifyCount} modify, ${hideCount} hide)`)
  console.log('')

  if (issues.length === 0) {
    console.log('NO ISSUES FOUND - all overrides reference valid linked ingredients.')
  } else {
    console.log(`ISSUES FOUND: ${issues.length}`)
    for (const issue of issues) {
      console.log(`  !! ${issue}`)
    }
  }

  process.exit(0)
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
