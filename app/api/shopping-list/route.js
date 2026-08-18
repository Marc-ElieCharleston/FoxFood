import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { loadDishOverrides, loadOverrideIngredients, applyDishOverride } from '@/lib/dish-overrides'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { dishes, householdSize = 1 } = await request.json()

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

    // Récupérer les overrides de plats de l'utilisateur (retraits, substitutions, ajouts)
    const dishOverrides = await loadDishOverrides(session.user.id)
    // Pré-charger les ingrédients cibles des overrides (substitutions + ajouts)
    const overrideIngredients = await loadOverrideIngredients(dishOverrides)

    // Log pour debug
    if (userReplacements.size > 0) {
      console.log(`🔄 [Historique - User ${session.user.id}] ${userReplacements.size} remplacement(s) actif(s)`)
    }
    if (dishOverrides.size > 0) {
      console.log(`🔧 [Historique - User ${session.user.id}] ${dishOverrides.size} override(s) de plat`)
    }

    const dishIds = dishes

    // Récupérer les ingrédients de tous les plats directement (avec dish_id pour les overrides)
    const ingredientsResult = await sql`
      SELECT
        di.dish_id,
        di.quantity,
        di.unit,
        i.id as ingredient_id,
        i.name,
        i.category,
        i.default_unit
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE di.dish_id = ANY(${dishIds})
      AND i.active = true
    `

    // Fallback JSONB si aucun ingrédient lié dans dish_ingredients
    if (ingredientsResult.rows.length === 0) {
      const dishesWithJsonb = await sql`
        SELECT id, name, ingredients FROM dishes WHERE id = ANY(${dishIds})
      `
      const rawGrouped = { 'ingredients': [] }
      for (const dish of dishesWithJsonb.rows) {
        let ings = dish.ingredients
        if (typeof ings === 'string') { try { ings = JSON.parse(ings) } catch { ings = [] } }
        if (Array.isArray(ings)) {
          ings.forEach(ing => rawGrouped['ingredients'].push({
            id: 0, name: ing, category: 'autre', quantity: 0, unit: ''
          }))
        }
      }
      return NextResponse.json(rawGrouped)
    }

    // Les overrides se raisonnent plat par plat (un ajout appartient à UN plat)
    const rowsByDish = new Map()
    for (const row of ingredientsResult.rows) {
      if (!rowsByDish.has(row.dish_id)) rowsByDish.set(row.dish_id, [])
      rowsByDish.get(row.dish_id).push(row)
    }

    // Grouper et additionner les quantités par ingrédient en appliquant les remplacements
    const ingredientMap = {}

    for (const [dishId, rows] of rowsByDish) {
      const applied = applyDishOverride(
        rows.map(r => ({
          ingredientId: r.ingredient_id,
          quantity: parseFloat(r.quantity) || 0,
          unit: r.unit,
          ref: r
        })),
        dishOverrides.get(dishId)
      )

      for (const item of applied) {
        const meta = item.source === 'original' ? null : overrideIngredients.get(item.ingredientId)
        // Cible désactivée : on retire plutôt que de laisser l'ingrédient d'origine,
        // que le client ne peut justement pas manger.
        if (item.source !== 'original' && !meta) continue

        let ingredientId = item.ingredientId
        let ingredientName = meta ? meta.name : item.ref.name
        let ingredientCategory = (meta ? meta.category : item.ref.category) || 'autre'
        const unit = item.unit || (meta ? meta.default_unit : item.ref.default_unit) || 'g'

        // Remplacements globaux : uniquement sur ce qu'aucun override plat n'a touché
        if (item.source === 'original' && userReplacements.has(ingredientId)) {
          const replacement = userReplacements.get(ingredientId)
          ingredientId = replacement.replacementId
          ingredientName = replacement.replacementName
          ingredientCategory = replacement.replacementCategory || 'autre'
        }

        const key = ingredientId
        const scaledQuantity = (parseFloat(item.quantity) || 0) * householdSize

        if (ingredientMap[key]) {
          ingredientMap[key].quantity += scaledQuantity
        } else {
          ingredientMap[key] = {
            id: ingredientId,
            name: ingredientName,
            category: ingredientCategory,
            quantity: scaledQuantity,
            unit
          }
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
