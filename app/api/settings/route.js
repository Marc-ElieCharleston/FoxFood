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

    const userId = parseInt(session.user.id)

    // Récupérer les paramètres de base
    const userSettings = await sql`
      SELECT
        delivery_day,
        delivery_time_slot,
        notification_phone,
        notification_email,
        receive_notifications,
        settings_completed
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `

    // Récupérer les rappels configurés
    const reminders = await sql`
      SELECT days_before, enabled, send_email, send_sms
      FROM user_reminders
      WHERE user_id = ${userId}
      ORDER BY days_before DESC
    `

    const result = userSettings.rows[0] || {}
    result.reminders = reminders.rows || []

    return NextResponse.json(result)
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
      notification_phone,
      notification_email,
      receive_notifications,
      reminders
    } = await request.json()

    const userId = parseInt(session.user.id)

    // Validation
    if (!delivery_day || !delivery_time_slot) {
      return NextResponse.json(
        { error: 'Jour et créneau de passage requis' },
        { status: 400 }
      )
    }

    if (!reminders || !Array.isArray(reminders)) {
      return NextResponse.json(
        { error: 'Configuration de rappels invalide' },
        { status: 400 }
      )
    }

    // Vérifier qu'au moins un rappel est activé
    const hasEnabledReminder = reminders.some(r => r.enabled)
    if (!hasEnabledReminder) {
      return NextResponse.json(
        { error: 'Au moins un rappel doit être activé' },
        { status: 400 }
      )
    }

    // Mettre à jour les paramètres utilisateur
    const userResult = await sql`
      UPDATE users
      SET
        delivery_day = ${delivery_day},
        delivery_time_slot = ${delivery_time_slot},
        notification_phone = ${notification_phone || null},
        notification_email = ${notification_email || null},
        receive_notifications = ${receive_notifications !== false},
        settings_completed = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
      RETURNING *
    `

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Supprimer les anciens rappels
    await sql`
      DELETE FROM user_reminders
      WHERE user_id = ${userId}
    `

    // Insérer les nouveaux rappels
    for (const reminder of reminders) {
      if (reminder.enabled) {
        await sql`
          INSERT INTO user_reminders (user_id, days_before, enabled, send_email, send_sms)
          VALUES (
            ${userId},
            ${reminder.days_before},
            ${reminder.enabled},
            ${reminder.email || false},
            ${reminder.sms || false}
          )
        `
      }
    }

    return NextResponse.json({
      message: 'Paramètres enregistrés avec succès',
      settings: userResult.rows[0]
    })
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des paramètres:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde des paramètres' },
      { status: 500 }
    )
  }
}
