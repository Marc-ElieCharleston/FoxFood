/**
 * Script pour tester le système de remplacement d'ingrédients
 * Simule ce que Marie fait
 */

import { sql } from '@vercel/postgres'

// Import dynamique pour module CommonJS
const { getShoppingListData, generateShoppingListHtml } = await import('../lib/notifications.js')

async function testReplacements() {
  console.log('🧪 Test du système de remplacement d\'ingrédients\n')

  try {
    // 1. Vérifier les remplacements de Marie (user_id: 14)
    const marieId = 14
    console.log(`👤 Utilisateur: Marie (ID: ${marieId})`)

    const replacementsResult = await sql`
      SELECT
        r.original_ingredient_id,
        oi.name as original_name,
        r.replacement_ingredient_id,
        ri.name as replacement_name
      FROM user_ingredient_replacements r
      JOIN ingredients oi ON r.original_ingredient_id = oi.id
      JOIN ingredients ri ON r.replacement_ingredient_id = ri.id
      WHERE r.user_id = ${marieId}
    `

    console.log(`\n📋 Remplacements configurés (${replacementsResult.rows.length}):`)
    replacementsResult.rows.forEach(r => {
      console.log(`   "${r.original_name}" (ID:${r.original_ingredient_id}) → "${r.replacement_name}" (ID:${r.replacement_ingredient_id})`)
    })

    // 2. Trouver un plat qui contient de la crème fraîche
    console.log(`\n🔍 Recherche de plats avec "Creme fraiche"...`)
    const dishWithCremeResult = await sql`
      SELECT DISTINCT
        d.id as dish_id,
        d.name as dish_name,
        dv.id as variant_id,
        dv.name as variant_name,
        i.id as ingredient_id,
        i.name as ingredient_name
      FROM dishes d
      JOIN dish_variants dv ON d.id = dv.dish_id
      JOIN variant_ingredients vi ON dv.id = vi.variant_id
      JOIN ingredients i ON vi.ingredient_id = i.id
      WHERE i.name ILIKE '%creme fraiche%'
      AND dv.is_default = true
      AND d.active = true
      LIMIT 3
    `

    if (dishWithCremeResult.rows.length === 0) {
      console.log('   ❌ Aucun plat trouvé avec crème fraîche')
      process.exit(0)
    }

    console.log(`\n✅ Plats trouvés avec crème fraîche:`)
    dishWithCremeResult.rows.forEach(d => {
      console.log(`   - "${d.dish_name}" (ID:${d.dish_id}) - Variante: "${d.variant_name}" (ID:${d.variant_id})`)
      console.log(`     Contient: "${d.ingredient_name}" (ID:${d.ingredient_id})`)
    })

    // 3. Simuler une sélection avec ce plat
    const testDish = dishWithCremeResult.rows[0]
    console.log(`\n🧪 Test avec le plat: "${testDish.dish_name}"`)

    // 4. Générer la liste de courses SANS remplacement
    console.log('\n📝 Génération liste de courses SANS remplacement (userId: null):')
    const listWithoutReplacement = await getShoppingListData({
      selectedDishes: [testDish.dish_id],
      selectedVariants: {},
      householdSize: 1,
      userId: null
    })

    if (listWithoutReplacement) {
      for (const [category, ingredients] of listWithoutReplacement) {
        for (const ing of ingredients) {
          if (ing.name.toLowerCase().includes('creme')) {
            console.log(`   ✓ Trouvé: "${ing.name}" (${ing.quantity} ${ing.unit})`)
          }
        }
      }
    }

    // 5. Générer la liste de courses AVEC remplacement de Marie
    console.log(`\n📝 Génération liste de courses AVEC remplacement (userId: ${marieId}):`)
    const listWithReplacement = await getShoppingListData({
      selectedDishes: [testDish.dish_id],
      selectedVariants: {},
      householdSize: 1,
      userId: marieId
    })

    let foundReplacement = false
    if (listWithReplacement) {
      for (const [category, ingredients] of listWithReplacement) {
        for (const ing of ingredients) {
          if (ing.name.toLowerCase().includes('soja') || ing.name.toLowerCase().includes('creme')) {
            console.log(`   ✓ Trouvé: "${ing.name}" (${ing.quantity} ${ing.unit})`)
            if (ing.name.toLowerCase().includes('soja')) {
              foundReplacement = true
            }
          }
        }
      }
    }

    // 6. Résultat du test
    console.log('\n' + '='.repeat(60))
    if (foundReplacement) {
      console.log('✅ TEST RÉUSSI : Le remplacement fonctionne !')
      console.log('   "Creme fraiche" a bien été remplacé par "Crème de soja"')
    } else {
      console.log('❌ TEST ÉCHOUÉ : Le remplacement ne fonctionne pas')
      console.log('   "Creme fraiche" n\'a PAS été remplacé')
    }
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ Erreur:', error)
    process.exit(1)
  }

  process.exit(0)
}

testReplacements()
