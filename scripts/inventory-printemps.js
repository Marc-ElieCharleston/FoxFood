#!/usr/bin/env node
/**
 * READ-ONLY script: Inventory of all active printemps dishes and their linked ingredients.
 * Flags dishes containing crème fraîche, farine, lait, or fromage ingredients.
 */
require('dotenv').config()
const { sql } = require('@vercel/postgres')

// --- Ingredient IDs to flag ---
const CREME_FRAICHE_IDS = new Set([17, 171, 211])
const FARINE_IDS = new Set([26])

// Fromage IDs (known)
const FROMAGE_IDS = new Set([
  20, 212, 69, 383,   // Parmesan variants
  21, 175, 337, 375,   // Mozzarella variants
  293,                  // Ricotta
  234,                  // Boursin
  202,                  // Chevre buche
  219,                  // Burrata
])

async function main() {
  try {
    // 1) Get all active printemps/toutes dishes
    const dishesResult = await sql`
      SELECT id, name, category, description, seasons, kids_food
      FROM dishes
      WHERE active = true
        AND (seasons @> '"printemps"'::jsonb OR seasons @> '"toutes"'::jsonb)
      ORDER BY category, name
    `
    const dishes = dishesResult.rows
    console.log(`\n=== Found ${dishes.length} active printemps/toutes dishes ===\n`)

    // 2) Get ALL dish_ingredients for these dishes in one query
    const dishIds = dishes.map(d => d.id)
    if (dishIds.length === 0) {
      console.log('No dishes found.')
      return
    }

    const ingredientsResult = await sql`
      SELECT
        di.dish_id,
        di.ingredient_id,
        di.quantity,
        di.unit,
        di.notes,
        i.name as ingredient_name,
        i.category as ingredient_category,
        i.dietary_tags
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE di.dish_id = ANY(${dishIds})
      ORDER BY di.dish_id, i.category, i.name
    `

    // 3) Find additional lait and fromage ingredients from DB
    const laitResult = await sql`
      SELECT id, name FROM ingredients
      WHERE LOWER(name) LIKE '%lait%'
        AND LOWER(name) NOT LIKE '%lait de coco%'
        AND LOWER(name) NOT LIKE '%lait de soja%'
        AND LOWER(name) NOT LIKE '%lait d''amande%'
        AND LOWER(name) NOT LIKE '%lait de soja ou amande%'
      ORDER BY name
    `
    const LAIT_IDS = new Set(laitResult.rows.map(r => r.id))
    console.log('--- Lait ingredients detected ---')
    laitResult.rows.forEach(r => console.log(`  ID ${r.id}: ${r.name}`))

    const fromageResult = await sql`
      SELECT id, name FROM ingredients
      WHERE (
        LOWER(name) LIKE '%fromage%'
        OR LOWER(name) LIKE '%parmesan%'
        OR LOWER(name) LIKE '%mozzarella%'
        OR LOWER(name) LIKE '%ricotta%'
        OR LOWER(name) LIKE '%boursin%'
        OR LOWER(name) LIKE '%comté%'
        OR LOWER(name) LIKE '%comte%'
        OR LOWER(name) LIKE '%gruyère%'
        OR LOWER(name) LIKE '%gruyere%'
        OR LOWER(name) LIKE '%emmental%'
        OR LOWER(name) LIKE '%chevre%'
        OR LOWER(name) LIKE '%chèvre%'
        OR LOWER(name) LIKE '%burrata%'
        OR LOWER(name) LIKE '%cheddar%'
        OR LOWER(name) LIKE '%feta%'
        OR LOWER(name) LIKE '%roquefort%'
        OR LOWER(name) LIKE '%camembert%'
        OR LOWER(name) LIKE '%brie%'
        OR LOWER(name) LIKE '%reblochon%'
        OR LOWER(name) LIKE '%raclette%'
        OR LOWER(name) LIKE '%mascarpone%'
        OR LOWER(name) LIKE '%gorgonzola%'
        OR LOWER(name) LIKE '%pecorino%'
        OR LOWER(name) LIKE '%copeau%'
        OR LOWER(name) LIKE '%cancoillotte%'
      )
      AND LOWER(name) NOT LIKE '%brebis%'
      ORDER BY name
    `
    // Merge with known IDs
    fromageResult.rows.forEach(r => FROMAGE_IDS.add(r.id))
    console.log('\n--- Fromage (cow cheese) ingredients detected ---')
    const allFromage = fromageResult.rows.concat(
      [...FROMAGE_IDS].filter(id => !fromageResult.rows.find(r => r.id === id)).map(id => ({ id, name: '(pre-listed)' }))
    )
    // Deduplicate and show
    const fromageMap = new Map()
    fromageResult.rows.forEach(r => fromageMap.set(r.id, r.name))
    fromageMap.forEach((name, id) => console.log(`  ID ${id}: ${name}`))

    // Also check for creme fraiche ingredients beyond hardcoded
    const cremeResult = await sql`
      SELECT id, name FROM ingredients
      WHERE (LOWER(name) LIKE '%creme fraiche%' OR LOWER(name) LIKE '%crème fraîche%' OR LOWER(name) LIKE '%creme fraîche%')
      ORDER BY name
    `
    cremeResult.rows.forEach(r => CREME_FRAICHE_IDS.add(r.id))
    console.log('\n--- Crème fraîche ingredients detected ---')
    cremeResult.rows.forEach(r => console.log(`  ID ${r.id}: ${r.name}`))

    // Also check for farine
    const farineResult = await sql`
      SELECT id, name FROM ingredients
      WHERE LOWER(name) LIKE '%farine%'
      ORDER BY name
    `
    farineResult.rows.forEach(r => FARINE_IDS.add(r.id))
    console.log('\n--- Farine ingredients detected ---')
    farineResult.rows.forEach(r => console.log(`  ID ${r.id}: ${r.name}`))

    console.log('\n')

    // 4) Group ingredients by dish
    const dishIngredients = new Map()
    ingredientsResult.rows.forEach(row => {
      if (!dishIngredients.has(row.dish_id)) dishIngredients.set(row.dish_id, [])
      dishIngredients.get(row.dish_id).push(row)
    })

    // 5) Output structured results
    let dishesWithIngredients = 0
    let dishesWithoutIngredients = 0
    const flaggedDishes = []

    for (const dish of dishes) {
      const ings = dishIngredients.get(dish.id) || []
      if (ings.length === 0) {
        dishesWithoutIngredients++
        continue
      }
      dishesWithIngredients++

      // Check flags
      const flags = []
      const flagDetails = { creme: [], farine: [], lait: [], fromage: [] }

      for (const ing of ings) {
        if (CREME_FRAICHE_IDS.has(ing.ingredient_id)) {
          flags.push('CRÈME FRAÎCHE')
          flagDetails.creme.push(`${ing.ingredient_name} (ID:${ing.ingredient_id})`)
        }
        if (FARINE_IDS.has(ing.ingredient_id)) {
          flags.push('FARINE')
          flagDetails.farine.push(`${ing.ingredient_name} (ID:${ing.ingredient_id})`)
        }
        if (LAIT_IDS.has(ing.ingredient_id)) {
          flags.push('LAIT')
          flagDetails.lait.push(`${ing.ingredient_name} (ID:${ing.ingredient_id})`)
        }
        if (FROMAGE_IDS.has(ing.ingredient_id)) {
          flags.push('FROMAGE')
          flagDetails.fromage.push(`${ing.ingredient_name} (ID:${ing.ingredient_id})`)
        }
      }

      const uniqueFlags = [...new Set(flags)]

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`DISH ID: ${dish.id} | ${dish.name}`)
      console.log(`Category: ${dish.category} | Seasons: ${JSON.stringify(dish.seasons)} | Kids: ${dish.kids_food ? 'yes' : 'no'}`)
      if (uniqueFlags.length > 0) {
        console.log(`⚠ FLAGS: ${uniqueFlags.join(', ')}`)
        if (flagDetails.creme.length) console.log(`  → Crème fraîche: ${flagDetails.creme.join(', ')}`)
        if (flagDetails.farine.length) console.log(`  → Farine: ${flagDetails.farine.join(', ')}`)
        if (flagDetails.lait.length) console.log(`  → Lait: ${flagDetails.lait.join(', ')}`)
        if (flagDetails.fromage.length) console.log(`  → Fromage: ${flagDetails.fromage.join(', ')}`)
        flaggedDishes.push({ id: dish.id, name: dish.name, flags: uniqueFlags, flagDetails })
      }
      console.log(`Ingredients (${ings.length}):`)
      for (const ing of ings) {
        const marker = (CREME_FRAICHE_IDS.has(ing.ingredient_id) || FARINE_IDS.has(ing.ingredient_id) || LAIT_IDS.has(ing.ingredient_id) || FROMAGE_IDS.has(ing.ingredient_id)) ? ' ◄' : ''
        console.log(`  [${ing.ingredient_id}] ${ing.ingredient_name} — ${ing.quantity} ${ing.unit}${ing.notes ? ' (' + ing.notes + ')' : ''}${marker}`)
      }
      console.log('')
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`)
    console.log(`SUMMARY`)
    console.log(`${'='.repeat(60)}`)
    console.log(`Total active printemps/toutes dishes: ${dishes.length}`)
    console.log(`Dishes WITH linked ingredients: ${dishesWithIngredients}`)
    console.log(`Dishes WITHOUT linked ingredients: ${dishesWithoutIngredients}`)
    console.log(`Dishes flagged (contain replaceable ingredients): ${flaggedDishes.length}`)
    console.log('')

    if (dishesWithoutIngredients > 0) {
      console.log(`\n--- Dishes WITHOUT ingredients (skipped above) ---`)
      for (const dish of dishes) {
        const ings = dishIngredients.get(dish.id) || []
        if (ings.length === 0) {
          console.log(`  ID ${dish.id}: ${dish.name} [${dish.category}]`)
        }
      }
    }

    console.log(`\n--- FLAGGED DISHES SUMMARY ---`)
    for (const fd of flaggedDishes) {
      console.log(`  ID ${fd.id}: ${fd.name} → ${fd.flags.join(', ')}`)
    }

    process.exit(0)
  } catch (error) {
    console.error('ERROR:', error)
    process.exit(1)
  }
}

main()
