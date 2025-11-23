import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer tous les utilisateurs avec leurs sélections
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    // Récupérer tous les utilisateurs (non-admins) avec leurs infos
    const users = await sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.delivery_day,
        u.delivery_time_slot,
        u.notification_phone,
        u.notification_phone_secondary,
        u.notification_email,
        u.receive_notifications,
        u.settings_completed,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.role = 'user'
      ORDER BY u.name ASC
    `

    // Pour chaque utilisateur, récupérer sa sélection de la semaine
    const usersWithSelections = await Promise.all(
      users.rows.map(async (user) => {
        // Vérifier s'il a une sélection cette semaine (7 derniers jours)
        const selection = await sql`
          SELECT
            us.id as selection_id,
            us.created_at as selection_date,
            json_agg(
              json_build_object(
                'dish_id', d.id,
                'dish_name', d.name,
                'category', d.category,
                'quantity', usd.quantity
              ) ORDER BY d.name
            ) as dishes
          FROM user_selections us
          LEFT JOIN user_selection_dishes usd ON us.id = usd.selection_id
          LEFT JOIN dishes d ON usd.dish_id = d.id
          WHERE us.user_id = ${user.id}
            AND us.created_at > NOW() - INTERVAL '7 days'
          GROUP BY us.id, us.created_at
          ORDER BY us.created_at DESC
          LIMIT 1
        `

        const hasSelection = selection.rows.length > 0
        const dishes = hasSelection ? selection.rows[0].dishes : []
        const dishCount = dishes.filter(d => d.dish_id !== null).length

        return {
          ...user,
          has_selection: hasSelection,
          selection_date: hasSelection ? selection.rows[0].selection_date : null,
          dish_count: dishCount,
          dishes: dishes.filter(d => d.dish_id !== null)
        }
      })
    )

    // Calculer les stats globales
    const totalUsers = usersWithSelections.length
    const usersWithSelection = usersWithSelections.filter(u => u.has_selection).length
    const usersWithoutSelection = totalUsers - usersWithSelection
    const usersWithSettings = usersWithSelections.filter(u => u.settings_completed).length

    // Compter par jour de passage
    const usersByDay = usersWithSelections.reduce((acc, user) => {
      if (user.delivery_day) {
        acc[user.delivery_day] = (acc[user.delivery_day] || 0) + 1
      }
      return acc
    }, {})

    return NextResponse.json({
      users: usersWithSelections,
      stats: {
        total: totalUsers,
        with_selection: usersWithSelection,
        without_selection: usersWithoutSelection,
        with_settings: usersWithSettings,
        by_day: usersByDay
      }
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des utilisateurs' },
      { status: 500 }
    )
  }
}
