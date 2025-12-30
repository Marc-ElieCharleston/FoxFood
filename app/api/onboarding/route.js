import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { sendExtraFeeNotification } from '@/lib/notifications'

// POST - Sauvegarder les données d'onboarding
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const userId = parseInt(session.user.id)

    // Cas spécial : l'utilisateur rejoint un foyer existant
    if (body.joinedExistingHousehold) {
      // Simplement marquer l'onboarding comme terminé
      await sql`
        UPDATE users
        SET onboarding_completed = true, settings_completed = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `
      return NextResponse.json({ success: true, message: 'Foyer rejoint avec succès' })
    }

    const {
      household_name,
      delivery_day,
      delivery_time_slot,
      household_size,
      extra_fee_accepted,
      notification_email,
      notification_phone,
      reminders
    } = body

    // Validation
    if (!delivery_day || !delivery_time_slot) {
      return NextResponse.json(
        { error: 'Jour et créneau de passage requis' },
        { status: 400 }
      )
    }

    if (!household_size || household_size < 1) {
      return NextResponse.json(
        { error: 'Nombre de personnes invalide' },
        { status: 400 }
      )
    }

    // Vérifier l'acceptation du supplément si > 4 personnes
    if (household_size > 4 && !extra_fee_accepted) {
      return NextResponse.json(
        { error: 'Vous devez accepter le supplément tarifaire pour plus de 4 personnes' },
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
        household_size = ${household_size},
        extra_fee_accepted = ${extra_fee_accepted || false},
        extra_fee_accepted_at = ${extra_fee_accepted ? new Date().toISOString() : null},
        notification_phone = ${notification_phone || null},
        notification_email = ${notification_email || null},
        settings_completed = true,
        onboarding_completed = true,
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

    // Envoyer email de bienvenue à l'utilisateur
    try {
      const { sendWelcomeEmail } = await import('@/lib/notifications')
      await sendWelcomeEmail({
        userId,
        userName: session.user.name,
        userEmail: notification_email || session.user.email
      })
    } catch (notifError) {
      console.error('Erreur envoi email bienvenue:', notifError)
      // On continue même si la notification échoue
    }

    // Si > 4 personnes et acceptation, envoyer notification à l'utilisateur et à l'admin
    if (household_size > 4 && extra_fee_accepted) {
      try {
        await sendExtraFeeNotification({
          userId,
          userName: session.user.name,
          userEmail: notification_email || session.user.email,
          userPhone: notification_phone,
          householdSize: household_size
        })
      } catch (notifError) {
        console.error('Erreur envoi notification supplément:', notifError)
        // On continue même si la notification échoue
      }
    }

    // Créer automatiquement un foyer pour l'utilisateur s'il n'en a pas
    let householdInviteCode = null
    const existingHousehold = await sql`
      SELECT household_id FROM users WHERE id = ${userId}
    `

    if (!existingHousehold.rows[0]?.household_id) {
      // Générer un code d'invitation unique
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let inviteCode = ''
      for (let i = 0; i < 6; i++) {
        inviteCode += chars.charAt(Math.floor(Math.random() * chars.length))
      }

      // Créer le foyer avec le nom personnalisé ou par défaut
      const finalHouseholdName = household_name?.trim() || `Foyer de ${session.user.name}`
      const householdResult = await sql`
        INSERT INTO households (name, created_by, invite_code)
        VALUES (${finalHouseholdName}, ${userId}, ${inviteCode})
        RETURNING id, invite_code
      `

      if (householdResult.rows.length > 0) {
        const householdId = householdResult.rows[0].id
        householdInviteCode = householdResult.rows[0].invite_code

        // Associer l'utilisateur au foyer
        await sql`
          UPDATE users SET household_id = ${householdId} WHERE id = ${userId}
        `
      }
    } else {
      // Récupérer le code d'invitation existant
      const household = await sql`
        SELECT invite_code FROM households WHERE id = ${existingHousehold.rows[0].household_id}
      `
      if (household.rows.length > 0) {
        householdInviteCode = household.rows[0].invite_code
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding terminé avec succès',
      householdInviteCode
    })
  } catch (error) {
    console.error('Erreur lors de l\'onboarding:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde' },
      { status: 500 }
    )
  }
}
