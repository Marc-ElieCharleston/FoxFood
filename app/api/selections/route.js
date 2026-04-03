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

    // Calculer les 5 prochaines semaines (à partir du lundi suivant ou actuel si on est lundi)
    const weeks = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayOfWeek = today.getDay() // 0=Dimanche, 1=Lundi, ..., 6=Samedi

    let firstMonday = new Date(today)

    if (dayOfWeek === 0) {
      // Dimanche -> lundi suivant (demain)
      firstMonday.setDate(today.getDate() + 1)
    } else if (dayOfWeek === 1) {
      // Lundi -> aujourd'hui (cette semaine)
      // firstMonday reste à today
    } else {
      // Mardi-Samedi -> lundi prochain (semaine suivante)
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

    // weeklySelections est un objet: { week0: { dishes: [...] }, week1: {...}, ... }
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

    // Calculer les dates des 5 prochaines semaines (à partir du lundi suivant ou actuel si on est lundi)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayOfWeek = today.getDay() // 0=Dimanche, 1=Lundi, ..., 6=Samedi

    let firstMonday = new Date(today)

    if (dayOfWeek === 0) {
      // Dimanche -> lundi suivant (demain)
      firstMonday.setDate(today.getDate() + 1)
    } else if (dayOfWeek === 1) {
      // Lundi -> aujourd'hui (cette semaine)
      // firstMonday reste à today
    } else {
      // Mardi-Samedi -> lundi prochain (semaine suivante)
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

      let result
      if (householdId) {
        // Upsert par household_id (sélection partagée par le foyer)
        result = await sql`
          INSERT INTO weekly_selections (user_id, household_id, week_start_date, delivery_day, delivery_time_slot, selected_dishes, status, last_modified_by)
          VALUES (${userId}, ${householdId}, ${weekStartDate}, ${deliveryDay}, ${deliveryTimeSlot}, ${JSON.stringify(selectedDishes)}, 'pending', ${userId})
          ON CONFLICT (household_id, week_start_date)
          DO UPDATE SET
            delivery_day = ${deliveryDay},
            delivery_time_slot = ${deliveryTimeSlot},
            selected_dishes = ${JSON.stringify(selectedDishes)},
            last_modified_by = ${userId},
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `
      } else {
        // Upsert par user_id (utilisateur solo sans foyer)
        result = await sql`
          INSERT INTO weekly_selections (user_id, week_start_date, delivery_day, delivery_time_slot, selected_dishes, status, last_modified_by)
          VALUES (${userId}, ${weekStartDate}, ${deliveryDay}, ${deliveryTimeSlot}, ${JSON.stringify(selectedDishes)}, 'pending', ${userId})
          ON CONFLICT (user_id, week_start_date)
          DO UPDATE SET
            delivery_day = ${deliveryDay},
            delivery_time_slot = ${deliveryTimeSlot},
            selected_dishes = ${JSON.stringify(selectedDishes)},
            last_modified_by = ${userId},
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `
      }
      results.push({ week: i, status: 'saved', data: result.rows[0] })
    }

    // Envoyer email récapitulatif au client (séparé par semaine)
    try {
      const { sendUserSelectionSummary, getShoppingListData, generateShoppingListHtml } = await import('@/lib/notifications')

      // Préparer les données des semaines avec plats ET listes de courses
      const weeksWithData = {}
      const weeksWithDishes = Object.entries(weeklySelections).filter(([k, v]) => v?.dishes?.length > 0).map(([k]) => k)
      console.log(`📊 Préparation email: ${weeksWithDishes.length} semaine(s) avec plats (${weeksWithDishes.join(', ')})`)

      for (let i = 0; i < 5; i++) {
        const weekKey = `week${i}`
        const weekData = weeklySelections[weekKey]

        if (weekData && weekData.dishes && weekData.dishes.length > 0) {
          // Récupérer les noms des plats avec overrides utilisateur
          const dishesResult = await sql`
            SELECT d.id, d.name, udo.custom_name
            FROM dishes d
            LEFT JOIN user_dish_overrides udo ON udo.dish_id = d.id AND udo.user_id = ${userId}
            WHERE d.id = ANY(${weekData.dishes})
          `

          const dishNames = dishesResult.rows.map(d => d.custom_name || d.name)

          // Générer la liste de courses pour cette semaine
          let shoppingListHtml = ''
          try {
            const shoppingData = await getShoppingListData({
              selectedDishes: weekData.dishes,
              householdSize,
              userId
            })
            if (shoppingData) {
              shoppingListHtml = generateShoppingListHtml(shoppingData)
            }
          } catch (shoppingError) {
            console.error(`Erreur génération liste de courses semaine ${i}:`, shoppingError)
          }

          weeksWithData[weekKey] = {
            date: weekDates[i],
            dishes: dishNames,
            shoppingListHtml
          }
        }
      }

      if (Object.keys(weeksWithData).length > 0) {
        console.log(`📧 Envoi email à ${session.user.name} pour ${Object.keys(weeksWithData).length} semaine(s)`)
        await sendUserSelectionSummary({
          userId,
          userName: session.user.name,
          userEmail: userNotificationEmail,
          householdSize,
          weeklyData: weeksWithData
        })
        console.log('✅ Email récapitulatif envoyé au client')
      } else {
        console.log('⚠️ Aucune semaine avec plats à envoyer par email')
      }
    } catch (shoppingListError) {
      console.error('❌ Erreur envoi email client:', shoppingListError)
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
        const { notifyAdminOnSelection, getShoppingListData, generateShoppingListHtml } = await import('@/lib/notifications')

        // Préparer les données PAR SEMAINE pour l'admin
        const adminWeeksData = {}

        for (let i = 0; i < 5; i++) {
          const weekKey = `week${i}`
          const weekData = weeklySelections[weekKey]

          if (weekData && weekData.dishes && weekData.dishes.length > 0) {
            // Récupérer les noms des plats
            const dishesResult = await sql`
              SELECT d.id, d.name FROM dishes d
              WHERE d.id = ANY(${weekData.dishes})
            `

            const dishNames = dishesResult.rows.map(d => d.name)

            // Générer la liste de courses pour cette semaine
            let shoppingListHtml = ''
            try {
              const shoppingData = await getShoppingListData({
                selectedDishes: weekData.dishes,
                householdSize,
                userId
              })
              if (shoppingData) {
                shoppingListHtml = generateShoppingListHtml(shoppingData)
              }
            } catch (shoppingError) {
              console.error(`Erreur génération liste de courses admin semaine ${i}:`, shoppingError)
            }

            adminWeeksData[weekKey] = {
              date: weekDates[i],
              dishes: dishNames,
              shoppingListHtml
            }
          }
        }

        if (Object.keys(adminWeeksData).length > 0) {
          // Envoyer UN seul email à TOUS les admins (avec délai pour éviter rate limit Resend)
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
                weeklyData: adminWeeksData,
                householdSize
              })
              console.log(`Notification complète envoyée à ${adminSettings.admin_name}`)
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
