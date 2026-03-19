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

      if (!dishIds || dishIds.length === 0) continue

      // Récupérer les détails des plats
      const dishesResult = await sql`
        SELECT id, name, category
        FROM dishes
        WHERE id = ANY(${dishIds})
      `

      history.push({
        id: selection.id,
        week_start: selection.week_start_date,
        dishes: dishesResult.rows,
        created_at: selection.created_at
      })
    }

    return NextResponse.json({ history })
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
