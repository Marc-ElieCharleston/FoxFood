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

    // Récupérer les overrides de plats de l'utilisateur
    const overridesResult = await sql`
      SELECT dish_id, remove_ingredients, substitute_ingredients
      FROM user_dish_overrides
      WHERE user_id = ${session.user.id} AND action = 'modify'
    `
    const dishOverrides = new Map()
    overridesResult.rows.forEach(r => dishOverrides.set(r.dish_id, r))

    // Pré-charger les ingrédients de substitution des overrides
    const allSubToIds = []
    for (const ov of dishOverrides.values()) {
      if (ov.substitute_ingredients) {
        ov.substitute_ingredients.forEach(s => allSubToIds.push(s.to_ingredient_id))
      }
    }
    let dishSubReplacements = new Map()
    if (allSubToIds.length > 0) {
      const subIngResult = await sql`
        SELECT id, name, category, default_unit FROM ingredients WHERE id = ANY(${allSubToIds})
      `
      subIngResult.rows.forEach(r => dishSubReplacements.set(r.id, r))
    }

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

    // Grouper et additionner les quantités par ingrédient en appliquant les remplacements
    const ingredientMap = {}

    for (const ing of ingredientsResult.rows) {
      const dishOverride = dishOverrides.get(ing.dish_id)

      // 1. Vérifier si l'ingrédient est supprimé pour ce plat (override par plat)
      if (dishOverride) {
        const removeIds = (dishOverride.remove_ingredients || []).map(r => r.ingredient_id)
        if (removeIds.includes(ing.ingredient_id)) continue
      }

      let ingredientId = ing.ingredient_id
      let ingredientName = ing.name
      let ingredientCategory = ing.category || 'autre'

      // 2. Appliquer les substitutions par plat (priorité sur les remplacements globaux)
      let substituted = false
      if (dishOverride) {
        const subs = dishOverride.substitute_ingredients || []
        const sub = subs.find(s => s.from_ingredient_id === ing.ingredient_id)
        if (sub) {
          const repl = dishSubReplacements.get(sub.to_ingredient_id)
          if (repl) {
            ingredientId = repl.id
            ingredientName = repl.name
            ingredientCategory = repl.category || 'autre'
            substituted = true
          }
        }
      }

      // 3. Appliquer les remplacements globaux (si pas déjà substitué)
      if (!substituted && userReplacements.has(ing.ingredient_id)) {
        const replacement = userReplacements.get(ing.ingredient_id)
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
