import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

/**
 * POST /api/admin/resend-all
 * Renvoyer les récapitulatifs avec liste de courses à des utilisateurs spécifiques
 * Admin uniquement
 */
export async function POST(request) {
  try {
    // Auth: session admin OU CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isAuthorizedByCron = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isAuthorizedByCron) {
      const session = await getServerSession(authOptions)
      if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    }

    const { userIds } = await request.json()
    if (!userIds || userIds.length === 0) {
      return NextResponse.json({ error: 'userIds requis' }, { status: 400 })
    }

    const { sendUserSelectionSummary, getShoppingListData, generateShoppingListHtml } = await import('@/lib/notifications')

    const results = []

    for (const userId of userIds) {
      try {
        const userResult = await sql`
          SELECT id, name, email, notification_email, household_size, household_id
          FROM users WHERE id = ${userId}
        `
        if (userResult.rows.length === 0) {
          results.push({ userId, status: 'not_found' })
          continue
        }

        const user = userResult.rows[0]
        const householdSize = user.household_size || 1
        const userEmail = user.notification_email || user.email

        // Chercher les sélections futures (par user ou par household)
        let selections = (await sql`
          SELECT week_start_date, selected_dishes FROM weekly_selections
          WHERE user_id = ${userId} AND week_start_date >= CURRENT_DATE
          AND selected_dishes IS NOT NULL AND jsonb_array_length(selected_dishes) > 0
          ORDER BY week_start_date ASC
        `).rows

        if (selections.length === 0 && user.household_id) {
          selections = (await sql`
            SELECT week_start_date, selected_dishes FROM weekly_selections
            WHERE household_id = ${user.household_id} AND week_start_date >= CURRENT_DATE
            AND selected_dishes IS NOT NULL AND jsonb_array_length(selected_dishes) > 0
            ORDER BY week_start_date ASC
          `).rows
        }

        if (selections.length === 0) {
          results.push({ userId, name: user.name, status: 'no_selection' })
          continue
        }

        const weeksWithData = {}
        for (let i = 0; i < selections.length; i++) {
          const sel = selections[i]
          const dishesResult = await sql`SELECT name FROM dishes WHERE id = ANY(${sel.selected_dishes})`

          let shoppingListHtml = ''
          try {
            const shoppingData = await getShoppingListData({
              selectedDishes: sel.selected_dishes,
              householdSize,
              userId
            })
            if (shoppingData) {
              shoppingListHtml = generateShoppingListHtml(shoppingData)
            }
          } catch (e) {
            console.error(`Erreur courses user ${userId}:`, e.message)
          }

          weeksWithData[`week${i}`] = {
            date: sel.week_start_date,
            dishes: dishesResult.rows.map(d => d.name),
            shoppingListHtml
          }
        }

        const emailResult = await sendUserSelectionSummary({
          userId,
          userName: user.name,
          userEmail,
          householdSize,
          weeklyData: weeksWithData
        })

        results.push({ userId, name: user.name, email: userEmail, status: emailResult.success ? 'sent' : 'failed', error: emailResult.error })
      } catch (e) {
        results.push({ userId, status: 'error', error: e.message })
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Erreur resend-all:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
