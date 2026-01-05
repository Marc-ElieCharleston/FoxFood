import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

// GET - Récupérer les sélections du foyer/utilisateur pour les 5 prochaines semaines
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

    // Calculer les 5 prochains lundis (à partir du prochain lundi si on est après lundi)
    const weeks = []
    const today = new Date()
    const dayOfWeek = today.getDay() // 0=Dimanche, 1=Lundi, ..., 6=Samedi

    let firstMonday = new Date(today)
    firstMonday.setHours(0, 0, 0, 0)

    if (dayOfWeek === 0) {
      // Dimanche -> lundi suivant (demain)
      firstMonday.setDate(today.getDate() + 1)
    } else if (dayOfWeek === 1) {
      // Lundi -> aujourd'hui
      // firstMonday reste à today
    } else {
      // Mardi-Samedi -> lundi suivant
      firstMonday.setDate(today.getDate() + (8 - dayOfWeek))
    }

    for (let i = 0; i < 5; i++) {
      const monday = new Date(firstMonday)
      monday.setDate(firstMonday.getDate() + (i * 7))
      weeks.push(monday.toISOString().split('T')[0])
    }

    // Récupérer le household_id de l'utilisateur
    const userResult = await sql`
      SELECT household_id FROM users WHERE id = ${userId}
    `
    const householdId = userResult.rows[0]?.household_id

    let result
    if (householdId) {
      // Si l'utilisateur a un foyer, chercher par household_id
      result = await sql`
        SELECT ws.*, u.name as last_modified_by_name
        FROM weekly_selections ws
        LEFT JOIN users u ON ws.last_modified_by = u.id
        WHERE ws.household_id = ${householdId}
        AND ws.week_start_date = ANY(${weeks})
        ORDER BY ws.week_start_date ASC
      `
    } else {
      // Sinon, chercher par user_id (utilisateur solo)
      result = await sql`
        SELECT * FROM weekly_selections
        WHERE user_id = ${userId}
        AND week_start_date = ANY(${weeks})
        ORDER BY week_start_date ASC
      `
    }

    // Créer un objet avec les sélections par semaine
    const selectionsByWeek = {}
    weeks.forEach((weekDate, index) => {
      const selection = result.rows.find(r => r.week_start_date === weekDate ||
        (r.week_start_date && r.week_start_date.toISOString && r.week_start_date.toISOString().split('T')[0] === weekDate))
      selectionsByWeek[`week${index}`] = selection || null
    })

    return NextResponse.json({
      weeks: weeks,
      selections: selectionsByWeek
    })
  } catch (error) {
    console.error('Erreur lors de la récupération de la sélection:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la sélection' },
      { status: 500 }
    )
  }
}

