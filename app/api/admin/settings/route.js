import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer les paramètres admin
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

    const userId = parseInt(session.user.id)

    const settings = await sql`
      SELECT
        notification_email,
        notification_phone,
        notification_phone_secondary,
        send_email,
        send_sms,
        notify_on_selection,
        notify_on_missing_selection,
        notify_on_custom_dish,
        daily_summary,
        auto_reminder_days_before
      FROM admin_settings
      WHERE user_id = ${userId}
      LIMIT 1
    `

    // Si aucun paramètre n'existe, renvoyer les valeurs par défaut
    if (settings.rows.length === 0) {
      return NextResponse.json({
        notification_email: session.user.email || '',
        notification_phone: '',
        notification_phone_secondary: '',
        send_email: true,
        send_sms: false,
        notify_on_selection: true,
        notify_on_missing_selection: true,
        notify_on_custom_dish: true,
        daily_summary: false,
        auto_reminder_days_before: 2
      })
    }

    return NextResponse.json(settings.rows[0])
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres admin:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres' },
      { status: 500 }
    )
  }
}

// POST - Sauvegarder les paramètres admin
export async function POST(request) {
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

    const {
      notification_email,
      notification_phone,
      notification_phone_secondary,
      send_email,
      send_sms,
      notify_on_selection,
      notify_on_missing_selection,
      notify_on_custom_dish,
      daily_summary,
      auto_reminder_days_before
    } = await request.json()

    const userId = parseInt(session.user.id)

    // Validation
    if (send_email && !notification_email) {
      return NextResponse.json(
        { error: 'Email requis si notifications par email activées' },
        { status: 400 }
      )
    }

    if (send_sms && !notification_phone) {
      return NextResponse.json(
        { error: 'Téléphone requis si notifications par SMS activées' },
        { status: 400 }
      )
    }

    if (!send_email && !send_sms) {
      return NextResponse.json(
        { error: 'Au moins une méthode de notification doit être activée' },
        { status: 400 }
      )
    }

    if (auto_reminder_days_before < 1 || auto_reminder_days_before > 5) {
      return NextResponse.json(
        { error: 'Le délai de rappel doit être entre 1 et 5 jours' },
        { status: 400 }
      )
    }

    // Insérer ou mettre à jour les paramètres
    const result = await sql`
      INSERT INTO admin_settings (
        user_id,
        notification_email,
        notification_phone,
        notification_phone_secondary,
        send_email,
        send_sms,
        notify_on_selection,
        notify_on_missing_selection,
        notify_on_custom_dish,
        daily_summary,
        auto_reminder_days_before
      )
      VALUES (
        ${userId},
        ${notification_email || null},
        ${notification_phone || null},
        ${notification_phone_secondary || null},
        ${send_email !== false},
        ${send_sms === true},
        ${notify_on_selection !== false},
        ${notify_on_missing_selection !== false},
        ${notify_on_custom_dish !== false},
        ${daily_summary === true},
        ${auto_reminder_days_before || 2}
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        notification_email = EXCLUDED.notification_email,
        notification_phone = EXCLUDED.notification_phone,
        notification_phone_secondary = EXCLUDED.notification_phone_secondary,
        send_email = EXCLUDED.send_email,
        send_sms = EXCLUDED.send_sms,
        notify_on_selection = EXCLUDED.notify_on_selection,
        notify_on_missing_selection = EXCLUDED.notify_on_missing_selection,
        notify_on_custom_dish = EXCLUDED.notify_on_custom_dish,
        daily_summary = EXCLUDED.daily_summary,
        auto_reminder_days_before = EXCLUDED.auto_reminder_days_before,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `

    return NextResponse.json({
      message: 'Paramètres admin enregistrés avec succès',
      settings: result.rows[0]
    })
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des paramètres admin:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde des paramètres' },
      { status: 500 }
    )
  }
}
