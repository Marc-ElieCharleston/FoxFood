/**
 * Script pour tester les remplacements dans l'historique
 * Simule l'appel à /api/shopping-list comme le fait HistoryModal
 */

import { sql } from '@vercel/postgres'

async function testHistoryReplacements() {
  console.log('🧪 Test des remplacements dans l\'historique\n')

  try {
    const marieId = 14

    // 1. Trouver un plat avec crème fraîche
    console.log('🔍 Recherche d\'un plat avec crème fraîche...')

    const dishResult = await sql`
      SELECT DISTINCT
        d.id as dish_id,
        d.name as dish_name,
        dv.id as variant_id
      FROM dishes d
      JOIN dish_variants dv ON d.id = dv.dish_id AND dv.is_default = true
      JOIN variant_ingredients vi ON dv.id = vi.variant_id
      JOIN ingredients i ON vi.ingredient_id = i.id
      WHERE i.name ILIKE '%creme fraiche%'
      AND d.active = true
      LIMIT 1
    `

    if (dishResult.rows.length === 0) {
      console.log('❌ Aucun plat trouvé')
      process.exit(0)
    }

    const testDish = dishResult.rows[0]
    console.log(`✅ Plat: "${testDish.dish_name}"\n`)

    // 2. Simuler exactement ce que fait /api/shopping-list
    console.log('📋 Simulation de l\'API /api/shopping-list\n')
    console.log('--- DÉBUT SIMULATION ---\n')

    // Récupérer les remplacements
    const replacementsResult = await sql`
      SELECT
        r.original_ingredient_id,
        r.replacement_ingredient_id,
        ri.name as replacement_name,
        ri.category as replacement_category,
        oi.name as original_name
      FROM user_ingredient_replacements r
      JOIN ingredients ri ON r.replacement_ingredient_id = ri.id
      JOIN ingredients oi ON r.original_ingredient_id = oi.id
      WHERE r.user_id = ${marieId}
    `

    const userReplacements = new Map()
    replacementsResult.rows.forEach(r => {
      userReplacements.set(r.original_ingredient_id, {
        replacementId: r.replacement_ingredient_id,
        replacementName: r.replacement_name,
        replacementCategory: r.replacement_category,
        originalName: r.original_name
      })
    })

    if (userReplacements.size > 0) {
      console.log(`🔄 [User ${marieId}] ${userReplacements.size} remplacement(s) actif(s):`)
      for (const [originalId, r] of userReplacements.entries()) {
        console.log(`   - "${r.originalName}" (ID:${originalId}) → "${r.replacementName}"`)
      }
      console.log('')
    }

    // Récupérer les ingrédients
    const ingredientsResult = await sql`
      SELECT
        vi.quantity,
        vi.unit,
        i.id as ingredient_id,
        i.name,
        i.category,
        i.default_unit
      FROM variant_ingredients vi
      JOIN ingredients i ON vi.ingredient_id = i.id
      WHERE vi.variant_id = ${testDish.variant_id}
      AND i.active = true
    `

    console.log('📦 Ingrédients récupérés:')
    const ingredientMap = {}

    for (const ing of ingredientsResult.rows) {
      let ingredientId = ing.ingredient_id
      let ingredientName = ing.name
      let ingredientCategory = ing.category || 'autre'

      console.log(`   - "${ing.name}" (ID:${ing.ingredient_id})`)

      if (userReplacements.has(ing.ingredient_id)) {
        const replacement = userReplacements.get(ing.ingredient_id)
        console.log(`     ✓ REMPLACEMENT APPLIQUÉ → "${replacement.replacementName}"`)
        ingredientId = replacement.replacementId
        ingredientName = replacement.replacementName
        ingredientCategory = replacement.replacementCategory || 'autre'
      }

      const key = ingredientId
      const quantity = parseFloat(ing.quantity) || 0

      if (ingredientMap[key]) {
        ingredientMap[key].quantity += quantity
      } else {
        ingredientMap[key] = {
          id: ingredientId,
          name: ingredientName,
          category: ingredientCategory,
          quantity: quantity,
          unit: ing.unit || ing.default_unit || 'g'
        }
      }
    }

    console.log('\n📊 Résultat final de la liste de courses:')
    const ingredientsList = Object.values(ingredientMap)
    ingredientsList.forEach(ing => {
      console.log(`   - ${ing.name}: ${ing.quantity} ${ing.unit}`)
    })

    console.log('\n--- FIN SIMULATION ---\n')

    // Vérifier si les remplacements ont été appliqués
    const hasCreme = ingredientsList.some(ing => ing.name.toLowerCase().includes('creme') && !ing.name.toLowerCase().includes('soja'))
    const hasSoja = ingredientsList.some(ing => ing.name.toLowerCase().includes('soja'))

    console.log('='.repeat(70))
    if (!hasCreme && hasSoja) {
      console.log('✅ TEST RÉUSSI : Les remplacements fonctionnent dans l\'historique !')
      console.log('   Crème fraîche a été remplacée par Crème de soja')
    } else if (hasCreme) {
      console.log('❌ TEST ÉCHOUÉ : Crème fraîche n\'est PAS remplacée')
      console.log('   Le problème est dans la logique de remplacement')
    }
    console.log('='.repeat(70))

  } catch (error) {
    console.error('\n❌ Erreur:', error)
    process.exit(1)
  }

  process.exit(0)
}

testHistoryReplacements()
