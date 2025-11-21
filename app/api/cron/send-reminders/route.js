import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendShoppingReminder, sendSelectionReminder } from '@/lib/email'

export async function GET(request) {
  try {
    // Vérifier le header d'autorisation Vercel Cron
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const today = new Date()
    const results = {
      shopping_reminders: 0,
      selection_reminders: 0,
      errors: []
    }

    // Récupérer toutes les sélections actives
    const selections = await sql`
      SELECT ws.*, u.email, u.name, u.id as user_id
      FROM weekly_selections ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.status = 'pending'
      AND ws.week_start_date >= CURRENT_DATE - INTERVAL '7 days'
    `

    for (const selection of selections.rows) {
      try {
        // Calculer la date de livraison
        const deliveryDate = getDeliveryDate(selection.delivery_day, selection.week_start_date)
        const daysUntilDelivery = Math.ceil((deliveryDate - today) / (1000 * 60 * 60 * 24))

        // Rappel à 5 jours: liste de courses
        if (daysUntilDelivery === 5) {
          // Récupérer les plats sélectionnés
          const dishIds = selection.selected_dishes
          const dishes = await sql`
            SELECT * FROM dishes WHERE id = ANY(${dishIds})
          `

          const result = await sendShoppingReminder(
            { email: selection.email, name: selection.name },
            dishes.rows,
            selection.delivery_day
          )

          if (result.success) {
            results.shopping_reminders++
            // Enregistrer le rappel
            await sql`
              INSERT INTO reminders (selection_id, reminder_type, status, sent_at)
              VALUES (${selection.id}, 'shopping_5days', 'sent', CURRENT_TIMESTAMP)
            `
          } else {
            results.errors.push(`Shopping reminder failed for user ${selection.user_id}`)
          }
        }

        // Rappel à 2 jours: sélection si pas encore faite (pour les utilisateurs sans sélection)
        if (daysUntilDelivery === 2) {
          // Vérifier si l'utilisateur a fait sa sélection
          if (!selection.selected_dishes || selection.selected_dishes.length === 0) {
            const result = await sendSelectionReminder({
              email: selection.email,
              name: selection.name
            })

            if (result.success) {
              results.selection_reminders++
              await sql`
                INSERT INTO reminders (selection_id, reminder_type, status, sent_at)
                VALUES (${selection.id}, 'selection_2days', 'sent', CURRENT_TIMESTAMP)
              `
            } else {
              results.errors.push(`Selection reminder failed for user ${selection.user_id}`)
            }
          }
        }
      } catch (error) {
        console.error(`Erreur pour la sélection ${selection.id}:`, error)
        results.errors.push(`Error for selection ${selection.id}: ${error.message}`)
      }
    }

    // Vérifier les utilisateurs qui n'ont pas de sélection du tout pour cette semaine
    const usersWithoutSelection = await sql`
      SELECT u.id, u.email, u.name
      FROM users u
      WHERE u.role = 'client'
      AND NOT EXISTS (
        SELECT 1 FROM weekly_selections ws
        WHERE ws.user_id = u.id
        AND ws.week_start_date >= CURRENT_DATE - INTERVAL '7 days'
      )
    `

    // Envoyer un rappel aux utilisateurs sans sélection (une fois par semaine, le lundi)
    if (today.getDay() === 1) { // Lundi
      for (const user of usersWithoutSelection.rows) {
        try {
          const result = await sendSelectionReminder(user)
          if (result.success) {
            results.selection_reminders++
          }
        } catch (error) {
          console.error(`Erreur pour l'utilisateur ${user.id}:`, error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Erreur cron:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'exécution du cron', details: error.message },
      { status: 500 }
    )
  }
}

// Helper pour calculer la date de livraison
function getDeliveryDate(deliveryDay, weekStartDate) {
  const days = {
    'Lundi': 0,
    'Mardi': 1,
    'Mercredi': 2,
    'Jeudi': 3,
    'Vendredi': 4,
    'Samedi': 5,
    'Dimanche': 6
  }

  const weekStart = new Date(weekStartDate)
  const dayOffset = days[deliveryDay] || 0
  const deliveryDate = new Date(weekStart)
  deliveryDate.setDate(weekStart.getDate() + dayOffset)

  return deliveryDate
}

// Permettre aussi les requêtes POST pour les tests manuels
export async function POST(request) {
  return GET(request)
}
