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
        u.household_size,
        u.onboarding_completed,
        u.active,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.role = 'client'
      ORDER BY u.active DESC, u.name ASC
    `

    // Pour chaque utilisateur, récupérer sa sélection de la semaine
    const usersWithSelections = await Promise.all(
      users.rows.map(async (user) => {
        // Vérifier s'il a une sélection cette semaine
        const selection = await sql`
          SELECT
            ws.id as selection_id,
            ws.week_start_date,
            ws.delivery_day as selection_delivery_day,
            ws.delivery_time_slot as selection_time_slot,
            ws.selected_dishes,
            ws.created_at as selection_date
          FROM weekly_selections ws
          WHERE ws.user_id = ${user.id}
          ORDER BY ws.week_start_date DESC
          LIMIT 1
        `

        const hasSelection = selection.rows.length > 0
        let dishes = []
        let dishCount = 0

        if (hasSelection && selection.rows[0].selected_dishes) {
          const dishIds = selection.rows[0].selected_dishes
          if (Array.isArray(dishIds) && dishIds.length > 0) {
            // Récupérer les détails des plats
            const dishDetails = await sql`
              SELECT id, name, category
              FROM dishes
              WHERE id = ANY(${dishIds}::int[])
            `
            dishes = dishDetails.rows
            dishCount = dishes.length
          }
        }

        return {
          ...user,
          has_selection: hasSelection && dishCount > 0,
          selection_date: hasSelection ? selection.rows[0].selection_date : null,
          week_start_date: hasSelection ? selection.rows[0].week_start_date : null,
          dish_count: dishCount,
          dishes
        }
      })
    )

    // Calculer les stats globales
    const totalUsers = usersWithSelections.length
    const activeUsers = usersWithSelections.filter(u => u.active !== false).length
    const inactiveUsers = totalUsers - activeUsers
    const usersWithSelection = usersWithSelections.filter(u => u.has_selection).length
    const usersWithoutSelection = totalUsers - usersWithSelection
    const usersWithSettings = usersWithSelections.filter(u => u.settings_completed).length

    // Compter par jour de passage (uniquement utilisateurs actifs)
    const usersByDay = usersWithSelections
      .filter(u => u.active !== false)
      .reduce((acc, user) => {
        if (user.delivery_day) {
          acc[user.delivery_day] = (acc[user.delivery_day] || 0) + 1
        }
        return acc
      }, {})

    return NextResponse.json({
      users: usersWithSelections,
      stats: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
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

// PUT - Mettre à jour le statut actif/inactif d'un utilisateur
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    const { userId, active } = await request.json()

    if (!userId || typeof active !== 'boolean') {
      return NextResponse.json(
        { error: 'userId et active sont requis' },
        { status: 400 }
      )
    }

    // Mettre à jour le statut de l'utilisateur
    const result = await sql`
      UPDATE users
      SET active = ${active}, updated_at = NOW()
      WHERE id = ${userId} AND role = 'client'
      RETURNING id, name, email, active
    `

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: result.rows[0],
      message: active ? 'Utilisateur activé' : 'Utilisateur désactivé'
    })

  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour' },
      { status: 500 }
    )
  }
}

// PATCH - Mettre à jour les paramètres d'un utilisateur (jour, créneau, taille foyer)
export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    const { userId, delivery_day, delivery_time_slot, household_size } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'userId requis' },
        { status: 400 }
      )
    }

    // Mettre à jour les paramètres
    const settingsCompleted = delivery_day && delivery_time_slot ? true : false

    const result = await sql`
      UPDATE users
      SET
        delivery_day = ${delivery_day || null},
        delivery_time_slot = ${delivery_time_slot || null},
        household_size = ${household_size || 1},
        settings_completed = ${settingsCompleted},
        updated_at = NOW()
      WHERE id = ${userId} AND role = 'client'
      RETURNING id, name, email, delivery_day, delivery_time_slot, household_size, settings_completed
    `

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: result.rows[0],
      message: 'Paramètres mis à jour'
    })

  } catch (error) {
    console.error('Erreur lors de la mise à jour des paramètres:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour' },
      { status: 500 }
    )
  }
}
