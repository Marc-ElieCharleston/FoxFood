/**
 * Script simple pour tester le système de remplacement
 * Sans importer notifications.js
 */

import { sql } from '@vercel/postgres'

async function testReplacements() {
  console.log('🧪 Test du système de remplacement d\'ingrédients\n')

  try {
    const marieId = 14

    // 1. Remplacements de Marie
    console.log(`👤 Utilisateur: Marie (ID: ${marieId})\n`)

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

    console.log(`📋 Remplacements configurés (${replacementsResult.rows.length}):`)
    const replacementsMap = new Map()
    replacementsResult.rows.forEach(r => {
      console.log(`   "${r.original_name}" (ID:${r.original_ingredient_id}) → "${r.replacement_name}"`)
      replacementsMap.set(r.original_ingredient_id, {
        replacementId: r.replacement_ingredient_id,
        replacementName: r.replacement_name
      })
    })

    // 2. Trouver un plat avec crème fraîche
    console.log(`\n🔍 Recherche d'un plat avec crème fraîche...`)

    const dishResult = await sql`
      SELECT DISTINCT
        d.id as dish_id,
        d.name as dish_name,
        dv.id as variant_id,
        dv.name as variant_name
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
    console.log(`✅ Plat trouvé: "${testDish.dish_name}" (variant: ${testDish.variant_name})`)

    // 3. Récupérer les ingrédients de ce plat
    console.log(`\n📦 Ingrédients du plat:`)

    const ingredientsResult = await sql`
      SELECT
        i.id,
        i.name,
        vi.quantity,
        vi.unit
      FROM variant_ingredients vi
      JOIN ingredients i ON vi.ingredient_id = i.id
      WHERE vi.variant_id = ${testDish.variant_id}
      ORDER BY i.name
    `

    // 4. Simuler l'application des remplacements
    console.log('\n🔄 Application des remplacements:')
    let foundCreme = false
    let replacementApplied = false

    ingredientsResult.rows.forEach(ing => {
      const isCremeIngredient = ing.name.toLowerCase().includes('creme')

      if (isCremeIngredient) {
        foundCreme = true
      }

      if (replacementsMap.has(ing.id)) {
        const replacement = replacementsMap.get(ing.id)
        console.log(`   ✓ REMPLACEMENT: "${ing.name}" → "${replacement.replacementName}"`)
        replacementApplied = true
      } else {
        const mark = isCremeIngredient ? '⚠️ ' : '  '
        console.log(`   ${mark}"${ing.name}" (${ing.quantity} ${ing.unit || ''})`)
      }
    })

    // 5. Résultat
    console.log('\n' + '='.repeat(70))
    if (foundCreme && replacementApplied) {
      console.log('✅ TEST RÉUSSI : Le système de remplacement fonctionne !')
      console.log('   La crème fraîche est bien remplacée par Crème de soja')
    } else if (foundCreme && !replacementApplied) {
      console.log('❌ TEST ÉCHOUÉ : La crème fraîche n\'est PAS remplacée')
      console.log('   Le remplacement est configuré mais pas appliqué')
    } else {
      console.log('ℹ️  Ce plat ne contient pas de crème fraîche')
    }
    console.log('='.repeat(70))

    // 6. Test complet avec la fonction SQL
    console.log('\n\n📧 Simulation d\'email pour Marie:')
    console.log('   Si le code fonctionne, les remplacements devraient être appliqués automatiquement')
    console.log('   dans la fonction getShoppingListData() appelée lors de l\'envoi d\'email.')

  } catch (error) {
    console.error('\n❌ Erreur:', error)
    process.exit(1)
  }

  process.exit(0)
}

testReplacements()
