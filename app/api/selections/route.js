import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer la sélection de l'utilisateur pour la semaine en cours
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Obtenir le début de la semaine (lundi)
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const monday = new Date(today.setDate(diff))
    monday.setHours(0, 0, 0, 0)

    const result = await sql`
      SELECT * FROM weekly_selections
      WHERE user_id = ${parseInt(session.user.id)}
      AND week_start_date = ${monday.toISOString().split('T')[0]}
      LIMIT 1
    `

    return NextResponse.json(result.rows[0] || null)
  } catch (error) {
    console.error('Erreur lors de la récupération de la sélection:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la sélection' },
      { status: 500 }
    )
  }
}

// POST - Créer ou mettre à jour une sélection hebdomadaire
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const { selectedDishes, deliveryDay, deliveryTimeSlot } = await request.json()

    if (!selectedDishes || selectedDishes.length === 0) {
      return NextResponse.json(
        { error: 'Veuillez sélectionner au moins un plat' },
        { status: 400 }
      )
    }

    if (selectedDishes.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 plats autorisés' },
        { status: 400 }
      )
    }

    if (!deliveryDay || !deliveryTimeSlot) {
      return NextResponse.json(
        { error: 'Jour et créneau de livraison requis' },
        { status: 400 }
      )
    }

    // Obtenir le début de la semaine (lundi)
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const monday = new Date(today.setDate(diff))
    monday.setHours(0, 0, 0, 0)

    // Upsert (INSERT ou UPDATE)
    const result = await sql`
      INSERT INTO weekly_selections (user_id, week_start_date, delivery_day, delivery_time_slot, selected_dishes, status)
      VALUES (${parseInt(session.user.id)}, ${monday.toISOString().split('T')[0]}, ${deliveryDay}, ${deliveryTimeSlot}, ${JSON.stringify(selectedDishes)}, 'pending')
      ON CONFLICT (user_id, week_start_date)
      DO UPDATE SET
        delivery_day = ${deliveryDay},
        delivery_time_slot = ${deliveryTimeSlot},
        selected_dishes = ${JSON.stringify(selectedDishes)},
        updated_at = CURRENT_TIMESTAMP
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
          a.notify_on_selection,
          u.email as user_email
        FROM admin_settings a
        JOIN users u ON a.user_id = u.id
        WHERE u.role = 'admin'
        AND a.notify_on_selection = true
        LIMIT 1
      `

      if (adminSettingsResult.rows.length > 0) {
        const adminSettings = adminSettingsResult.rows[0]

        // Récupérer les noms des plats sélectionnés
        const dishesResult = await sql`
          SELECT name FROM dishes
          WHERE id = ANY(${selectedDishes})
        `
        const dishNames = dishesResult.rows.map(d => d.name)

        const { notifyAdminOnSelection } = await import('@/lib/notifications')

        await notifyAdminOnSelection({
          adminEmail: adminSettings.notification_email || adminSettings.user_email,
          adminPhone: adminSettings.notification_phone,
          sendEmail: adminSettings.send_email,
          sendSMS: adminSettings.send_sms,
          userName: session.user.name,
          userEmail: session.user.email,
          selectedDishes: dishNames
        })
      }
    } catch (notifError) {
      console.error('Erreur notification admin:', notifError)
      // Ne pas bloquer la sauvegarde si la notification échoue
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la sélection:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde de la sélection' },
      { status: 500 }
    )
  }
}
