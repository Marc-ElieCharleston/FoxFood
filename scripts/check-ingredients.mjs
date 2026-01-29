/**
 * Script pour vérifier les ingrédients dans la base
 */

import { sql } from '@vercel/postgres'

async function checkIngredients() {
  console.log('🔍 Vérification des ingrédients...\n')

  try {
    // Chercher tous les ingrédients avec "crème" dans le nom
    const cremeResults = await sql`
      SELECT id, name, category, default_unit
      FROM ingredients
      WHERE LOWER(name) LIKE '%crème%' OR LOWER(name) LIKE '%creme%'
      ORDER BY name
    `

    console.log('📋 Ingrédients contenant "crème":')
    if (cremeResults.rows.length > 0) {
      cremeResults.rows.forEach(ing => {
        console.log(`  - ID: ${ing.id}, Nom: "${ing.name}", Catégorie: ${ing.category}, Unité: ${ing.default_unit}`)
      })
    } else {
      console.log('  Aucun trouvé')
    }

    console.log('\n📋 Ingrédients contenant "lait":')
    const laitResults = await sql`
      SELECT id, name, category, default_unit
      FROM ingredients
      WHERE LOWER(name) LIKE '%lait%'
      ORDER BY name
    `

    if (laitResults.rows.length > 0) {
      laitResults.rows.forEach(ing => {
        console.log(`  - ID: ${ing.id}, Nom: "${ing.name}", Catégorie: ${ing.category}, Unité: ${ing.default_unit}`)
      })
    } else {
      console.log('  Aucun trouvé')
    }

    // Vérifier les remplacements de Marie (supposons user_id = 2 ou 3)
    console.log('\n📋 Remplacements configurés par les utilisateurs:')
    const replacementsResults = await sql`
      SELECT
        u.id as user_id,
        u.name as user_name,
        oi.name as original,
        ri.name as replacement
      FROM user_ingredient_replacements r
      JOIN users u ON r.user_id = u.id
      JOIN ingredients oi ON r.original_ingredient_id = oi.id
      JOIN ingredients ri ON r.replacement_ingredient_id = ri.id
      ORDER BY u.name, oi.name
    `

    if (replacementsResults.rows.length > 0) {
      replacementsResults.rows.forEach(r => {
        console.log(`  - ${r.user_name} (ID: ${r.user_id}): "${r.original}" → "${r.replacement}"`)
      })
    } else {
      console.log('  Aucun remplacement configuré')
    }

  } catch (error) {
    console.error('\n❌ Erreur:', error)
    process.exit(1)
  }

  process.exit(0)
}

checkIngredients()
