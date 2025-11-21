import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer les paramètres de l'utilisateur
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const result = await sql`
      SELECT
        delivery_day,
        delivery_time_slot,
        reminder_days_before,
        reminder_method,
        notification_phone,
        notification_email,
        receive_notifications,
        settings_completed
      FROM users
      WHERE id = ${parseInt(session.user.id)}
      LIMIT 1
    `

    return NextResponse.json(result.rows[0] || null)
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres' },
      { status: 500 }
    )
  }
}

// POST - Sauvegarder les paramètres de l'utilisateur
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
      delivery_day,
      delivery_time_slot,
      reminder_days_before,
      reminder_method,
      notification_phone,
      notification_email,
      receive_notifications
    } = await request.json()

    // Validation
    if (!delivery_day || !delivery_time_slot) {
      return NextResponse.json(
        { error: 'Jour et créneau de passage requis' },
        { status: 400 }
      )
    }

    if (!reminder_days_before || reminder_days_before < 1 || reminder_days_before > 5) {
      return NextResponse.json(
        { error: 'Le délai de rappel doit être entre 1 et 5 jours' },
        { status: 400 }
      )
    }

    if (!reminder_method || !['email', 'sms'].includes(reminder_method)) {
      return NextResponse.json(
        { error: 'Méthode de rappel invalide' },
        { status: 400 }
      )
    }

    if (reminder_method === 'sms' && !notification_phone) {
      return NextResponse.json(
        { error: 'Numéro de mobile requis pour les rappels SMS' },
        { status: 400 }
      )
    }

    if (reminder_method === 'email' && !notification_email) {
      return NextResponse.json(
        { error: 'Email requis pour les rappels' },
        { status: 400 }
      )
    }

    // Mettre à jour les paramètres
    const result = await sql`
      UPDATE users
      SET
        delivery_day = ${delivery_day},
        delivery_time_slot = ${delivery_time_slot},
        reminder_days_before = ${reminder_days_before},
        reminder_method = ${reminder_method},
        notification_phone = ${notification_phone || null},
        notification_email = ${notification_email || null},
        receive_notifications = ${receive_notifications !== false},
        settings_completed = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(session.user.id)}
      RETURNING *
    `

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'Paramètres enregistrés avec succès',
      settings: result.rows[0]
    })
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des paramètres:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde des paramètres' },
      { status: 500 }
    )
  }
}