// POST - Créer ou mettre à jour les sélections hebdomadaires (multi-semaines)
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const userId = parseInt(session.user.id)
    const { weeklySelections } = await request.json()

    // weeklySelections est un objet: { week0: { dishes: [...], variants: {...} }, week1: {...}, ... }
    if (!weeklySelections || typeof weeklySelections !== 'object') {
      return NextResponse.json(
        { error: 'Format de sélection invalide' },
        { status: 400 }
      )
    }

    // Vérifier qu'au moins une semaine a des plats
    const hasAnyDishes = Object.values(weeklySelections).some(
      week => week && week.dishes && week.dishes.length > 0
    )
    if (!hasAnyDishes) {
      return NextResponse.json(
        { error: 'Veuillez sélectionner au moins un plat' },
        { status: 400 }
      )
    }

    // Vérifier que chaque semaine a max 5 plats
    for (const [weekKey, weekData] of Object.entries(weeklySelections)) {
      if (weekData && weekData.dishes && weekData.dishes.length > 5) {
        return NextResponse.json(
          { error: `Maximum 5 plats par semaine (${weekKey})` },
          { status: 400 }
        )
      }
    }

    // Calculer les dates des 5 prochains lundis (à partir du prochain lundi si on est après lundi)
    const today = new Date()
    const dayOfWeek = today.getDay() // 0=Dimanche, 1=Lundi, ..., 6=Samedi

    let firstMonday = new Date(today)
    firstMonday.setHours(0, 0, 0, 0)

    if (dayOfWeek === 0) {
      // Dimanche -> lundi suivant
      firstMonday.setDate(today.getDate() + 1)
    } else if (dayOfWeek === 1) {
      // Lundi -> aujourd'hui
    } else {
      // Mardi-Samedi -> lundi suivant
      firstMonday.setDate(today.getDate() + (8 - dayOfWeek))
    }

    const weekDates = []
    for (let i = 0; i < 5; i++) {
      const monday = new Date(firstMonday)
      monday.setDate(firstMonday.getDate() + (i * 7))
      weekDates.push(monday.toISOString().split('T')[0])
    }

    // Récupérer le household_id et les paramètres de livraison de l'utilisateur
    const userResult = await sql`
      SELECT household_id, delivery_day, delivery_time_slot, notification_email, email, household_size
      FROM users WHERE id = ${userId}
    `
    const householdId = userResult.rows[0]?.household_id
    const deliveryDay = userResult.rows[0]?.delivery_day || 'Lundi'
    const deliveryTimeSlot = userResult.rows[0]?.delivery_time_slot || 'morning'
    const userNotificationEmail = userResult.rows[0]?.notification_email || userResult.rows[0]?.email
    const householdSize = userResult.rows[0]?.household_size || 1

    const results = []

    // Traiter chaque semaine
    for (let i = 0; i < 5; i++) {
      const weekKey = `week${i}`
      const weekData = weeklySelections[weekKey]
      const weekStartDate = weekDates[i]

      if (!weekData || !weekData.dishes || weekData.dishes.length === 0) {
        // Supprimer la sélection pour cette semaine si elle existe
        if (householdId) {
          await sql`
            DELETE FROM weekly_selections
            WHERE household_id = ${householdId} AND week_start_date = ${weekStartDate}
          `
        } else {
          await sql`
            DELETE FROM weekly_selections
            WHERE user_id = ${userId} AND week_start_date = ${weekStartDate}
          `
        }
        results.push({ week: i, status: 'cleared' })
        continue
      }

      const selectedDishes = weekData.dishes
      const selectedVariants = weekData.variants || {}
      const variantsJson = JSON.stringify(selectedVariants)

      let result
      if (householdId) {
        // Upsert par household_id (sélection partagée par le foyer)
        result = await sql`
          INSERT INTO weekly_selections (user_id, household_id, week_start_date, delivery_day, delivery_time_slot, selected_dishes, selected_variants, status, last_modified_by)
          VALUES (${userId}, ${householdId}, ${weekStartDate}, ${deliveryDay}, ${deliveryTimeSlot}, ${JSON.stringify(selectedDishes)}, ${variantsJson}, 'pending', ${userId})
          ON CONFLICT (household_id, week_start_date)
          DO UPDATE SET
            delivery_day = ${deliveryDay},
            delivery_time_slot = ${deliveryTimeSlot},
            selected_dishes = ${JSON.stringify(selectedDishes)},
            selected_variants = ${variantsJson},
            last_modified_by = ${userId},
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `
      } else {
        // Upsert par user_id (utilisateur solo sans foyer)
        result = await sql`
          INSERT INTO weekly_selections (user_id, week_start_date, delivery_day, delivery_time_slot, selected_dishes, selected_variants, status, last_modified_by)
          VALUES (${userId}, ${weekStartDate}, ${deliveryDay}, ${deliveryTimeSlot}, ${JSON.stringify(selectedDishes)}, ${variantsJson}, 'pending', ${userId})
          ON CONFLICT (user_id, week_start_date)
          DO UPDATE SET
            delivery_day = ${deliveryDay},
            delivery_time_slot = ${deliveryTimeSlot},
            selected_dishes = ${JSON.stringify(selectedDishes)},
            selected_variants = ${variantsJson},
            last_modified_by = ${userId},
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `
      }
      results.push({ week: i, status: 'saved', data: result.rows[0] })
    }

    // Envoyer la liste de courses pour chaque semaine avec des plats
    try {
      const { sendShoppingList } = await import('@/lib/notifications')

      for (let i = 0; i < 5; i++) {
        const weekKey = `week${i}`
        const weekData = weeklySelections[weekKey]

        if (weekData && weekData.dishes && weekData.dishes.length > 0) {
          await sendShoppingList({
            userId,
            userName: session.user.name,
            userEmail: userNotificationEmail,
            householdSize,
            weekStartDate: weekDates[i],
            selectedDishes: weekData.dishes,
            selectedVariants: weekData.variants || {}
          })
          console.log(`Liste de courses envoyée pour semaine ${i}`)
        }
      }
    } catch (shoppingListError) {
      console.error('Erreur envoi liste de courses:', shoppingListError)
      // Ne pas bloquer la sauvegarde si l'envoi échoue
    }

    // Envoyer notification à TOUS les admins (une seule fois pour toutes les semaines)
    try {
      const adminSettingsResult = await sql`
        SELECT
          a.notification_email,
          a.notification_phone,
          a.send_email,
          a.send_sms,
          a.notify_on_selection,
          u.email as user_email,
          u.name as admin_name
        FROM admin_settings a
        JOIN users u ON a.user_id = u.id
        WHERE u.role = 'admin'
        AND a.notify_on_selection = true
        ORDER BY CASE WHEN a.notification_email LIKE '%foxfood%' THEN 0 ELSE 1 END
      `

      if (adminSettingsResult.rows.length > 0) {
        // Récupérer tous les plats sélectionnés (une seule fois)
        const allDishIds = []
        const allVariantSelections = {}
        for (const weekData of Object.values(weeklySelections)) {
          if (weekData && weekData.dishes) {
            allDishIds.push(...weekData.dishes)
            Object.assign(allVariantSelections, weekData.variants || {})
          }
        }
        const uniqueDishIds = [...new Set(allDishIds)]

        if (uniqueDishIds.length > 0) {
          const dishesResult = await sql`
            SELECT d.id, d.name FROM dishes d
            WHERE d.id = ANY(${uniqueDishIds})
          `

          // Récupérer les variantes si sélectionnées
          const variantIds = Object.values(allVariantSelections).filter(id => id)
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
            const variantId = allVariantSelections[d.id]
            const variantName = variantId ? variantsMap[variantId] : null
            if (variantName && variantName !== 'Classique') {
              return `${d.name} (${variantName})`
            }
            return d.name
          })

          const { notifyAdminOnSelection, getShoppingListData, generateShoppingListHtml } = await import('@/lib/notifications')

          // Générer la liste de courses pour l'admin
          let shoppingListHtml = ''
          try {
            const shoppingData = await getShoppingListData({
              selectedDishes: uniqueDishIds,
              selectedVariants: allVariantSelections,
              householdSize
            })
            if (shoppingData) {
              shoppingListHtml = generateShoppingListHtml(shoppingData)
            }
          } catch (shoppingError) {
            console.error('Erreur génération liste de courses pour admin:', shoppingError)
          }

          // Envoyer la notification à TOUS les admins (avec délai pour éviter rate limit Resend)
          for (let i = 0; i < adminSettingsResult.rows.length; i++) {
            const adminSettings = adminSettingsResult.rows[i]
            try {
              // Attendre 600ms entre chaque envoi pour respecter la limite de 2 req/sec
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 600))
              }
              await notifyAdminOnSelection({
                adminEmail: adminSettings.notification_email || adminSettings.user_email,
                adminPhone: adminSettings.notification_phone,
                sendEmail: adminSettings.send_email,
                sendSMS: adminSettings.send_sms,
                userName: session.user.name,
                userEmail: session.user.email,
                selectedDishes: dishNames,
                shoppingListHtml
              })
              console.log(`Notification envoyée à ${adminSettings.admin_name}`)
            } catch (adminNotifError) {
              console.error(`Erreur notification admin ${adminSettings.admin_name}:`, adminNotifError)
              // Continuer avec les autres admins même si un échoue
            }
          }
        }
      }
    } catch (notifError) {
      console.error('Erreur notification admin:', notifError)
      // Ne pas bloquer la sauvegarde si la notification échoue
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la sélection:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde de la sélection' },
      { status: 500 }
    )
  }
}
