import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer toutes les sélections passées de l'utilisateur
    const result = await sql`
      SELECT
        ws.id,
        ws.week_start_date,
        ws.selected_dishes,
        ws.selected_variants,
        ws.created_at,
        ws.updated_at
      FROM weekly_selections ws
      WHERE ws.user_id = ${session.user.id}
      ORDER BY ws.week_start_date DESC
      LIMIT 20
    `

    // Pour chaque sélection, récupérer les détails des plats
    const history = []

    for (const selection of result.rows) {
      let dishIds = selection.selected_dishes
      if (typeof dishIds === 'string') {
        dishIds = JSON.parse(dishIds)
      }

      let selectedVariants = selection.selected_variants || {}
      if (typeof selectedVariants === 'string') {
        selectedVariants = JSON.parse(selectedVariants)
      }

      if (!dishIds || dishIds.length === 0) continue

      // Récupérer les détails des plats
      const dishesResult = await sql`
        SELECT id, name, category
        FROM dishes
        WHERE id = ANY(${dishIds})
      `

      // Récupérer les noms des variantes si sélectionnées
      const dishesWithVariants = await Promise.all(
        dishesResult.rows.map(async (dish) => {
          let variantName = null
          const variantId = selectedVariants[dish.id]

          if (variantId) {
            const variantResult = await sql`
              SELECT name FROM dish_variants WHERE id = ${variantId}
            `
            if (variantResult.rows.length > 0) {
              variantName = variantResult.rows[0].name
            }
          }

          return {
            ...dish,
            variant_id: variantId || null,
            variant_name: variantName
          }
        })
      )

      history.push({
        id: selection.id,
        week_start: selection.week_start_date,
        selected_variants: selectedVariants,
        dishes: dishesWithVariants,
        created_at: selection.created_at
      })
    }

    return NextResponse.json({ history })
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
