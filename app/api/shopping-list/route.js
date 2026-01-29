import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { dishes, variants, householdSize = 1 } = await request.json()

    if (!dishes || dishes.length === 0) {
      return NextResponse.json({})
    }

    // Récupérer les remplacements d'ingrédients de l'utilisateur
    const replacementsResult = await sql`
      SELECT
        r.original_ingredient_id,
        r.replacement_ingredient_id,
        ri.name as replacement_name,
        ri.category as replacement_category
      FROM user_ingredient_replacements r
      JOIN ingredients ri ON r.replacement_ingredient_id = ri.id
      WHERE r.user_id = ${session.user.id}
    `

    const userReplacements = new Map()
    replacementsResult.rows.forEach(r => {
      userReplacements.set(r.original_ingredient_id, {
        replacementId: r.replacement_ingredient_id,
        replacementName: r.replacement_name,
        replacementCategory: r.replacement_category
      })
    })

    // Log pour debug
    if (userReplacements.size > 0) {
      console.log(`🔄 [Historique - User ${session.user.id}] ${userReplacements.size} remplacement(s) actif(s)`)
    }

    // Pour chaque plat, récupérer la variante par défaut si aucune n'est sélectionnée
    const variantIds = []

    for (const dishId of dishes) {
      if (variants && variants[dishId]) {
        variantIds.push(variants[dishId])
      } else {
        // Récupérer la variante par défaut
        const defaultVariant = await sql`
          SELECT id FROM dish_variants
          WHERE dish_id = ${dishId} AND is_default = true AND active = true
          LIMIT 1
        `
        if (defaultVariant.rows.length > 0) {
          variantIds.push(defaultVariant.rows[0].id)
        }
      }
    }

    if (variantIds.length === 0) {
      return NextResponse.json({})
    }

    // Récupérer les ingrédients de toutes les variantes
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
      WHERE vi.variant_id = ANY(${variantIds})
      AND i.active = true
    `

    // Grouper et additionner les quantités par ingrédient en appliquant les remplacements
    const ingredientMap = {}

    for (const ing of ingredientsResult.rows) {
      // Appliquer le remplacement si configuré
      let ingredientId = ing.ingredient_id
      let ingredientName = ing.name
      let ingredientCategory = ing.category || 'autre'

      if (userReplacements.has(ing.ingredient_id)) {
        const replacement = userReplacements.get(ing.ingredient_id)
        console.log(`   ✓ [Historique] Remplacement: "${ing.name}" → "${replacement.replacementName}"`)
        ingredientId = replacement.replacementId
        ingredientName = replacement.replacementName
        ingredientCategory = replacement.replacementCategory || 'autre'
      }

      const key = ingredientId
      const quantity = parseFloat(ing.quantity) || 0
      const scaledQuantity = quantity * householdSize

      if (ingredientMap[key]) {
        ingredientMap[key].quantity += scaledQuantity
      } else {
        ingredientMap[key] = {
          id: ingredientId,
          name: ingredientName,
          category: ingredientCategory,
          quantity: scaledQuantity,
          unit: ing.unit || ing.default_unit || 'g'
        }
      }
    }

    // Grouper par catégorie
    const grouped = {}

    for (const ing of Object.values(ingredientMap)) {
      const cat = ing.category || 'autre'
      if (!grouped[cat]) {
        grouped[cat] = []
      }
      grouped[cat].push(ing)
    }

    // Trier les ingrédients par nom dans chaque catégorie
    for (const cat of Object.keys(grouped)) {
      grouped[cat].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    }

    return NextResponse.json(grouped)
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
