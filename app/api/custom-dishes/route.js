import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer les demandes de plats de l'utilisateur
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const userId = parseInt(session.user.id)

    const requests = await sql`
      SELECT
        id,
        dish_name,
        description,
        suggested_ingredients,
        is_detailed,
        status,
        admin_notes,
        created_at,
        updated_at
      FROM custom_dish_requests
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `

    return NextResponse.json(requests.rows)
  } catch (error) {
    console.error('Erreur lors de la récupération des demandes:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des demandes' },
      { status: 500 }
    )
  }
}

// POST - Créer une nouvelle demande de plat
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const {
      dish_name,
      description,
      suggested_ingredients,
      is_detailed
    } = await request.json()

    const userId = parseInt(session.user.id)

    // Validation
    if (!dish_name || !dish_name.trim()) {
      return NextResponse.json(
        { error: 'Le nom du plat est requis' },
        { status: 400 }
      )
    }

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: 'La description est requise' },
        { status: 400 }
      )
    }

    // Créer la demande
    const result = await sql`
      INSERT INTO custom_dish_requests (
        user_id,
        dish_name,
        description,
        suggested_ingredients,
        is_detailed,
        status
      )
      VALUES (
        ${userId},
        ${dish_name.trim()},
        ${description.trim()},
        ${JSON.stringify(suggested_ingredients || [])},
        ${is_detailed || false},
        'pending'
      )
      RETURNING *
    `

    // Envoyer notification à l'admin
    try {
      const adminSettingsResult = await sql`
        SELECT
          a.notification_email,
          a.notification_phone,
          a.send_email,
          a.send_sms,
          a.notify_on_custom_dish,
          u.email as user_email
        FROM admin_settings a
        JOIN users u ON a.user_id = u.id
        WHERE u.role = 'admin'
        AND a.notify_on_custom_dish = true
        LIMIT 1
      `

      if (adminSettingsResult.rows.length > 0) {
        const adminSettings = adminSettingsResult.rows[0]
        const { notifyAdminCustomDish } = await import('@/lib/notifications')

        await notifyAdminCustomDish({
          adminEmail: adminSettings.notification_email || adminSettings.user_email,
          adminPhone: adminSettings.notification_phone,
          sendEmail: adminSettings.send_email,
          sendSMS: adminSettings.send_sms,
          userName: session.user.name,
          userEmail: session.user.email,
          dishName: dish_name.trim(),
          description: description.trim(),
          isDetailed: is_detailed || false,
          ingredients: suggested_ingredients || []
        })
      }
    } catch (notifError) {
      console.error('Erreur notification admin:', notifError)
      // Ne pas bloquer la création de la demande si la notification échoue
    }

    return NextResponse.json({
      message: 'Demande créée avec succès',
      request: result.rows[0]
    })
  } catch (error) {
    console.error('Erreur lors de la création de la demande:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la demande' },
      { status: 500 }
    )
  }
}
