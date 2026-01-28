import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@vercel/postgres'

/**
 * POST /api/selections/resend
 * Renvoyer le récapitulatif des semaines futures à l'utilisateur
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id

    // Récupérer les paramètres utilisateur
    const userResult = await sql`
      SELECT
        u.name,
        u.email,
        u.notification_email,
        u.household_size
      FROM users u
      WHERE u.id = ${userId}
    `

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    const user = userResult.rows[0]
    const householdSize = user.household_size || 1
    const userEmail = user.notification_email || user.email

    // Récupérer toutes les sélections futures (week_start_date >= aujourd'hui)
    const selectionsResult = await sql`
      SELECT
        ws.week_start_date,
        ws.selected_dishes,
        ws.selected_variants
      FROM weekly_selections ws
      WHERE ws.user_id = ${userId}
      AND ws.week_start_date >= CURRENT_DATE
      AND ws.selected_dishes IS NOT NULL
      AND jsonb_array_length(ws.selected_dishes) > 0
      ORDER BY ws.week_start_date ASC
    `

    if (selectionsResult.rows.length === 0) {
      return NextResponse.json({
        error: 'Aucune sélection future trouvée'
      }, { status: 404 })
    }

    // Préparer les données pour l'email
    const { sendUserSelectionSummary, getShoppingListData, generateShoppingListHtml } = await import('@/lib/notifications')

    const weeksWithData = {}

    for (let i = 0; i < selectionsResult.rows.length; i++) {
      const weekSelection = selectionsResult.rows[i]

      // Récupérer les noms des plats
      const dishesResult = await sql`
        SELECT d.id, d.name FROM dishes d
        WHERE d.id = ANY(${weekSelection.selected_dishes})
      `

      // Récupérer les variantes si sélectionnées
      const variantIds = Object.values(weekSelection.selected_variants || {}).filter(id => id)
      let variantsMap = {}
      if (variantIds.length > 0) {
        const variantsResult = await sql`
          SELECT id, name FROM dish_variants
          WHERE id = ANY(${variantIds})
        `
        variantsMap = variantsResult.rows.reduce((acc, v) => {
          acc[v.id] = v.name
          return acc
        }, {})
      }

      // Construire la liste avec variantes
      const dishNames = dishesResult.rows.map(d => {
        const variantId = weekSelection.selected_variants?.[d.id]
        const variantName = variantId ? variantsMap[variantId] : null
        if (variantName && variantName !== 'Classique') {
          return `${d.name} (${variantName})`
        }
        return d.name
      })

      // Générer la liste de courses pour cette semaine
      let shoppingListHtml = ''
      try {
        const shoppingData = await getShoppingListData({
          selectedDishes: weekSelection.selected_dishes,
          selectedVariants: weekSelection.selected_variants || {},
          householdSize,
          userId
        })
        if (shoppingData) {
          shoppingListHtml = generateShoppingListHtml(shoppingData)
        }
      } catch (shoppingError) {
        console.error(`Erreur génération liste de courses semaine ${i}:`, shoppingError)
      }

      weeksWithData[`week${i}`] = {
        date: weekSelection.week_start_date,
        dishes: dishNames,
        shoppingListHtml
      }
    }

    // Envoyer l'email
    await sendUserSelectionSummary({
      userId,
      userName: user.name,
      userEmail,
      householdSize,
      weeklyData: weeksWithData
    })

    return NextResponse.json({
      success: true,
      message: `Récapitulatif envoyé pour ${selectionsResult.rows.length} semaine(s)`,
      weeksCount: selectionsResult.rows.length
    })

  } catch (error) {
    console.error('Erreur lors du renvoi du récapitulatif:', error)
    return NextResponse.json(
      { error: 'Erreur lors du renvoi du récapitulatif' },
      { status: 500 }
    )
  }
}
