import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import {
  loadDishOverridesForUsers,
  loadIngredientReplacementsForUsers,
  loadOverrideIngredients,
  applyDishOverride
} from '@/lib/dish-overrides'

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const weekOffset = parseInt(searchParams.get('week') || '0')

    // Calculer les dates de la semaine demandée
    const today = new Date()
    const dayOfWeek = today.getDay() || 7 // 1=Lundi, 7=Dimanche
    const monday = new Date(today)
    monday.setDate(today.getDate() - dayOfWeek + 1 + (weekOffset * 7))
    monday.setHours(0, 0, 0, 0)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    const weekStart = monday.toISOString().split('T')[0]
    const weekEnd = sunday.toISOString().split('T')[0]

    // Récupérer toutes les sélections de la semaine
    const selectionsResult = await sql`
      SELECT
        ws.id,
        ws.user_id,
        ws.week_start_date,
        ws.selected_dishes,
        u.name as user_name,
        u.email as user_email,
        u.delivery_day,
        u.delivery_time_slot,
        u.household_size
      FROM weekly_selections ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.week_start_date = ${weekStart}
      ORDER BY u.name
    `

    // Récupérer tous les plats avec leurs ingrédients
    const dishesResult = await sql`
      SELECT
        d.id as dish_id,
        d.name as dish_name,
        d.category,
        di.ingredient_id,
        di.quantity,
        di.unit,
        i.name as ingredient_name,
        i.category as ingredient_category
      FROM dishes d
      LEFT JOIN dish_ingredients di ON d.id = di.dish_id
      LEFT JOIN ingredients i ON di.ingredient_id = i.id
      WHERE d.active = true
    `

    // Construire un map des plats pour accès rapide
    const dishesMap = {}
    dishesResult.rows.forEach(row => {
      if (!dishesMap[row.dish_id]) {
        dishesMap[row.dish_id] = {
          id: row.dish_id,
          name: row.dish_name,
          category: row.category,
          ingredients: []
        }
      }
      if (row.ingredient_id) {
        dishesMap[row.dish_id].ingredients.push({
          id: row.ingredient_id,
          name: row.ingredient_name,
          category: row.ingredient_category || 'autre',
          quantity: parseFloat(row.quantity || 1),
          unit: row.unit || ''
        })
      }
    })

    // Adaptations par client : certains ne mangent pas un ingrédient et le chef
    // le remplace, le retire ou en ajoute un autre. Sans ça, le récap ferait
    // acheter et cuisiner la recette du catalogue, pas celle qui part chez eux.
    const userIds = selectionsResult.rows.map(s => s.user_id)
    const overridesByUser = await loadDishOverridesForUsers(userIds)
    const replacementsByUser = await loadIngredientReplacementsForUsers(userIds)
    const overrideIngredients = await loadOverrideIngredients(
      [...overridesByUser.values()].flatMap(m => [...m.values()])
    )

    // Traiter les sélections des clients
    const clients = []
    const ingredientsTotal = {}
    let totalDishes = 0
    let totalPersons = 0

    selectionsResult.rows.forEach(selection => {
      const selectedDishes = selection.selected_dishes || []

      const householdSize = selection.household_size || 1
      totalPersons += householdSize

      const overrides = overridesByUser.get(selection.user_id) || new Map()
      const replacements = replacementsByUser.get(selection.user_id) || new Map()
      const clientDishes = []

      selectedDishes.forEach(dishId => {
        const dish = dishesMap[dishId]
        if (!dish) return

        totalDishes++

        const override = overrides.get(dishId)
        clientDishes.push({
          id: dish.id,
          name: override?.custom_name || dish.name,
          originalName: override?.custom_name ? dish.name : undefined,
          adapted: Boolean(override)
        })

        // Ajouter les ingrédients au total, adaptations appliquées
        if (dish.ingredients) {
          const applied = applyDishOverride(
            dish.ingredients.map(ing => ({
              ingredientId: ing.id,
              quantity: ing.quantity,
              unit: ing.unit,
              ref: ing
            })),
            override
          )

          applied.forEach(item => {
            const meta = item.source === 'original' ? null : overrideIngredients.get(item.ingredientId)
            // Cible désactivée : on retire plutôt que de laisser l'ingrédient
            // d'origine, que le client ne peut justement pas manger.
            if (item.source !== 'original' && !meta) return

            let id = item.ingredientId
            let name = meta ? meta.name : item.ref.name
            let category = (meta ? meta.category : item.ref.category) || 'autre'

            // Remplacements globaux : sur ce qu'aucun override plat n'a touché
            if (item.source === 'original' && replacements.has(id)) {
              const repl = replacements.get(id)
              id = repl.id
              name = repl.name
              category = repl.category || 'autre'
            }

            const unit = item.unit || (meta ? meta.default_unit : '') || ''
            const quantity = (parseFloat(item.quantity) || 0) * householdSize

            if (!ingredientsTotal[category]) ingredientsTotal[category] = []
            const existing = ingredientsTotal[category].find(i => i.id === id && i.unit === unit)
            if (existing) {
              existing.totalQuantity += quantity
            } else {
              ingredientsTotal[category].push({ id, name, unit, totalQuantity: quantity })
            }
          })
        }
      })

      clients.push({
        id: selection.user_id,
        name: selection.user_name,
        email: selection.user_email,
        deliveryDay: selection.delivery_day,
        deliveryTime: selection.delivery_time_slot,
        householdSize: householdSize,
        dishes: clientDishes
      })
    })

    // Trier les ingrédients par nom dans chaque catégorie
    Object.keys(ingredientsTotal).forEach(cat => {
      ingredientsTotal[cat].sort((a, b) => a.name.localeCompare(b.name))
    })

    return NextResponse.json({
      weekStart,
      weekEnd,
      totalClients: clients.length,
      totalDishes,
      totalPersons,
      clients,
      ingredients: ingredientsTotal
    })

  } catch (error) {
    console.error('Erreur récap admin:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
